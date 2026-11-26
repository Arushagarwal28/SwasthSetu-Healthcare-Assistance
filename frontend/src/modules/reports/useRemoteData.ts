/**
 * Small data-loading hook used by the report screens.
 *
 * React's lint rules (rightly) reject a synchronous `setLoading(true)` inside an
 * effect. Instead of that pattern, the hook stores the answer together with the
 * request key it belongs to and derives "loading" by comparing that key with the
 * one the current render needs:
 *
 *   loading = entry.key !== requestKey
 *
 * The effect only ever writes state from a promise callback, so a slow request
 * can never show the previous report's data under a new filter, and changing a
 * filter switches to the loading state without an extra render pass.
 */
import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../utils/errors';

interface Entry<T> {
  key: string;
  data: T | null;
  error: string;
  /** Wall-clock time of the response, for expiry checks during render. */
  at: number;
}

export interface RemoteData<T> {
  loading: boolean;
  data: T | null;
  error: string;
  loadedAt: number;
  /** Re-run the request with the same key (retry button). */
  reload: () => void;
  /** Replace the loaded value locally (after a correction, for example). */
  mutate: (update: (current: T | null) => T | null) => void;
}

export function useRemoteData<T>(
  key: string,
  load: () => Promise<T>,
  fallbackMessage: string,
): RemoteData<T> {
  const [entry, setEntry] = useState<Entry<T>>({ key: '', data: null, error: '', at: 0 });
  const [nonce, setNonce] = useState(0);
  const requestKey = `${key}#${nonce}`;

  useEffect(() => {
    let active = true;

    load().then(
      (data) => {
        if (active) setEntry({ key: requestKey, data, error: '', at: Date.now() });
      },
      (error: unknown) => {
        if (active) {
          setEntry({
            key: requestKey,
            data: null,
            error: getApiErrorMessage(error, fallbackMessage),
            at: Date.now(),
          });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [requestKey, load, fallbackMessage]);

  const reload = useCallback(() => setNonce((current) => current + 1), []);

  const mutate = useCallback((update: (current: T | null) => T | null) => {
    setEntry((current) => ({ ...current, data: update(current.data) }));
  }, []);

  const ready = entry.key === requestKey;

  return {
    loading: !ready,
    data: ready ? entry.data : null,
    error: ready ? entry.error : '',
    loadedAt: entry.at,
    reload,
    mutate,
  };
}
