/**
 * Unread-notification badge for the vaccination module header.
 *
 * Polls GET /vaccination/notifications/unread-count every minute (and re-checks
 * after every navigation, so returning from the notifications page clears it).
 * Polling failures stay silent: a decorative badge must never break a page.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getUnreadNotificationCount } from '../../api/vaccination';

interface Props {
  /** Usually the module's own basePath. Derived from the URL when omitted. */
  basePath?: string;
}

const POLL_MS = 60_000;

export default function NotificationBell({ basePath }: Props) {
  const location = useLocation();
  const match = /(\/[^/]+\/vaccination)(?=\/|$)/.exec(location.pathname);
  const base = basePath ?? match?.[1] ?? '';

  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      getUnreadNotificationCount()
        .then((count) => {
          if (!cancelled) setUnread(count);
        })
        .catch(() => {
          /* leave the last known count in place */
        });
    };

    tick();
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  const label =
    unread === null
      ? 'Notifications'
      : unread === 0
        ? 'Notifications, nothing unread'
        : `Notifications, ${unread} unread`;

  return (
    <Link
      to={`${base}/notifications`}
      aria-label={label}
      title={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4.5 w-4.5"
        style={{ height: '1.125rem', width: '1.125rem' }}
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M13.7 21a2 2 0 01-3.4 0" />
      </svg>
      {unread !== null && unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-[1.15rem] text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}