/**
 * Simplified bilingual PDF export.
 *
 * HTML is rendered by a real Chromium text shaper so Devanagari matras and
 * conjuncts come out correctly; a pure-JS PDF writer cannot do that reliably.
 * Every value that reaches the HTML is escaped first.
 */
import puppeteer, { type Browser, type ChromeReleaseChannel } from 'puppeteer';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type { JwtPayload } from '../../utils/jwt';
import { loadReportForUser } from './report.access';
import { auditDetail, writeAudit } from './report.audit.service';
import { toDetailDto } from './report.mapper';

type DetailDto = ReturnType<typeof toDetailDto>;
type TestDto = DetailDto['tests'][number];

let browserPromise: Promise<Browser> | null = null;

const LAUNCH_ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];

/**
 * Browsers to try, in order.
 *
 * `MEDICAL_REPORT_PDF_CHANNEL` pins one explicitly (for example `msedge`);
 * otherwise the bundled Chromium is tried first and the installed Chrome or
 * Edge is used when the bundled binary cannot run. Managed Windows machines
 * often block executables downloaded into the user profile.
 */
function channelCandidates(): (ChromeReleaseChannel | undefined)[] {
  const configured = process.env.MEDICAL_REPORT_PDF_CHANNEL?.trim() as
    | ChromeReleaseChannel
    | undefined;
  const candidates: (ChromeReleaseChannel | undefined)[] = [];
  if (configured) candidates.push(configured);
  candidates.push(undefined, 'chrome' as ChromeReleaseChannel, 'msedge' as ChromeReleaseChannel);
  return candidates;
}

async function launchBrowser(): Promise<Browser> {
  let lastError: unknown = null;
  for (const channel of channelCandidates()) {
    try {
      const options: Parameters<typeof puppeteer.launch>[0] = {
        headless: true,
        args: LAUNCH_ARGS,
      };
      if (channel) options.channel = channel;
      return await puppeteer.launch(options);
    } catch (error) {
      lastError = error;
    }
  }
  const failure = new AppError('PDF rendering is not available on this server.', 503);
  if (lastError instanceof Error) {
    // Kept on the error object for local diagnosis; never sent to a client.
    (failure as Error & { cause?: unknown }).cause = lastError;
  }
  throw failure;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }
  try {
    return await browserPromise;
  } catch (error) {
    browserPromise = null;
    throw error;
  }
}

/** Release the shared browser (used by tests and graceful shutdown). */
export async function closePdfRenderer(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    // Already gone.
  }
}

