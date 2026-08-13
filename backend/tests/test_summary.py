import io
from unittest.mock import patch

from app.ai.provider import MockLLMProvider
from app.services.document_service import document_service
from app.services.summary_service import summary_service

MINIMAL_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
    b"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
    b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj\n"
    b"4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
    b"5 0 obj <</Length 44>> stream\n"
    b"BT\n/F1 12 Tf\n100 700 Td\n(Hello Study Assistant) Tj\nET\n"
    b"endstream\nendobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000225 00000 n \n0000000294 00000 n \n"
    b"trailer <</Size 6 /Root 1 0 R>>\nstartxref\n388\n%%EOF"
)


def get_auth_headers(client, email="summaryuser@example.com", name="Summary User"):
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


def test_unauthenticated_summary_request_rejected(client):
    resp = client.post("/api/documents/00000000-0000-0000-0000-000000000000/summary")
    assert resp.status_code in (401, 403)


def test_user_cannot_summarize_other_user_document(client, tmp_path):
    headers_a = get_auth_headers(client, "sum_a@example.com", "User A")
    headers_b = get_auth_headers(client, "sum_b@example.com", "User B")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers_a,
            files={"file": ("doc.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    # User B tries to post summary for User A's document
    resp = client.post(f"/api/documents/{doc_id}/summary", headers=headers_b)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Document not found"


def test_generate_and_fetch_summary_success(client, tmp_path):
    headers = get_auth_headers(client, "sum_success@example.com", "Success User")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers,
            files={"file": ("lecture.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    # GET summary before generation returns 404
    get_before = client.get(f"/api/documents/{doc_id}/summary", headers=headers)
    assert get_before.status_code == 404

    # POST generate summary (uses MockLLMProvider automatically in test settings or mock provider patch)
    with patch("app.services.summary_service.get_llm_provider", return_value=MockLLMProvider()):
        gen_resp = client.post(f"/api/documents/{doc_id}/summary", headers=headers)

    assert gen_resp.status_code == 200
    data = gen_resp.json()
    assert "overview" in data
    assert "key_points" in data
    assert isinstance(data["key_points"], list)
    assert len(data["key_points"]) > 0

    # GET summary after generation returns stored summary
    get_after = client.get(f"/api/documents/{doc_id}/summary", headers=headers)
    assert get_after.status_code == 200
    assert get_after.json()["overview"] == data["overview"]


def test_summary_empty_text_rejected(client, db_session):
    headers = get_auth_headers(client, "scanned@example.com", "Scanned User")

    # Create document with NO_TEXT_FOUND status
    from app.models.document import Document
    import uuid

    # Fetch user
    user_resp = client.get("/api/auth/me", headers=headers).json()
    user_id = uuid.UUID(user_resp["id"])

    doc = Document(
        id=uuid.uuid4(),
        user_id=user_id,
        title="scanned_doc",
        original_filename="scanned.pdf",
        file_path="/tmp/scanned.pdf",
        file_size=1024,
        extracted_text=None,
        processing_status="NO_TEXT_FOUND",
    )
    db_session.add(doc)
    db_session.commit()

    resp = client.post(f"/api/documents/{doc.id}/summary", headers=headers)
    assert resp.status_code == 400
    assert "No extractable text found" in resp.json()["detail"]


def test_long_document_map_reduce_chunking(client, db_session):
    headers = get_auth_headers(client, "longdoc@example.com", "Long Doc User")
    user_resp = client.get("/api/auth/me", headers=headers).json()

    from app.models.document import Document
    import uuid

    long_text = ("Paragraph topic text.\n\n" * 1000)  # > 20,000 chars

    doc = Document(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user_resp["id"]),
        title="long_doc",
        original_filename="long.pdf",
        file_path="/tmp/long.pdf",
        file_size=25000,
        extracted_text=long_text,
        processing_status="COMPLETED",
    )
    db_session.add(doc)
    db_session.commit()

    with patch("app.services.summary_service.get_llm_provider", return_value=MockLLMProvider()):
        resp = client.post(f"/api/documents/{doc.id}/summary", headers=headers)

    assert resp.status_code == 200
    assert "overview" in resp.json()
