"""FastAPI application for medical report extraction (port 8001).

The service is stateless: uploads are spooled to a temporary file, processed,
and always deleted. Only the extracted structure is returned; nothing is kept.

Run from the ``ml-service`` directory:

    ./venv/Scripts/python.exe -m medical_report.app
    ./venv/Scripts/python.exe -m uvicorn medical_report.app:app --host 127.0.0.1 --port 8001
"""

from __future__ import annotations

import hmac
import logging
import os
import re
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, List, Optional

import uvicorn
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from medical_report import __version__
from medical_report.config import Settings, get_settings
from medical_report.errors import EmptyDocument, ExtractionError, FileTooLarge, InvalidRequest
from medical_report.nlp_api import router as nlp_router
from medical_report.parsing import parse_document_file
from medical_report.pipeline import loader
from medical_report.pipeline.extract import extract_document
from medical_report.pipeline.ocr_engine import get_engine

logger = logging.getLogger("medical_report")

_DOCUMENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_CHUNK = 1024 * 1024

#: Routes that must stay reachable for readiness checks and API documentation.
_PUBLIC_PATHS = frozenset({"/health", "/docs", "/openapi.json", "/redoc"})


def _settings(request: Request) -> Settings:
    return getattr(request.app.state, "settings", None) or get_settings()


def _temp_root(settings: Settings) -> Path:
    root = Path(settings.temp_dir) if settings.temp_dir else Path(tempfile.gettempdir())
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_unlink(path: Optional[str]) -> None:
    if not path:
        return
    try:
        os.unlink(path)
    except OSError:
        pass


def sweep_stale_temp(settings: Settings) -> int:
    """Delete our own leftover temp files from a previous crashed run."""
    if settings.stale_temp_minutes <= 0:
        return 0
    cutoff = time.time() - settings.stale_temp_minutes * 60
    removed = 0
    try:
        entries = list(_temp_root(settings).glob(f"{settings.temp_prefix}*"))
    except OSError:
        return 0
    for entry in entries:
        try:
            if entry.is_file() and entry.stat().st_mtime < cutoff:
                entry.unlink()
                removed += 1
        except OSError:
            continue
    if removed:
        logger.info("removed %s stale temporary upload(s)", removed)
    return removed


@asynccontextmanager
async def lifespan(application: FastAPI):
    settings = getattr(application.state, "settings", None) or get_settings()
    application.state.settings = settings
    sweep_stale_temp(settings)
    engine = get_engine(settings)
    if engine.is_available():
        logger.info("OCR engine ready: tesseract %s, languages=%s", engine.version(), engine.list_languages())
    else:
        logger.warning("OCR engine unavailable: Tesseract binary was not found")
    yield


app = FastAPI(
    title="SwasthSetu Medical Report OCR Service",
    description=(
        "Extracts text, lines and tables from PDF or image medical reports. "
        "No clinical interpretation is performed. Uploads are never retained."
    ),
    version=__version__,
    lifespan=lifespan,
)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    request.state.request_id = request_id

    # The service is internal: only a caller holding the shared token may use it.
    # The guard is skipped when no token is configured, which keeps loopback
    # local development and the existing test-suite working.
    token = _settings(request).service_token
    if token and request.url.path not in _PUBLIC_PATHS:
        provided = request.headers.get("x-internal-token", "")
        if not provided or not hmac.compare_digest(provided, token):
            logger.warning("rejected a request without a valid internal token")
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "error": {
                        "code": "unauthorized_internal_client",
                        "message": "This endpoint is internal to SwasthSetu.",
                        "details": {},
                    },
                    "request_id": request_id,
                },
            )

    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


async def _spool_upload(upload: UploadFile, settings: Settings):
    root = _temp_root(settings)
    handle_fd, path = tempfile.mkstemp(prefix=settings.temp_prefix, suffix=".upload", dir=str(root))
    size = 0
    head = b""
    try:
        with os.fdopen(handle_fd, "wb") as handle:
            while True:
                chunk = await upload.read(_CHUNK)
                if not chunk:
                    break
                size += len(chunk)
                if size > settings.max_file_bytes:
                    raise FileTooLarge(
                        f"File is larger than the {settings.max_file_mb} MB limit.",
                        details={"max_mb": settings.max_file_mb},
                    )
                if len(head) < 16:
                    head += chunk[:16]
                handle.write(chunk)
        if size == 0:
            raise EmptyDocument("The uploaded file is empty.")
        kind = loader.sniff_kind(head)
        return path, size, kind
    except BaseException:
        _safe_unlink(path)
        raise


def _error(request: Request, exc: ExtractionError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {"code": exc.code, "message": exc.message, "details": exc.details},
            "request_id": request_id,
        },
    )


@app.exception_handler(ExtractionError)
async def handle_extraction_error(request: Request, exc: ExtractionError) -> JSONResponse:
    logger.warning("extraction failed code=%s status=%s", exc.code, exc.status_code)
    return _error(request, exc)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "invalid_request",
                "message": "The request was not valid.",
                "details": {"errors": exc.errors()},
            },
            "request_id": request_id,
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unexpected failure in the report OCR service")
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "internal_error",
                "message": "The OCR service could not process this document.",
                "details": {},
            },
            "request_id": request_id,
        },
    )


