"""Stored-payload explanations and corrections, plus the internal token guard.

These routes are what the Node backend calls after the original document has
been deleted, so the payload must round-trip without losing or changing a
single medical fact.
"""

from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from medical_report.app import app
from medical_report.parsing import FieldCorrection, apply_corrections, parse_document
from medical_report.parsing.serialize import PayloadError, report_from_dict
from medical_report.testing import reports

SINGLE_CBC = [
    [
        ["Hemoglobin", "11.2", "g/dL", "12.0 - 15.0"],
        ["WBC", "7200", "/µL", "4000 - 11000"],
    ]
]


def _parsed():
    return parse_document(reports.build_document(SINGLE_CBC))


@pytest.fixture
def client(settings):
    app.state.settings = settings
    with TestClient(app) as test_client:
        yield test_client


def test_payload_round_trip_preserves_every_field():
    original = _parsed().to_dict()

    rebuilt = report_from_dict(original).to_dict()

    assert rebuilt == original


def test_round_trip_keeps_corrections_and_extracted_values():
    corrected = apply_corrections(
        _parsed(),
        [
            FieldCorrection(
                index=0,
                field="value",
                corrected="13.9",
                corrected_by="user-1",
                corrected_at="2026-01-01T00:00:00Z",
            )
        ],
    )

    rebuilt = report_from_dict(corrected.to_dict())

    assert rebuilt.to_dict() == corrected.to_dict()
    assert rebuilt.tests[0].extracted_value_raw == "11.2"
    assert rebuilt.tests[0].value_numeric == pytest.approx(13.9)
    assert rebuilt.tests[0].status == "WITHIN_RANGE"


def test_explain_returns_both_languages(client):
    payload = _parsed().to_dict()
    payload["language"] = "both"

    response = client.post("/explain", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["languages"] == ["en", "hi"]
    assert body["provider"] == "rule-based"

    english = body["explanations"]["en"]
    hindi = body["explanations"]["hi"]
    assert english["summary"]["title"]
    assert hindi["summary"]["title"]
    assert len(english["tests"]) == len(payload["tests"])
    assert [item["status"] for item in english["tests"]] == [item["status"] for item in payload["tests"]]
    assert [item["status"] for item in hindi["tests"]] == [item["status"] for item in payload["tests"]]

    # Hindi must actually be Devanagari, not a transliteration or a copy.
    hindi_text = hindi["tests"][0]["status_text"] + hindi["summary"]["overview"]
    assert any("\u0900" <= char <= "\u097f" for char in hindi_text)


def test_correct_recomputes_status_and_keeps_the_original(client):
    payload = _parsed().to_dict()
    payload["language"] = "both"
    payload["corrections"] = [
        {
            "index": 0,
            "field": "value",
            "corrected": "13.9",
            "corrected_by": "user-1",
            "corrected_at": "2026-01-01T00:00:00.000Z",
            "note": "checked against the paper report",
        }
    ]

    response = client.post("/correct", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["applied_count"] == 1

    hemoglobin = body["tests"][0]
    assert hemoglobin["status"] == "WITHIN_RANGE"
    assert hemoglobin["value_numeric"] == pytest.approx(13.9)
    assert hemoglobin["extracted"]["value_raw"] == "11.2"
    assert hemoglobin["extracted"]["value_numeric"] == pytest.approx(11.2)
    assert hemoglobin["corrections"][0]["original"] == "11.2"
    assert hemoglobin["corrections"][0]["corrected"] == "13.9"

    explained = body["explanations"]["hi"]["tests"][0]
    assert explained["status"] == "WITHIN_RANGE"
    assert "13.9" in explained["result_line"]


def test_correction_for_unknown_row_is_reported_not_guessed(client):
    payload = _parsed().to_dict()
    payload["corrections"] = [{"index": 99, "field": "value", "corrected": "1.0"}]

    response = client.post("/correct", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["applied_count"] == 0
    assert body["warnings"]
    assert body["tests"][0]["status"] == payload["tests"][0]["status"]


@pytest.mark.parametrize(
    ("endpoint", "mutate"),
    [
        ("explain", lambda payload: payload.update({"language": "fr"})),
        ("explain", lambda payload: payload["tests"][0].update({"status": "TOTALLY_FINE"})),
        ("correct", lambda payload: payload["corrections"].append({"index": 0, "field": "diagnosis", "corrected": "x"})),
        ("explain", lambda payload: payload.update({"tests": [payload["tests"][0]] * 201})),
    ],
)
def test_invalid_payloads_are_rejected(client, endpoint, mutate):
    payload = _parsed().to_dict()
    mutate(payload)

    response = client.post(f"/{endpoint}", json=payload)

    assert response.status_code == 422


def test_untrusted_status_is_rejected_by_the_deserializer():
    payload = _parsed().to_dict()
    payload["tests"][0]["status"] = "PROBABLY_FINE"

    with pytest.raises(PayloadError):
        report_from_dict(payload)


def test_internal_token_is_enforced_when_configured(client, settings):
    app.state.settings = replace(settings, service_token="unit-test-token")
    try:
        payload = _parsed().to_dict()

        assert client.post("/explain", json=payload).status_code == 401
        assert (
            client.post("/explain", json=payload, headers={"X-Internal-Token": "wrong"}).status_code
            == 401
        )
        ok = client.post("/explain", json=payload, headers={"X-Internal-Token": "unit-test-token"})
        assert ok.status_code == 200

        # Uploads are internal too; readiness stays public.
        assert client.post("/parse").status_code == 401
        assert client.get("/health").status_code == 200
    finally:
        app.state.settings = settings
