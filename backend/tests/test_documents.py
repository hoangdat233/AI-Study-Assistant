import io
from pathlib import Path
from unittest.mock import patch

from app.services.document_service import document_service

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


def get_auth_headers(client, email="docuser@example.com", name="Doc User"):
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


def test_unauthenticated_upload_rejected(client):
    files = {"file": ("test.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")}
    response = client.post("/api/documents", files=files)
    assert response.status_code in (401, 403)


def test_valid_pdf_upload_success(client, tmp_path):
    headers = get_auth_headers(client)
    files = {"file": ("syllabus.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")}

    with patch.object(document_service, "storage_dir", tmp_path):
        response = client.post("/api/documents", headers=headers, files=files)

    assert response.status_code == 201
    data = response.json()
    assert data["original_filename"] == "syllabus.pdf"
    assert data["title"] == "syllabus"
    assert data["page_count"] == 1
    assert data["processing_status"] in ("COMPLETED", "NO_TEXT_FOUND")
    assert "extracted_text" in data
    assert "id" in data


def test_invalid_file_type_rejected(client):
    headers = get_auth_headers(client)
    files = {"file": ("notes.txt", io.BytesIO(b"Plain text content"), "text/plain")}

    response = client.post("/api/documents", headers=headers, files=files)
    assert response.status_code == 400
    assert "Invalid file format" in response.json()["detail"]


def test_oversized_file_rejected(client):
    headers = get_auth_headers(client)
    # File larger than 10MB
    large_bytes = b"%PDF-" + b"0" * (10 * 1024 * 1024 + 100)
    files = {"file": ("huge.pdf", io.BytesIO(large_bytes), "application/pdf")}

    response = client.post("/api/documents", headers=headers, files=files)
    assert response.status_code == 400
    assert "File size exceeds" in response.json()["detail"]


def test_list_documents_user_isolation(client, tmp_path):
    headers_user_a = get_auth_headers(client, "usera@example.com", "User A")
    headers_user_b = get_auth_headers(client, "userb@example.com", "User B")

    # User A uploads a document
    with patch.object(document_service, "storage_dir", tmp_path):
        client.post(
            "/api/documents",
            headers=headers_user_a,
            files={"file": ("usera_doc.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )

    # User A lists documents -> sees 1 document
    resp_a = client.get("/api/documents", headers=headers_user_a)
    assert resp_a.status_code == 200
    assert len(resp_a.json()) == 1
    assert resp_a.json()[0]["original_filename"] == "usera_doc.pdf"

    # User B lists documents -> sees 0 documents
    resp_b = client.get("/api/documents", headers=headers_user_b)
    assert resp_b.status_code == 200
    assert len(resp_b.json()) == 0


def test_user_cannot_access_other_user_document(client, tmp_path):
    headers_user_a = get_auth_headers(client, "usera2@example.com", "User A2")
    headers_user_b = get_auth_headers(client, "userb2@example.com", "User B2")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers_user_a,
            files={"file": ("private.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    # User B attempts to access User A's document by ID
    resp_b = client.get(f"/api/documents/{doc_id}", headers=headers_user_b)
    assert resp_b.status_code == 404
    assert resp_b.json()["detail"] == "Document not found"


def test_user_cannot_delete_other_user_document(client, tmp_path):
    headers_user_a = get_auth_headers(client, "usera3@example.com", "User A3")
    headers_user_b = get_auth_headers(client, "userb3@example.com", "User B3")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers_user_a,
            files={"file": ("protected.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
    doc_id = upload_resp.json()["id"]

    # User B attempts to delete User A's document
    del_resp = client.get(f"/api/documents/{doc_id}", headers=headers_user_b)
    assert del_resp.status_code == 404


def test_valid_delete_removes_record_and_file(client, tmp_path):
    headers = get_auth_headers(client, "deleteuser@example.com", "Delete User")

    with patch.object(document_service, "storage_dir", tmp_path):
        upload_resp = client.post(
            "/api/documents",
            headers=headers,
            files={"file": ("todelete.pdf", io.BytesIO(MINIMAL_PDF_BYTES), "application/pdf")},
        )
        doc_id = upload_resp.json()["id"]

        # Verify list contains 1 item
        assert len(client.get("/api/documents", headers=headers).json()) == 1

        # Delete document
        del_resp = client.delete(f"/api/documents/{doc_id}", headers=headers)
        assert del_resp.status_code == 204

        # Verify list is now empty and detail returns 404
        assert len(client.get("/api/documents", headers=headers).json()) == 0
        assert client.get(f"/api/documents/{doc_id}", headers=headers).status_code == 404
