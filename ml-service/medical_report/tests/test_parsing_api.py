"""HTTP contract for POST /parse."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from medical_report.app import app
from medical_report.testing import reports


@pytest.fixture
def client(settings):
    app.state.settings = settings
    with TestClient(app) as test_client:
        yield test_client


def test_parse_digital_pdf_returns_structured_results(client, tmp_path):
    path = tmp_path / "cbc.pdf"
    reports.build_report_pdf(path, reports.REPORTS["cbc"])

    response = client.post(
        "/parse",
        files={"file": ("cbc.pdf", path.read_bytes(), "application/pdf")},
        data={"document_id": "doc-parse-1"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["document_id"] == "doc-parse-1"
    assert body["report"]["primary"] == "cbc"
    assert body["stats"]["tests"] == len(reports.EXPECTED["cbc"])
    assert body["upload"] == {"bytes": path.stat().st_size, "retained": False}
    assert body["request_id"] == response.headers["X-Request-Id"]

    hemoglobin = next(test for test in body["tests"] if test["canonical_id"] == "hemoglobin")
    assert hemoglobin["value_numeric"] == pytest.approx(13.4)
    assert hemoglobin["unit_normalized"] == "g/dL"
    assert hemoglobin["status"] == "WITHIN_RANGE"
    assert hemoglobin["extracted"]["value_raw"] == "13.4"


def test_parse_mixed_report_reports_multiple_categories(client, tmp_path):
    path = tmp_path / "mixed.pdf"
    reports.build_report_pdf(path, reports.REPORTS["mixed"])

    response = client.post("/parse", files={"file": ("mixed.pdf", path.read_bytes(), "application/pdf")})

    assert response.status_code == 200
    body = response.json()
    assert body["report"]["mixed"] is True
    assert set(body["report"]["detected"]) == {"cbc", "lipid", "thyroid"}
    assert body["stats"]["needs_review"] == 0


def test_parse_rejects_unsupported_file(client):
    response = client.post("/parse", files={"file": ("notes.txt", b"not a report", "text/plain")})

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_file_type"


def test_parse_deletes_the_upload(client, tmp_path, settings):
    path = tmp_path / "cbc.pdf"
    reports.build_report_pdf(path, reports.REPORTS["cbc"])

    client.post("/parse", files={"file": ("cbc.pdf", path.read_bytes(), "application/pdf")})

    assert list(Path(settings.temp_dir).glob(f"{settings.temp_prefix}*")) == []
