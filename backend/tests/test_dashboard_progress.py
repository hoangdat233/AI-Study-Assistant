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
    b"BT\n/F1 12 Tf\n100 700 Td\n(Hello Dashboard Test) Tj\nET\n"
    b"endstream\nendobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000225 00000 n \n0000000294 00000 n \n"
    b"trailer <</Size 6 /Root 1 0 R>>\nstartxref\n388\n%%EOF"
)


def get_auth_headers(client, email="dashuser@example.com", name="Dash User"):
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


def test_unauthenticated_dashboard_rejected(client):
    resp_d = client.get("/api/dashboard")
    assert resp_d.status_code in (401, 403)

    resp_p = client.get("/api/progress")
    assert resp_p.status_code in (401, 403)


def test_empty_dashboard_returns_zeros(client):
    headers = get_auth_headers(client, "empty_dash@example.com", "Empty User")
    resp = client.get("/api/dashboard", headers=headers)
    assert resp.status_code == 200

    data = resp.json()
    assert "stats" in data
    assert data["stats"]["documents"] == 0
    assert data["stats"]["questions_asked"] == 0
    assert data["stats"]["quizzes_completed"] == 0
    assert data["stats"]["average_quiz_score"] == 0.0
    assert data["stats"]["flashcards"] == 0
    assert len(data["recent_documents"]) == 0
    assert len(data["recent_activity"]) == 0


def test_server_side_quiz_attempt_grading_and_dashboard_metrics(client, tmp_path):
    headers = get_auth_headers(client, "grading_user@example.com", "Grading User")

    # 1. Upload Document
    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers,
            files={"file": ("study_doc.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    # 2. Generate Quiz
    class MockQuizLLM(MockLLMProvider):
        def generate_text(self, system_prompt: str, user_prompt: str, response_mime_type: str | None = None) -> str:
            import json
            return json.dumps(
                {
                    "title": "Grading Test Quiz",
                    "questions": [
                        {
                            "question": "What is 2 + 2?",
                            "options": ["3", "4", "5", "6"],
                            "correct_answer": "4",
                            "explanation": "2 + 2 equals 4.",
                            "source_page": 1,
                        },
                        {
                            "question": "What is the capital of France?",
                            "options": ["London", "Berlin", "Paris", "Madrid"],
                            "correct_answer": "Paris",
                            "explanation": "Paris is the capital of France.",
                            "source_page": 2,
                        },
                    ],
                }
            )

    with patch("app.services.quiz_service.get_llm_provider", return_value=MockQuizLLM()):
        quiz_resp = client.post(
            f"/api/documents/{doc_id}/quizzes",
            headers=headers,
            json={"question_count": 2, "difficulty": "easy"},
        )
    quiz_data = quiz_resp.json()
    quiz_id = quiz_data["id"]
    q1_id = quiz_data["questions"][0]["id"]
    q2_id = quiz_data["questions"][1]["id"]

    # 3. Submit Quiz Attempt (1 Correct, 1 Incorrect)
    attempt_resp = client.post(
        f"/api/quizzes/{quiz_id}/attempts",
        headers=headers,
        json={
            "answers": {
                q1_id: "4",  # Correct
                q2_id: "London",  # Incorrect
            }
        },
    )
    assert attempt_resp.status_code == 201
    att_data = attempt_resp.json()
    assert att_data["score"] == 1
    assert att_data["total_questions"] == 2
    assert att_data["percentage"] == 50.0

    # 4. Generate Flashcards
    class MockFlashcardLLM(MockLLMProvider):
        def generate_text(self, system_prompt: str, user_prompt: str, response_mime_type: str | None = None) -> str:
            import json
            return json.dumps(
                {
                    "flashcards": [
                        {"front": "Term A", "back": "Def A", "source_page": 1},
                        {"front": "Term B", "back": "Def B", "source_page": 2},
                    ]
                }
            )

    with patch("app.services.flashcard_service.get_llm_provider", return_value=MockFlashcardLLM()):
        client.post(
            f"/api/documents/{doc_id}/flashcards",
            headers=headers,
            json={"card_count": 2},
        )

    # 5. Check Dashboard Metrics
    dash_resp = client.get("/api/dashboard", headers=headers)
    assert dash_resp.status_code == 200
    stats = dash_resp.json()["stats"]
    assert stats["documents"] == 1
    assert stats["quizzes_completed"] == 1
    assert stats["average_quiz_score"] == 50.0
    assert stats["flashcards"] == 2
    assert len(dash_resp.json()["recent_documents"]) == 1
    assert len(dash_resp.json()["recent_activity"]) >= 3


def test_dashboard_ownership_isolation(client, tmp_path):
    headers_a = get_auth_headers(client, "dash_a@example.com", "User A")
    headers_b = get_auth_headers(client, "dash_b@example.com", "User B")

    # User A uploads doc
    with patch.object(document_service, "storage_dir", tmp_path):
        client.post(
            "/api/documents",
            headers=headers_a,
            files={"file": ("doc_a.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )

    # User B's dashboard must still return 0s
    dash_b = client.get("/api/dashboard", headers=headers_b).json()
    assert dash_b["stats"]["documents"] == 0
    assert len(dash_b["recent_documents"]) == 0
    assert len(dash_b["recent_activity"]) == 0
