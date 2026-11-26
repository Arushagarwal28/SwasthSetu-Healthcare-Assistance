"""API behaviour: contract, error envelope, limits and temp-file privacy."""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from medical_report.app import app
from medical_report.testing import fixtures


@pytest.fixture
def client(settings):
    app.state.settings = settings
    with TestClient(app) as test_client:
        yield test_client


def test_health_reports_engine_and_privacy(client):
    response = client.get("/health")
    assert response.status_code == 200

    body = response.json()
    assert body["service"] == "swasthsetu-medical-report-ocr"
    assert body["privacy"]["retains_uploads"] is False
    assert body["limits"]["max_pages"] >= 1
    assert body["ocr"]["available"] is True
    assert "hin" in body["ocr"]["languages"]


def test_extract_digital_pdf_returns_contract(client, tmp_path):
    path = tmp_path / "report.pdf"
    fixtures.build_text_pdf(path, [fixtures.report_lines()])

    response = client.post(
        "/extract",
        files={"file": ("report.pdf", path.read_bytes(), "application/pdf")},
        data={"document_id": "doc_123", "langs": "eng"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["document_id"] == "doc_123"
    assert body["pages"][0]["source"] == "pdf_text"
    assert body["upload"] == {"bytes": path.stat().st_size, "retained": False}
    assert body["request_id"] == response.headers["X-Request-Id"]
    assert "Hemoglobin" in body["text"]


def test_unsupported_file_returns_415(client):
    response = client.post(
        "/extract",
        files={"file": ("notes.txt", b"just some text, not a report", "text/plain")},
    )

    assert response.status_code == 415
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "unsupported_file_type"
    assert response.headers["X-Request-Id"] == body["request_id"]


def test_oversized_upload_returns_413(tmp_path):
    settings = app.state.settings
    app.state.settings = replace(settings, max_file_bytes=1024)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/extract",
                files={"file": ("big.pdf", b"%PDF-1.4" + b"0" * 4096, "application/pdf")},
            )
    finally:
        app.state.settings = settings

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


def test_corrupt_pdf_returns_422(client):
    response = client.post(
        "/extract",
        files={"file": ("broken.pdf", b"%PDF-1.4\nthis is not a real pdf body", "application/pdf")},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] in {"document_unreadable", "encrypted_document"}


def test_invalid_document_id_and_dpi_are_rejected(client, tmp_path):
    path = tmp_path / "report.pdf"
    fixtures.build_text_pdf(path)
    payload = path.read_bytes()

    bad_id = client.post(
        "/extract",
        files={"file": ("report.pdf", payload, "application/pdf")},
        data={"document_id": "not valid!"},
    )
    assert bad_id.status_code == 422
    assert bad_id.json()["error"]["code"] == "invalid_request"

    bad_dpi = client.post(
        "/extract",
        files={"file": ("report.pdf", payload, "application/pdf")},
        data={"dpi": "10"},
    )
    assert bad_dpi.status_code == 422


def test_uploads_are_deleted_after_the_request(client, tmp_path, settings):
    path = tmp_path / "report.pdf"
    fixtures.build_text_pdf(path)

    client.post(
        "/extract",
        files={"file": ("report.pdf", path.read_bytes(), "application/pdf")},
    )

    leftovers = list(Path(settings.temp_dir).glob(f"{settings.temp_prefix}*"))
    assert leftovers == []


def test_uploads_are_deleted_when_extraction_fails(client, settings):
    client.post(
        "/extract",
        files={"file": ("broken.pdf", b"%PDF-1.4\nbroken", "application/pdf")},
    )

    leftovers = list(Path(settings.temp_dir).glob(f"{settings.temp_prefix}*"))
    assert leftovers == []


def test_blank_upload_is_rejected(client):
    response = client.post("/extract", files={"file": ("empty.pdf", b"", "application/pdf")})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "empty_document"
