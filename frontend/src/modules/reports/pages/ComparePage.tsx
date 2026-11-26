import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { compareReports, fetchReports } from '../api';
import { COMPARE_EXCLUSION_REASON, formatReportDate, formatReportType } from '../labels';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import ErrorBlock from '../../../components/ui/ErrorBlock';
import Card from '../../../components/ui/Card';
import TrendChart from '../components/TrendChart';
import { useRemoteData } from '../useRemoteData';

interface Props {
  basePath: string;
}

const MAX_SELECTION = 5;

export default function ComparePage({ basePath }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const idsParam = searchParams.get('ids') ?? '';

  const [selection, setSelection] = useState<string[]>(() =>
    idsParam.split(',').filter(Boolean),
  );

  const loadCandidates = useCallback(
    async () =>
      (
        await fetchReports({ status: 'COMPLETED', pageSize: 50, sort: 'date', order: 'asc' })
      ).items,
    [],
  );

  const {
    loading: loadingList,
    data: candidatesData,
    error: listError,
    reload: reloadList,
  } = useRemoteData('candidates', loadCandidates, 'Could not load your reports.');

  const candidates = candidatesData ?? [];

  // The comparison is a resource keyed by the ids in the URL: changing the
  // selection changes the key, so the result and its loading state can never
  // belong to a different set of reports.
  const loadComparison = useCallback(async () => {
    const ids = idsParam.split(',').filter(Boolean);
    if (ids.length < 2) return null;
    return compareReports(ids);
  }, [idsParam]);

  const {
    loading: comparing,
    data: result,
    error: compareError,
    reload: reloadComparison,
  } = useRemoteData(
    `compare:${idsParam}`,
    loadComparison,
    'These reports could not be compared. Check that they are for the same patient and each has the date printed on it.',
  );

  const toggle = (id: string) => {
    setSelection((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_SELECTION) return current;
      return [...current, id];
    });
  };

  const startCompare = () => {
    if (selection.length < 2) return;
    const next = selection.join(',');
    if (next === idsParam) reloadComparison();
    else setSearchParams({ ids: next });
  };

  const datedCandidates = candidates.filter((report) => report.reportDate);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Compare reports</h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Only results with the same test and the same unit are compared, and only between reports
          that carry their own printed date. Everything else is listed as not comparable.
        </p>
      </div>

      <Card
        title="Choose reports"
        description={`Select 2 to ${MAX_SELECTION} reports for the same patient.`}
      >
        {loadingList && <p className="text-sm text-slate-500">Loading reports…</p>}

        {!loadingList && datedCandidates.length < 2 && (
          <EmptyState
            title="Not enough dated reports yet"
            description="Comparison needs at least two processed reports with the date printed on them. Add the report date when uploading so the reports can be lined up in time."
          />
        )}

        {!loadingList && datedCandidates.length >= 2 && (
          <>
            <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {datedCandidates.map((report) => {
                const checked = selection.includes(report.id);
                const disabled = !checked && selection.length >= MAX_SELECTION;
                return (
                  <li key={report.id}>
                    <label
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                        checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200'
                      } ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(report.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">
                          {report.title || `${formatReportType(report.reportType)} report`}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {formatReportType(report.reportType)} · report dated{' '}
                          {formatReportDate(report.reportDate)} · {report.testCount} results
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={startCompare}
                disabled={selection.length < 2}
                loading={comparing}
                loadingText="Comparing…"
              >
                Compare {selection.length > 0 ? `${selection.length} reports` : ''}
              </Button>
              <span className="text-xs text-slate-500">
                {selection.length} of {MAX_SELECTION} selected
              </span>
            </div>
          </>
        )}
      </Card>

      {listError && <ErrorBlock message={listError} onRetry={reloadList} />}

      {compareError && <ErrorBlock message={compareError} onRetry={reloadComparison} />}

      {result && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Reports in this comparison</p>
            <ul className="mt-1 space-y-0.5">
              {result.reports.map((report) => (
                <li key={report.id}>
                  {formatReportDate(report.reportDate)} · {formatReportType(report.reportType)}
                </li>
              ))}
            </ul>
          </div>

          {result.comparisons.length === 0 && (
            <EmptyState
              title="No results can be compared"
              description="These reports do not share a test with the same unit. The reason for each result is listed below."
            />
          )}

          <div className="space-y-4">
            {result.comparisons.map((comparison) => (
              <Card key={comparison.canonicalId}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium text-slate-900">{comparison.test}</h3>
                  <p className="text-xs text-slate-500">
                    {comparison.unit ? `Unit: ${comparison.unit} · ` : ''}
                    {comparison.daysBetween} day{comparison.daysBetween === 1 ? '' : 's'} between the
                    first and last report
                  </p>
                </div>
                <TrendChart
                  testName={comparison.test}
                  unit={comparison.unit}
                  points={comparison.points}
                />
              </Card>
            ))}
          </div>

          {result.excluded.length > 0 && (
            <Card title="Not compared" description="These results were left out rather than plotted on a misleading scale.">
              <ul className="divide-y divide-slate-100 text-sm">
                {result.excluded.map((item) => (
                  <li key={`${item.test}-${item.reason}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
                    <span className="text-slate-800">{item.test}</span>
                    <span className="text-xs text-slate-500">
                      {COMPARE_EXCLUSION_REASON[item.reason] ?? item.reason.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <p>{result.note}</p>
            <p className="mt-1">
              A rise or fall between two printed results is not by itself a diagnosis. Ask your
              doctor what the change means for you.
            </p>
          </div>
        </>
      )}

      <p className="text-xs text-slate-500">
        Looking for a specific report?{' '}
        <Link to={`${basePath}/history`} className="font-medium text-blue-700 hover:underline">
          Open the report history
        </Link>
        .
      </p>
    </div>
  );
}
