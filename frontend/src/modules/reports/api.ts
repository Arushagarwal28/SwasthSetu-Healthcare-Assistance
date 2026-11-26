/**
 * Medical Report Simplifier API client.
 *
 * Uses the shared axiosClient, so the access token, the single-flight refresh
 * and the redirect-to-login behaviour are all inherited from the rest of the
 * application. Every response has the project's { success, data } envelope.
 */
import axiosClient from '../../api/axiosClient';
import type {
  AdminReportStats,
  CompareResult,
  ReportTypeOption,
  StaffTargetResponse,
  CorrectionRequestItem,
  ExplanationLanguage,
  ReportDetailDto,
  ReportListFilters,
  ReportListResponse,
  UploadReportInput,
} from './types';

const BASE = '/reports';

export const fetchReports = async (
  filters: ReportListFilters = {},
): Promise<ReportListResponse> => {
  const res = await axiosClient.get(BASE, {
    params: {
      q: filters.q || undefined,
      status: filters.status,
      reportType: filters.reportType || undefined,
      patientId: filters.patientId,
      from: filters.from,
      to: filters.to,
      needsReview: filters.needsReview === undefined ? undefined : String(filters.needsReview),
      sort: filters.sort,
      order: filters.order,
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });

  return {
    items: (res.data.data ?? []) as ReportListResponse['items'],
    pagination: res.data.pagination as ReportListResponse['pagination'],
  };
};

/**
 * Complete report-type filter options for the reports this user may see.
 *
 * Derived on the server, so a patient with hundreds of reports still gets every
 * type rather than whatever happened to be on the first page.
 */
export const fetchReportTypes = async (): Promise<ReportTypeOption[]> => {
  const res = await axiosClient.get(`${BASE}/report-types`);
  return (res.data.data ?? []) as ReportTypeOption[];
};

/**
 * Search active hospital staff accounts to share a report with.
 *
 * Requires at least two characters; the endpoint is paginated and rate limited
 * server-side and only ever returns an account id, its email and its facilities.
 */
export const searchShareTargets = async (
  query: string,
  page = 1,
): Promise<StaffTargetResponse> => {
  const res = await axiosClient.get(`${BASE}/share-targets`, {
    params: { q: query, page },
  });
  return {
    items: (res.data.data ?? []) as StaffTargetResponse['items'],
    pagination: res.data.pagination as StaffTargetResponse['pagination'],
  };
};

export const fetchReport = async (reportId: string): Promise<ReportDetailDto> => {
  const res = await axiosClient.get(`${BASE}/${reportId}`);
  return res.data.data as ReportDetailDto;
};

/** Upload is multipart; parsing + explanation happen before the response. */
export const uploadReport = async (
  input: UploadReportInput,
  onProgress?: (percent: number | null) => void,
): Promise<ReportDetailDto> => {
  const form = new FormData();
  form.append('file', input.file);
  form.append('patientId', input.patientId);
  if (input.title) form.append('title', input.title);
  if (input.reportDate) form.append('reportDate', input.reportDate);
  if (input.language) form.append('language', input.language);

  const res = await axiosClient.post(BASE, form, {
    timeout: 180_000,
    onUploadProgress: (event) => {
      if (!event.total) {
        onProgress?.(null);
        return;
      }
      onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    },
  });

  return res.data.data as ReportDetailDto;
};

export const applyCorrections = async (
  reportId: string,
  corrections: CorrectionRequestItem[],
): Promise<ReportDetailDto> => {
  const res = await axiosClient.post(`${BASE}/${reportId}/corrections`, { corrections });
  return res.data.data as ReportDetailDto;
};

export const deleteReport = async (reportId: string): Promise<void> => {
  await axiosClient.delete(`${BASE}/${reportId}`);
};

export const shareReport = async (
  reportId: string,
  userId: string,
  expiresAt?: string,
): Promise<void> => {
  await axiosClient.post(`${BASE}/${reportId}/share`, {
    userId,
    expiresAt: expiresAt || undefined,
  });
};

export const revokeShare = async (reportId: string, userId: string): Promise<void> => {
  await axiosClient.delete(`${BASE}/${reportId}/share/${userId}`);
};

export const compareReports = async (reportIds: string[]): Promise<CompareResult> => {
  const res = await axiosClient.post(`${BASE}/compare`, { reportIds });
  return res.data.data as CompareResult;
};

/**
 * The PDF is a single bilingual document (English and Hindi side by side),
 * rendered server-side by a real text shaper so Devanagari is correct.
 */
export const downloadReportPdf = async (
  reportId: string,
): Promise<void> => {
  const res = await axiosClient.get(`${BASE}/${reportId}/export.pdf`, {
    responseType: 'blob',
    timeout: 120_000,
  });

  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `swasthsetu-report-${reportId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const fetchAdminStats = async (days = 90): Promise<AdminReportStats> => {
  const res = await axiosClient.get(`${BASE}/admin/stats`, { params: { days } });
  return res.data.data as AdminReportStats;
};

/** The signed-in patient's own record, used as the upload target. */
export const fetchMyPatientId = async (): Promise<string | null> => {
  const res = await axiosClient.get('/patients/me');
  const id = (res.data?.data as { id?: string } | undefined)?.id;
  return id ?? null;
};

export type { ExplanationLanguage };
