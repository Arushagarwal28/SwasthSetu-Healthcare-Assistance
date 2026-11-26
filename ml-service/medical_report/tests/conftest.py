"""Shared pytest fixtures for the medical report service."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path

import pytest

# Allow running pytest from either ml-service/ or medical_report/.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from medical_report.config import Settings, get_settings  # noqa: E402
from medical_report.pipeline.ocr_engine import get_engine  # noqa: E402


@pytest.fixture(scope="session")
def base_settings() -> Settings:
    return get_settings()


@pytest.fixture
def settings(tmp_path, base_settings: Settings) -> Settings:
    work = tmp_path / "temp-uploads"
    work.mkdir(parents=True, exist_ok=True)
    # The internal token guard is disabled for functional tests; the tests that
    # cover the guard enable it explicitly on the app state.
    return replace(
        base_settings,
        temp_dir=str(work),
        max_file_bytes=8 * 1024 * 1024,
        service_token=None,
    )


@pytest.fixture(scope="session")
def tesseract_ready(base_settings: Settings):
    engine = get_engine(base_settings)
    if not engine.is_available():
        pytest.skip("Tesseract is not available in this environment")
    return engine
