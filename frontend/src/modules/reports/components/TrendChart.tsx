import type { ComparePoint } from '../types';
import { formatReportDate, TEST_STATUS_STYLE } from '../labels';

interface Props {
  testName: string;
  unit: string | null;
  points: ComparePoint[];
}

const WIDTH = 340;
const HEIGHT = 150;
const PAD = { top: 18, right: 12, bottom: 28, left: 38 };

/**
 * Trend for one test across dated reports.
 *
 * The chart is decoration over a real table: every plotted number is also
 * printed below, so the trend is readable without colour or vision. Points are
 * already guaranteed by the server to share a test, a unit and a printed date.
 */
export default function TrendChart({ testName, unit, points }: Props) {
  const plotted = points.filter(
    (point): point is ComparePoint & { value: number } => typeof point.value === 'number',
  );

  if (plotted.length < 2) {
    return (
      <p className="text-sm text-slate-600">
        Only one numeric reading is available, so no trend line is drawn.
      </p>
    );
  }

  const values = plotted.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max), 1) * 0.2;
  const low = min - spread * 0.3;
  const high = max + spread * 0.3;

  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (index * innerWidth) / Math.max(1, plotted.length - 1);
  const y = (value: number) =>
    PAD.top + (1 - (value - low) / (high - low)) * innerHeight;

  const format = (value: number) =>
    Math.abs(value) >= 100 ? value.toFixed(0) : String(Number(value.toFixed(2)));

  const first = plotted[0];
  const last = plotted[plotted.length - 1];
  const delta = Number((last.value - first.value).toFixed(2));
  const changeText =
    delta === 0 ? 'no change' : `${delta > 0 ? 'higher' : 'lower'} by ${format(Math.abs(delta))}`;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${testName} trend across ${plotted.length} reports`}
        className="w-full max-w-md"
      >
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={HEIGHT - PAD.bottom}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        <line
          x1={PAD.left}
          y1={HEIGHT - PAD.bottom}
          x2={WIDTH - PAD.right}
          y2={HEIGHT - PAD.bottom}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" fontSize="9" fill="#64748b">
          {format(max)}
        </text>
        <text
          x={PAD.left - 6}
          y={HEIGHT - PAD.bottom}
          textAnchor="end"
          fontSize="9"
          fill="#64748b"
        >
          {format(min)}
        </text>

        <polyline
          points={plotted.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {plotted.map((point, index) => (
          <g key={`${point.reportId}-${index}`}>
            <circle cx={x(index)} cy={y(point.value)} r="3.5" fill="#fff" stroke="#1d4ed8" strokeWidth="2" />
            <text
              x={x(index)}
              y={y(point.value) - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#334155"
            >
              {format(point.value)}
            </text>
          </g>
        ))}

        <text
          x={PAD.left}
          y={HEIGHT - 8}
          textAnchor="start"
          fontSize="9"
          fill="#64748b"
        >
          {formatReportDate(first.reportDate)}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 8}
          textAnchor="end"
          fontSize="9"
          fill="#64748b"
        >
          {formatReportDate(last.reportDate)}
        </text>
      </svg>

      <figcaption className="mt-1 text-xs text-slate-600">
        {format(first.value)} → {format(last.value)}
        {unit ? ` ${unit}` : ''} ({changeText}) between{' '}
        {formatReportDate(first.reportDate)} and {formatReportDate(last.reportDate)}.
      </figcaption>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Printed values used in this trend</caption>
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Report date
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Value
              </th>
              <th scope="col" className="py-1.5 font-medium">
                Status on that report
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {points.map((point) => (
              <tr key={point.reportId}>
                <td className="py-1.5 pr-3 text-slate-700">{formatReportDate(point.reportDate)}</td>
                <td className="py-1.5 pr-3 text-slate-900">
                  {typeof point.value === 'number'
                    ? `${format(point.value)}${point.unit ? ` ${point.unit}` : ''}`
                    : 'Not a number'}
                </td>
                <td className="py-1.5 text-slate-700">
                  {TEST_STATUS_STYLE[point.status]?.glyph ?? ''} {TEST_STATUS_STYLE[point.status]?.en ?? point.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