export function escapeHtml(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const list = (items: string[] | undefined): string =>
  items && items.length > 0
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';

function renderTest(test: TestDto): string {
  const value = [test.value.raw ?? '', test.value.unit ?? ''].join(' ').trim();
  const reference = test.reference.text ?? '—';
  const en = test.explanations.en as Record<string, unknown> | null;
  const hi = test.explanations.hi as Record<string, unknown> | null;

  const statusEn = (en?.status_label as string | undefined) ?? test.status;
  const statusHi = (hi?.status_label as string | undefined) ?? '';
  const resultLineEn = (en?.result_line as string | undefined) ?? '';
  const resultLineHi = (hi?.result_line as string | undefined) ?? '';
  const noteEn = (en?.status_text as string | undefined) ?? '';
  const noteHi = (hi?.status_text as string | undefined) ?? '';

  return `
    <section class="test ${test.needsReview ? 'needs-review' : ''}">
      <header>
        <h3>${escapeHtml(test.name)}</h3>
        <span class="status">${escapeHtml(statusEn)}${statusHi ? ` · <span class="hi">${escapeHtml(statusHi)}</span>` : ''}</span>
      </header>
      <table class="facts">
        <tr><th>Result</th><td>${escapeHtml(value || 'Not printed')}</td></tr>
        <tr><th>Printed reference</th><td>${escapeHtml(reference)}</td></tr>
        ${test.extracted.value !== null && test.corrected ? `<tr><th>Originally extracted</th><td>${escapeHtml(test.extracted.value)} ${escapeHtml(test.extracted.unit ?? '')}</td></tr>` : ''}
      </table>
      ${test.needsReview ? `<p class="warn">This result could not be read reliably. It is <strong>not</strong> a verified finding — please check it against the printed report.</p>` : ''}
      ${test.corrected ? '<p class="corrected">Manually verified and corrected.</p>' : ''}
      ${resultLineEn ? `<p>${escapeHtml(resultLineEn)}</p>` : ''}
      ${noteEn ? `<p>${escapeHtml(noteEn)}</p>` : ''}
      ${resultLineHi ? `<p class="hi">${escapeHtml(resultLineHi)}</p>` : ''}
      ${noteHi ? `<p class="hi">${escapeHtml(noteHi)}</p>` : ''}
      ${list((en?.review_reasons as string[] | undefined) ?? [])}
    </section>`;
}

export function buildReportHtml(report: DetailDto): string {
  const summaryEn = report.summary.en as Record<string, unknown> | null;
  const summaryHi = report.summary.hi as Record<string, unknown> | null;

  const disclaimers = [
    ...((summaryEn?.disclaimers as string[] | undefined) ?? []),
    ...((summaryHi?.disclaimers as string[] | undefined) ?? []),
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>SwasthSetu medical report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", "Nirmala UI", "Noto Sans Devanagari", "Mangal", sans-serif; color: #16221c; font-size: 11.5pt; line-height: 1.45; margin: 0; }
  .hi { font-family: "Nirmala UI", "Noto Sans Devanagari", "Mangal", sans-serif; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  h2 { font-size: 13pt; margin: 18px 0 6px; border-bottom: 1px solid #cfd8d2; padding-bottom: 3px; }
  h3 { font-size: 12pt; margin: 0; }
  header.meta { color: #4b5a51; font-size: 10pt; }
  .test { border: 1px solid #dde5df; border-radius: 6px; padding: 9px 11px; margin: 9px 0; page-break-inside: avoid; }
  .test header { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
  .status { font-weight: 600; color: #22543d; text-align: right; }
  .test.needs-review { border-color: #d9a520; background: #fffaf0; }
  table.facts { width: 100%; border-collapse: collapse; margin: 5px 0; }
  table.facts th { text-align: left; width: 32%; color: #4b5a51; font-weight: 600; vertical-align: top; }
  table.facts td { vertical-align: top; }
  .warn { color: #8a5a00; font-weight: 600; }
  .corrected { color: #1f5f8b; }
  .footnote { color: #4b5a51; font-size: 9.5pt; margin-top: 6px; }
  ul { margin: 4px 0 4px 18px; padding: 0; }
  .notice { border-left: 3px solid #c05621; padding: 6px 10px; background: #fdf6ec; margin: 12px 0; }
</style>
</head>
<body>
  <h1>${escapeHtml(report.title ?? 'Medical report summary')}</h1>
  <header class="meta">
    <div>Report type: ${escapeHtml(report.reportType ?? 'Not identified')}</div>
    <div>Report date: ${escapeHtml(report.reportDate ? new Date(report.reportDate).toISOString().slice(0, 10) : 'Not printed')}</div>
    <div>Prepared: ${escapeHtml(new Date().toISOString().slice(0, 16).replace('T', ' '))}</div>
  </header>

  <div class="notice">
    This is an explanation of the printed results, not a diagnosis. It does not replace advice from a qualified doctor.
    <span class="hi">यह रिपोर्ट की समझ है, कोई निदान नहीं। कृपया डॉक्टर से सलाह अवश्य लें।</span>
  </div>

  ${report.needsReviewCount > 0 ? `<div class="notice">${escapeHtml(String(report.needsReviewCount))} result(s) need manual verification and are marked below.</div>` : ''}

  ${summaryEn ? `<h2>Summary</h2><p>${escapeHtml(summaryEn.overview ?? '')}</p>${list(summaryEn.key_points as string[] | undefined)}${list(summaryEn.next_steps as string[] | undefined)}` : ''}
  ${summaryHi ? `<h2 class="hi">सारांश</h2><p class="hi">${escapeHtml(summaryHi.overview ?? '')}</p><div class="hi">${list(summaryHi.key_points as string[] | undefined)}</div><div class="hi">${list(summaryHi.next_steps as string[] | undefined)}</div>` : ''}

  <h2>Results</h2>
  ${report.tests.map(renderTest).join('\n')}

  <h2>Notices</h2>
  ${list(disclaimers)}
  <p class="footnote">Generated by SwasthSetu. The original uploaded document is not stored. Reference ranges shown are the ones printed on the report.</p>
</body>
</html>`;
}

export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  if (!browser.connected) {
    browserPromise = null;
  }
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(25_000);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '13mm', right: '13mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function exportReportPdf(
  user: JwtPayload,
  reportId: string,
  requestId?: string
): Promise<{ buffer: Buffer; filename: string }> {
  await loadReportForUser(user, reportId, 'view');

  const report = await prisma.medicalReport.findUnique({
    where: { id: reportId },
    include: {
      tests: true,
      explanations: true,
      corrections: true,
      shares: { include: { user: { select: { email: true } } } },
      patient: { select: { id: true, fullName: true, userId: true } },
    },
  });
  if (!report) throw new AppError('Medical report not found', 404);
  if (report.status !== 'COMPLETED') {
    throw new AppError('Only a processed report can be exported.', 409);
  }

  const buffer = await renderPdf(buildReportHtml(toDetailDto(report)));

  await writeAudit({
    action: 'EXPORT',
    reportId,
    actor: user,
    detail: auditDetail({ format: 'pdf', bytes: buffer.length }),
    ...(requestId ? { requestId } : {}),
  });

  return { buffer, filename: `swasthsetu-report-${reportId}.pdf` };
}
