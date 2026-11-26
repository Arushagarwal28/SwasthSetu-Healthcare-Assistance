/**
 * Client for the internal Python medical report service (port 8001).
 *
 * The service is only reachable on loopback and requires the shared internal
 * token. Failures are translated into stable application errors: response
 * bodies from the Python service are never forwarded to the client, because
 * they can echo document content.
 */
import { AppError } from '../../middlewares/errorHandler';
import type {
  ExplainedReportPayload,
  ParsedReportPayload,
  ParsedTestPayload,
} from './report.types';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8001';
const DEFAULT_TIMEOUT_MS = 30_000;

export type ReportServiceErrorCode =
  | 'report_service_unavailable'
  | 'report_service_timeout'
  | 'report_service_rejected'
  | 'report_service_invalid_response';

export class ReportServiceError extends AppError {
  code: ReportServiceErrorCode;

  constructor(message: string, statusCode: number, code: ReportServiceErrorCode) {
    super(message, statusCode);
    this.code = code;
  }
}

const baseUrl = (): string =>
  (process.env.MEDICAL_REPORT_SERVICE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

const timeoutMs = (): number => {
  const configured = Number(process.env.MEDICAL_REPORT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
};

const internalHeaders = (): Record<string, string> => {
  const token = process.env.MEDICAL_REPORT_SERVICE_TOKEN;
  return token ? { 'X-Internal-Token': token } : {};
};

async function request(
  path: string,
  init: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(`${baseUrl()}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new ReportServiceError(
        'The medical report service took too long to respond. Please try again.',
        503,
        'report_service_timeout'
      );
    }
    throw new ReportServiceError(
      'The medical report service is not available right now. Please try again later.',
      503,
      'report_service_unavailable'
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Read a JSON body, without ever echoing it into an error message. */
async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ReportServiceError(
      response.status === 413
        ? 'The document is too large for the medical report service.'
        : 'The document could not be processed. Please check that it is a readable report.',
      422,
      'report_service_rejected'
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ReportServiceError(
      'The medical report service returned an unreadable response.',
      502,
      'report_service_invalid_response'
    );
  }
}

export interface ParseRequest {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  documentId: string;
}

/** Upload a document for OCR + parsing. The buffer is never written to disk. */
export async function parseDocument(input: ParseRequest): Promise<ParsedReportPayload> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
    input.filename
  );
  form.append('document_id', input.documentId);
  form.append('cross_verify', 'true');

  const response = await request(
    '/parse',
    { method: 'POST', body: form, headers: internalHeaders() },
    timeoutMs()
  );

  return readJson<ParsedReportPayload>(response);
}

interface ExplainResponse {
  success: boolean;
  provider: string;
  languages: string[];
  explanations: Record<'en' | 'hi', ExplainedReportPayload>;
}

/** English + Hindi explanations for an already parsed report. */
export async function explainParsedReport(
  payload: ParsedReportPayload
): Promise<Record<'en' | 'hi', ExplainedReportPayload>> {
  const response = await request(
    '/explain',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...internalHeaders() },
      body: JSON.stringify({
        document_id: payload.document_id ?? null,
        language: 'both',
        report: payload.report,
        tests: payload.tests,
        corrections: payload.corrections,
      }),
    },
    timeoutMs()
  );

  const body = await readJson<ExplainResponse>(response);
  if (!body.explanations?.en || !body.explanations?.hi) {
    throw new ReportServiceError(
      'The medical report service returned incomplete explanations.',
      502,
      'report_service_invalid_response'
    );
  }
  return body.explanations;
}

export interface CorrectionInput {
  index: number;
  field: string;
  corrected: string | number;
  correctedBy: string;
  correctedAt: string;
  note?: string | null;
  canonicalId?: string | null;
}

interface CorrectResponse {
  success: boolean;
  tests: ParsedTestPayload[];
  applied: { index: number; field: string; original: unknown; corrected: unknown }[];
  applied_count: number;
  warnings: string[];
  explanations: Record<'en' | 'hi', ExplainedReportPayload>;
}

/** Deterministically re-classify corrected results and regenerate explanations. */
export async function correctParsedReport(
  payload: ParsedReportPayload,
  corrections: CorrectionInput[]
): Promise<CorrectResponse> {
  const response = await request(
    '/correct',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...internalHeaders() },
      body: JSON.stringify({
        document_id: payload.document_id ?? null,
        language: 'both',
        report: payload.report,
        tests: payload.tests,
        corrections: corrections.map((item) => ({
          index: item.index,
          field: item.field,
          corrected: item.corrected,
          corrected_by: item.correctedBy,
          corrected_at: item.correctedAt,
          note: item.note ?? null,
          canonical_id: item.canonicalId ?? null,
        })),
      }),
    },
    timeoutMs()
  );

  return readJson<CorrectResponse>(response);
}

/** Readiness probe used by the health check; never throws. */
export async function reportServiceHealth(): Promise<boolean> {
  try {
    const response = await request('/health', { method: 'GET' }, 3_000);
    return response.ok;
  } catch {
    return false;
  }
}
