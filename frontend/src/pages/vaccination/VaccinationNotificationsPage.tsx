/**
 * In-app vaccination notifications for the signed-in user.
 *
 * GET /vaccination/notifications is per-user: the backend filters by the token's
 * user id, so this page never has to pass or prove who the user is. There are no
 * socket events for these, so the list refreshes on a 60-second poll (silently —
 * no spinner stealing the page) and immediately after any read action.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/vaccination';
import { getApiErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/date';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBlock from '../../components/ui/ErrorBlock';
import Spinner from '../../components/ui/Spinner';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  /** ISO timestamp, or null while unread. */
  readAt: string | null;
  /** ISO timestamp. */
  createdAt: string;
  doseId: string | null;
  child: { id: string; fullName: string; recordNumber: string };
}

interface NotificationPayload {
  total: number;
  unread: number;
  page: number;
  limit: number;
  items: NotificationItem[];
}

const PAGE_SIZE = 20;
const POLL_MS = 60_000;

export default function VaccinationNotificationsPage() {
  // /helper/vaccination/notifications -> /helper/vaccination
  const basePath = useLocation().pathname.replace(/\/notifications\/?$/, '');

  const [data, setData] = useState<NotificationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const payload = await listNotifications({
          unread: unreadOnly ? true : undefined,
          page,
          limit: PAGE_SIZE,
        });
        setData(payload as unknown as NotificationPayload);
        setError('');
      } catch (err: unknown) {
        // A failed silent poll keeps the last good list on screen.
        if (!silent) {
          setError(
            getApiErrorMessage(
              err,
              'Could not load your notifications. Please check your connection and try again.',
            ),
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [unreadOnly, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Poll quietly; the backend has no push channel for these notifications.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Coming back to the tab should not show a stale count.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const changeFilter = (next: boolean) => {
    setUnreadOnly(next);
    setPage(1);
    setNotice('');
  };

  const markRead = async (id: string) => {
    setBusyId(id);
    setActionError('');
    setNotice('');
    try {
      await markNotificationRead(id);
      await load(true);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Could not mark that notification as read.'));
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    setActionError('');
    setNotice('');
    try {
      const marked = await markAllNotificationsRead();
      setNotice(marked === 0 ? 'Everything was already read.' : `Marked ${marked} as read.`);
      await load(true);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Could not mark your notifications as read.'));
    } finally {
      setMarkingAll(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const unread = data ? data.unread : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Reminders and updates about the children you look after.
            {unread > 0 ? ` ${unread} unread.` : ' Nothing unread.'} Updates automatically.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void markAll()}
          loading={markingAll}
          loadingText="Marking…"
          disabled={unread === 0}
        >
          Mark all as read
        </Button>
      </div>

      <div className="flex items-center gap-2" role="group" aria-label="Filter notifications">
        <button
          type="button"
          onClick={() => changeFilter(false)}
          aria-pressed={!unreadOnly}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            !unreadOnly
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => changeFilter(true)}
          aria-pressed={unreadOnly}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            unreadOnly
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Unread
          {unread > 0 && (
            <span className={`ml-1.5 text-xs ${unreadOnly ? 'text-blue-100' : 'text-slate-500'}`}>
              {unread}
            </span>
          )}
        </button>
      </div>

      {actionError !== '' && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {notice !== '' && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {loading && !data && <Spinner label="Loading notifications…" />}

      {error !== '' && (
        <Card>
          <ErrorBlock message={error} onRetry={() => void load()} />
        </Card>
      )}

      {!error && data && data.items.length === 0 && (
        <EmptyState
          title={unreadOnly ? 'You are all caught up' : 'No notifications yet'}
          description={
            unreadOnly
              ? 'There is nothing unread right now.'
              : 'Reminders about due and overdue doses will appear here.'
          }
          action={
            unreadOnly ? (
              <Button variant="secondary" onClick={() => changeFilter(false)}>
                Show all
              </Button>
            ) : (
              <Link
                to={`${basePath}/worklist`}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Open the worklist
              </Link>
            )
          }
        />
      )}

      {!error && data && data.items.length > 0 && (
        <>
          <p className="text-xs text-slate-500" aria-live="polite">
            {data.total} notification{data.total === 1 ? '' : 's'}
            {unreadOnly ? ' unread' : ''}
          </p>

          <ul role="list" className="space-y-3">
            {data.items.map((item) => (
              <li
                key={item.id}
                className={`rounded-xl border p-4 shadow-sm ${
                  item.readAt ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.readAt ? 'bg-slate-300' : 'bg-blue-600'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                    </div>

                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{item.body}</p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                      <Link
                        to={`${basePath}/children/${item.child.id}`}
                        className="font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                      >
                        {item.child.fullName} · {item.child.recordNumber}
                      </Link>

                      {item.readAt ? (
                        <span className="text-slate-400">Read {formatDateTime(item.readAt)}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void markRead(item.id)}
                          disabled={busyId === item.id}
                          className="font-medium text-slate-600 underline hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded disabled:opacity-50"
                        >
                          {busyId === item.id ? 'Marking…' : 'Mark as read'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                disabled={data.page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <p className="text-xs text-slate-500">
                Page {data.page} of {totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={data.page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}