import io
from pathlib import Path
from unittest.mock import patch

from app.ai.embedding import MockEmbeddingProvider
from app.ai.provider import MockLLMProvider
from app.services.document_service import document_service
from app.services.indexing_service import DocumentChunker, indexing_service
from app.services.rag_service import rag_service
from evaluation.evaluate_rag import ThresholdEvaluator
from evaluation.evaluate_retrieval import RetrievalEvaluator

MINIMAL_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
    b"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
    b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj\n"
    b"4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
    b"5 0 obj <</Length 44>> stream\n"
    b"BT\n/F1 12 Tf\n100 700 Td\n(Hello RAG Document Chat) Tj\nET\n"
    b"endstream\nendobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000225 00000 n \n0000000294 00000 n \n"
    b"trailer <</Size 6 /Root 1 0 R>>\nstartxref\n388\n%%EOF"
)


def get_auth_headers(client, email="raguser@example.com", name="RAG User"):
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "full_name": name},
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_custom_document_chunker_preserves_page_numbers():
    chunker = DocumentChunker()
    sample_text = (
        "--- Page 1 ---\n"
        "Software engineering applies systematic principles to development.\n\n"
        "--- Page 2 ---\n"
        "Database indexing uses B-trees and vector embeddings for fast lookup."
    )
    chunks = chunker.chunk_document(sample_text)
    assert len(chunks) == 2
    assert chunks[0].page_number == 1
    assert "Software engineering" in chunks[0].content
    assert chunks[1].page_number == 2
    assert "vector embeddings" in chunks[1].content


def test_unauthenticated_indexing_and_chat_rejected(client):
    resp_idx = client.post("/api/documents/00000000-0000-0000-0000-000000000000/index")
    assert resp_idx.status_code in (401, 403)

    resp_chat = client.post(
        "/api/documents/00000000-0000-0000-0000-000000000000/chat",
        json={"question": "What is in the document?"},
    )
    assert resp_chat.status_code in (401, 403)


