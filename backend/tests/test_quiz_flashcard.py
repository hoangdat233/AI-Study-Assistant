import io
from unittest.mock import patch

from app.ai.provider import MockLLMProvider
from app.services.document_service import document_service

MINIMAL_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
    b"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
    b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj\n"
    b"4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
    b"5 0 obj <</Length 44>> stream\n"
    b"BT\n/F1 12 Tf\n100 700 Td\n(Hello Quiz and Flashcard Test) Tj\nET\n"
    b"endstream\nendobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000225 00000 n \n0000000294 00000 n \n"
    b"trailer <</Size 6 /Root 1 0 R>>\nstartxref\n388\n%%EOF"
)


def get_auth_headers(client, email="qfuser@example.com", name="Quiz User"):
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


def test_unauthenticated_quiz_and_flashcard_rejected(client):
    resp_q = client.post("/api/documents/00000000-0000-0000-0000-000000000000/quizzes")
    assert resp_q.status_code in (401, 403)

    resp_f = client.post("/api/documents/00000000-0000-0000-0000-000000000000/flashcards")
    assert resp_f.status_code in (401, 403)


def test_user_cannot_access_or_generate_other_user_quiz_or_flashcards(client, tmp_path):
    headers_a = get_auth_headers(client, "qf_a@example.com", "User A")
    headers_b = get_auth_headers(client, "qf_b@example.com", "User B")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers_a,
            files={"file": ("doc_a.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    resp_b_quiz = client.post(
        f"/api/documents/{doc_id}/quizzes",
        headers=headers_b,
        json={"question_count": 5, "difficulty": "medium"},
    )
    assert resp_b_quiz.status_code == 404

    resp_b_fc = client.post(
        f"/api/documents/{doc_id}/flashcards",
        headers=headers_b,
        json={"card_count": 5},
    )
    assert resp_b_fc.status_code == 404


def test_invalid_question_and_card_count_rejected(client, tmp_path):
    headers = get_auth_headers(client, "limits_user@example.com", "Limits User")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers,
            files={"file": ("doc.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    # Question count > 10 rejected
    resp_q = client.post(
        f"/api/documents/{doc_id}/quizzes",
        headers=headers,
        json={"question_count": 50, "difficulty": "medium"},
    )
    assert resp_q.status_code == 422

    # Card count > 20 rejected
    resp_f = client.post(
        f"/api/documents/{doc_id}/flashcards",
        headers=headers,
        json={"card_count": 100},
    )
    assert resp_f.status_code == 422


def test_quiz_generation_retrieval_and_deletion(client, tmp_path):
    headers = get_auth_headers(client, "quiz_gen_user@example.com", "Quiz Gen User")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers,
            files={"file": ("lecture_quiz.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    # Custom mock LLM returning valid JSON Quiz
    class QuizMockLLM(MockLLMProvider):
        def generate_text(self, system_prompt: str, user_prompt: str, response_mime_type: str | None = None) -> str:
            import json
            return json.dumps(
                {
                    "title": "Software Architecture Quiz",
                    "questions": [
                        {
                            "question": "What is the primary goal of modular design?",
                            "options": [
                                "High cohesion and low coupling",
                                "Increased global variables",
                                "Monolithic coupling",
                                "Hardcoded configuration",
                            ],
                            "correct_answer": "High cohesion and low coupling",
                            "explanation": "Modular design aims to keep components independent and cohesive.",
                            "source_page": 1,
                        }
                    ],
                }
            )

    with patch("app.services.quiz_service.get_llm_provider", return_value=QuizMockLLM()):
        gen_resp = client.post(
            f"/api/documents/{doc_id}/quizzes",
            headers=headers,
            json={"question_count": 1, "difficulty": "medium"},
        )

    assert gen_resp.status_code == 201
    quiz_data = gen_resp.json()
    assert quiz_data["title"] == "Software Architecture Quiz"
    assert len(quiz_data["questions"]) == 1
    q = quiz_data["questions"][0]
    assert len(q["options"]) == 4
    assert q["correct_answer"] == "High cohesion and low coupling"
    quiz_id = quiz_data["id"]

    # Retrieve Quiz by ID
    get_resp = client.get(f"/api/quizzes/{quiz_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == quiz_id

    # List Quizzes for document
    list_resp = client.get(f"/api/documents/{doc_id}/quizzes", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # Delete Quiz
    del_resp = client.delete(f"/api/quizzes/{quiz_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify deleted
    get_after_del = client.get(f"/api/quizzes/{quiz_id}", headers=headers)
    assert get_after_del.status_code == 404


def test_flashcard_generation_retrieval_and_deletion(client, tmp_path):
    headers = get_auth_headers(client, "fc_gen_user@example.com", "Flashcard Gen User")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers,
            files={"file": ("lecture_fc.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    class FlashcardMockLLM(MockLLMProvider):
        def generate_text(self, system_prompt: str, user_prompt: str, response_mime_type: str | None = None) -> str:
            import json
            return json.dumps(
                {
                    "flashcards": [
                        {
                            "front": "What is Encapsulation?",
                            "back": "Bundling data and methods that operate on that data into a single unit.",
                            "source_page": 2,
                        }
                    ]
                }
            )

    with patch("app.services.flashcard_service.get_llm_provider", return_value=FlashcardMockLLM()):
        gen_resp = client.post(
            f"/api/documents/{doc_id}/flashcards",
            headers=headers,
            json={"card_count": 1},
        )

    assert gen_resp.status_code == 201
    cards_data = gen_resp.json()
    assert len(cards_data) == 1
    fc = cards_data[0]
    assert fc["front"] == "What is Encapsulation?"
    assert fc["source_page"] == 2
    fc_id = fc["id"]

    # List Flashcards
    list_resp = client.get(f"/api/documents/{doc_id}/flashcards", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # Delete Flashcard
    del_resp = client.delete(f"/api/flashcards/{fc_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify deleted
    list_after_del = client.get(f"/api/documents/{doc_id}/flashcards", headers=headers)
    assert len(list_after_del.json()) == 0