@app.get("/health")
def health(request: Request) -> dict:
    settings = _settings(request)
    engine = get_engine(settings)
    available = engine.is_available()
    return {
        "status": "ok" if available else "degraded",
        "service": settings.service_name,
        "version": __version__,
        "ocr": engine.describe() if available else {"name": engine.name, "available": False},
        "limits": {
            "max_file_mb": settings.max_file_mb,
            "max_pages": settings.max_pages,
            "dpi": {"default": settings.ocr_dpi, "min": settings.min_dpi, "max": settings.max_dpi},
            "languages": {
                "default": list(settings.default_langs),
                "hindi": list(settings.hindi_langs),
                "auto_detect": settings.auto_detect_language,
            },
            "preprocess": {"deskew": settings.deskew, "binarize": settings.binarize},
        },
        "privacy": {
            "retains_uploads": False,
            "temp_prefix": settings.temp_prefix,
            "stale_temp_minutes": settings.stale_temp_minutes,
        },
    }


@app.post("/extract")
async def extract(
    request: Request,
    file: UploadFile = File(..., description="PDF or image of a medical report"),
    langs: Optional[str] = Form(default=None, description="Comma separated OCR languages, e.g. eng or hin,eng"),
    dpi: Optional[int] = Form(default=None, description="Render DPI for scanned PDFs"),
    max_pages: Optional[int] = Form(default=None, description="Process at most this many pages"),
    document_id: Optional[str] = Form(default=None, description="Caller supplied opaque document id"),
):
    settings = _settings(request)

    if document_id is not None and not _DOCUMENT_ID_RE.match(document_id):
        raise InvalidRequest("document_id must be 1-64 characters of letters, digits, '-' or '_'.")
    if dpi is not None and not (settings.min_dpi <= dpi <= settings.max_dpi):
        raise InvalidRequest(f"dpi must be between {settings.min_dpi} and {settings.max_dpi}.")
    if max_pages is not None and max_pages < 1:
        raise InvalidRequest("max_pages must be at least 1.")

    language_list: Optional[List[str]] = (
        [part.strip() for part in langs.split(",") if part.strip()] if langs else None
    )

    temp_path: Optional[str] = None
    size = 0
    try:
        temp_path, size, kind = await _spool_upload(file, settings)
        result = await run_in_threadpool(
            lambda: extract_document(
                temp_path,
                kind,
                settings,
                languages=language_list,
                dpi=dpi,
                max_pages=max_pages,
                document_id=document_id,
            )
        )
    finally:
        _safe_unlink(temp_path)

    payload: dict[str, Any] = result.to_dict()
    payload["request_id"] = getattr(request.state, "request_id", None)
    payload["upload"] = {"bytes": size, "retained": False}
    return payload


@app.post("/parse")
async def parse(
    request: Request,
    file: UploadFile = File(..., description="PDF or image of a medical report"),
    langs: Optional[str] = Form(default=None, description="Comma separated OCR languages"),
    dpi: Optional[int] = Form(default=None, description="Render DPI for scanned PDFs"),
    max_pages: Optional[int] = Form(default=None, description="Process at most this many pages"),
    document_id: Optional[str] = Form(default=None, description="Caller supplied opaque document id"),
    cross_verify: bool = Form(default=True, description="Re-read numbers with the English OCR model"),
):
    """Extract and parse a report into structured, classified test results."""
    settings = _settings(request)

    if document_id is not None and not _DOCUMENT_ID_RE.match(document_id):
        raise InvalidRequest("document_id must be 1-64 characters of letters, digits, '-' or '_'.")
    if dpi is not None and not (settings.min_dpi <= dpi <= settings.max_dpi):
        raise InvalidRequest(f"dpi must be between {settings.min_dpi} and {settings.max_dpi}.")
    if max_pages is not None and max_pages < 1:
        raise InvalidRequest("max_pages must be at least 1.")

    language_list: Optional[List[str]] = (
        [part.strip() for part in langs.split(",") if part.strip()] if langs else None
    )

    temp_path: Optional[str] = None
    size = 0
    try:
        temp_path, size, kind = await _spool_upload(file, settings)
        result = await run_in_threadpool(
            lambda: parse_document_file(
                temp_path,
                kind,
                settings,
                languages=language_list,
                dpi=dpi,
                max_pages=max_pages,
                document_id=document_id,
                cross_verify=cross_verify,
            )
        )
    finally:
        _safe_unlink(temp_path)

    payload: dict[str, Any] = result.to_dict()
    payload["request_id"] = getattr(request.state, "request_id", None)
    payload["upload"] = {"bytes": size, "retained": False}
    return payload


app.include_router(nlp_router)


def main() -> None:
    settings = get_settings()
    logging.basicConfig(
        level=os.environ.get("MEDICAL_OCR_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logger.info("starting %s on %s:%s", settings.service_name, settings.host, settings.port)
    uvicorn.run(app, host=settings.host, port=settings.port, log_level="info")


if __name__ == "__main__":
    main()