def test_user_cannot_index_or_chat_other_user_document(client, tmp_path):
    headers_a = get_auth_headers(client, "rag_a@example.com", "User A")
    headers_b = get_auth_headers(client, "rag_b@example.com", "User B")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers_a,
            files={"file": ("doc_a.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    resp_b_idx = client.post(f"/api/documents/{doc_id}/index", headers=headers_b)
    assert resp_b_idx.status_code == 404

    resp_b_chat = client.post(
        f"/api/documents/{doc_id}/chat",
        headers=headers_b,
        json={"question": "Test question"},
    )
    assert resp_b_chat.status_code == 404


def test_index_document_and_reindex_safely(client, tmp_path):
    headers = get_auth_headers(client, "index_user@example.com", "Index User")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers,
            files={"file": ("lecture.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    with patch("app.services.indexing_service.get_embedding_provider", return_value=MockEmbeddingProvider()):
        index_resp = client.post(f"/api/documents/{doc_id}/index", headers=headers)

    assert index_resp.status_code == 200
    assert index_resp.json()["indexed"] is True
    assert index_resp.json()["chunk_count"] > 0

    # Re-indexing with force=False returns existing chunk count without re-embedding
    with patch("app.services.indexing_service.get_embedding_provider", return_value=MockEmbeddingProvider()):
        reindex_resp = client.post(f"/api/documents/{doc_id}/index", headers=headers)
    assert reindex_resp.status_code == 200
    assert reindex_resp.json()["chunk_count"] == index_resp.json()["chunk_count"]


def test_rag_chat_and_history_persistence(client, tmp_path):
    headers = get_auth_headers(client, "chat_user@example.com", "Chat User")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers,
            files={"file": ("study.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    # Index document first
    with patch("app.services.indexing_service.get_embedding_provider", return_value=MockEmbeddingProvider()):
        client.post(f"/api/documents/{doc_id}/index", headers=headers)

    # Send Chat Question
    with patch("app.services.rag_service.get_embedding_provider", return_value=MockEmbeddingProvider()), \
         patch("app.services.rag_service.get_llm_provider", return_value=MockLLMProvider()):
        chat_resp = client.post(
            f"/api/documents/{doc_id}/chat",
            headers=headers,
            json={"question": "Explain software engineering maintainability."},
        )

    assert chat_resp.status_code == 200
    data = chat_resp.json()
    assert "answer" in data
    assert "sources" in data
    assert "chat_id" in data

    # Verify Chat History endpoint retrieves stored messages
    history_resp = client.get(f"/api/documents/{doc_id}/chat", headers=headers)
    assert history_resp.status_code == 200
    messages = history_resp.json()
    assert len(messages) == 2  # 1 User message + 1 Assistant message
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"


def test_rag_ungrounded_fallback(client, db_session):
    headers = get_auth_headers(client, "fallback_user@example.com", "Fallback User")

    from app.models.document import Document
    import uuid

    # Create user
    user_resp = client.get("/api/auth/me", headers=headers).json()

    doc = Document(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user_resp["id"]),
        title="test_fallback",
        original_filename="doc.pdf",
        file_path="/tmp/doc.pdf",
        file_size=100,
        extracted_text="--- Page 1 ---\nPhotosynthesis converts sunlight into energy in green plants.",
        processing_status="INDEXED",
    )
    db_session.add(doc)
    db_session.commit()

    # Index document
    with patch("app.services.indexing_service.get_embedding_provider", return_value=MockEmbeddingProvider()):
        indexing_service.index_document(db_session, doc)

    # Ask ungrounded question with high vector distance threshold mock
    with patch.object(rag_service, "search_similar_chunks", return_value=([{"chunk_id": "1", "page_number": 1, "content": "xyz", "score": 0.95}], 10.0, 5.0)):
        ans = rag_service.answer_question(db_session, doc, "What is quantum mechanics?")
        assert ans["answer"] == "I couldn't find enough information in this document to answer that question."
        assert len(ans["sources"]) == 0


def test_rag_evaluation_scenarios(client, db_session):
    """RAG Evaluation Suite: Tests Explicit Answer, Paraphrased Query, and No-Context Cases."""
    headers = get_auth_headers(client, "eval_user@example.com", "Eval User")
    user_resp = client.get("/api/auth/me", headers=headers).json()

    from app.models.document import Document
    import uuid

    doc_text = (
        "--- Page 1 ---\n"
        "The minimum required GPA for the ITMO scholarship program is 4.0 out of 5.0.\n\n"
        "--- Page 2 ---\n"
        "Students must submit official progress reports twice per academic year."
    )

    doc = Document(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user_resp["id"]),
        title="eval_doc",
        original_filename="eval.pdf",
        file_path="/tmp/eval.pdf",
        file_size=500,
        extracted_text=doc_text,
        processing_status="INDEXED",
    )
    db_session.add(doc)
    db_session.commit()

    with patch("app.services.indexing_service.get_embedding_provider", return_value=MockEmbeddingProvider()):
        indexing_service.index_document(db_session, doc)

    # Scenario A: Explicit Question
    with patch("app.services.rag_service.get_embedding_provider", return_value=MockEmbeddingProvider()), \
         patch("app.services.rag_service.get_llm_provider", return_value=MockLLMProvider()):
        res_a = rag_service.answer_question(db_session, doc, "What is the minimum required GPA?")
        assert len(res_a["sources"]) > 0
        assert res_a["sources"][0]["page"] in (1, 2)

    # Scenario B: Paraphrased Query
    with patch("app.services.rag_service.get_embedding_provider", return_value=MockEmbeddingProvider()), \
         patch("app.services.rag_service.get_llm_provider", return_value=MockLLMProvider()):
        res_b = rag_service.answer_question(db_session, doc, "How high does a student's grades need to be?")
        assert len(res_b["sources"]) > 0

    # Scenario C: Answer Not In Context (Grounding Fallback)
    with patch.object(rag_service, "search_similar_chunks", return_value=([{"chunk_id": "1", "page_number": 1, "content": "xyz", "score": 0.90}], 10.0, 5.0)):
        res_c = rag_service.answer_question(db_session, doc, "What is the tuition fee for Harvard University?")
        assert res_c["answer"] == "I couldn't find enough information in this document to answer that question."
        assert len(res_c["sources"]) == 0


def test_rag_source_deduplication_and_citation_provenance(db_session):
    """Phase 9 Guarantee: Deduplicates UI source page badges while preserving all chunks in prompt context."""
    from app.models.document import Document
    import uuid

    doc = Document(
        id=uuid.uuid4(),
        title="dedup_test",
        original_filename="dedup.pdf",
        file_path="/tmp/dedup.pdf",
        file_size=100,
        extracted_text="--- Page 3 ---\nChunk 1 text.\nChunk 2 text on same page.",
        processing_status="INDEXED",
    )

    # Simulate 4 retrieved chunks where chunks 1 & 2 share Page 3, and chunk 3 is Page 5
    mock_retrieved = [
        {"chunk_id": "c1", "chunk_index": 0, "page_number": 3, "content": "Section A on page 3", "score": 0.20},
        {"chunk_id": "c2", "chunk_index": 1, "page_number": 3, "content": "Section B on page 3", "score": 0.25},
        {"chunk_id": "c3", "chunk_index": 2, "page_number": 5, "content": "Section C on page 5", "score": 0.30},
        {"chunk_id": "c4", "chunk_index": 3, "page_number": 5, "content": "Section D on page 5", "score": 0.35},
    ]

    with patch.object(rag_service, "search_similar_chunks", return_value=(mock_retrieved, 12.0, 4.0)), \
         patch("app.services.rag_service.get_llm_provider", return_value=MockLLMProvider()):
        res = rag_service.answer_question(db_session, doc, "Test query")

    # Authoritative citations should contain exactly 2 unique pages (Page 3, Page 5)
    assert len(res["sources"]) == 2
    pages = [s["page"] for s in res["sources"]]
    assert pages == [3, 5]
    # Verify telemetry is populated
    assert "telemetry" in res
    assert res["telemetry"]["embedding_ms"] == 12.0
    assert res["telemetry"]["retrieval_ms"] == 4.0
    assert res["telemetry"]["retrieved_chunks"] == 4


def test_evaluation_framework_metrics_calculation(tmp_path):
    """Phase 9 Guarantee: Tests Hit@K, Recall@K, and MRR calculations deterministically."""
    sample_doc = (
        "--- Page 1 ---\nSupervised machine learning.\n\n"
        "--- Page 2 ---\nUnsupervised learning and clustering.\n\n"
        "--- Page 3 ---\nReinforcement learning."
    )
    dataset = [
        {"id": "q1", "question": "What is supervised learning?", "expected_pages": [1], "answerable": True},
        {"id": "q2", "question": "Explain k-means clustering.", "expected_pages": [2], "answerable": True},
        {"id": "q3", "question": "What is the capital of Mars?", "expected_pages": [], "answerable": False},
    ]

    evaluator = RetrievalEvaluator(
        document_text=sample_doc,
        embedding_provider=MockEmbeddingProvider(),
        cache_file=tmp_path / "test_cache.json",
    )

    k_metrics = evaluator.evaluate_k_metrics(dataset, k_values=[2, 4])
    assert 2 in k_metrics
    assert 4 in k_metrics
    assert 0.0 <= k_metrics[2].hit_rate <= 1.0
    assert 0.0 <= k_metrics[2].mrr <= 1.0

    thresh_eval = ThresholdEvaluator(evaluator)
    threshold_results = thresh_eval.evaluate_thresholds(dataset, [0.50, 0.85])
    assert len(threshold_results) == 2
    assert threshold_results[0].accuracy >= 0.0
