interface Props {
  light?: boolean;
}

export default function Logo({ light = false }: Props) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          light ? 'bg-white/15 text-white' : 'bg-blue-600 text-white'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M3 18h18" />
          <path d="M5 18c0-5.5 3-9 7-9s7 3.5 7 9" />
          <path d="M12 9V4M9.5 6.5h5" />
        </svg>
      </span>
      <span
        className={`text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}
      >
        SwasthSetu
      </span>
    </span>
  );
}