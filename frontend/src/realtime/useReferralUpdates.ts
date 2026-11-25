import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axiosClient from '../api/axiosClient';

export interface ReferralChangedEvent {
  kind: 'created' | 'updated';
  referralId: string;
  assessmentId: string;
  status: string;
}

// Socket server lives on the same origin as the REST API (…/api/v1 stripped).
const SOCKET_ORIGIN = new URL(import.meta.env.VITE_API_BASE_URL as string).origin;
const MAX_AUTH_RETRIES = 3;

/**
 * Calls `onChange` when a referral relevant to the logged-in user changes.
 * The event carries ids only — refetch through the REST API to get the data.
 * `onChange(null)` means the connection was re-established after a drop, so
 * anything may have been missed and the caller should refetch.
 */
export function useReferralUpdates(onChange: (event: ReferralChangedEvent | null) => void) {
  const handlerRef = useRef(onChange);
  useEffect(() => {
    handlerRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let authRetries = 0;
    let hasConnectedBefore = false;

    const socket = io(SOCKET_ORIGIN, {
      // Evaluated on every (re)connect, so a refreshed token is picked up.
      auth: (cb) => cb({ token: localStorage.getItem('accessToken') }),
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      authRetries = 0;
      if (hasConnectedBefore) handlerRef.current(null);
      hasConnectedBefore = true;
    });

    socket.on('referral:changed', (event: ReferralChangedEvent) => handlerRef.current(event));

    // Access tokens are short-lived. If the handshake is rejected for that
    // reason, one normal REST call lets the existing refresh interceptor renew
    // the token; then we reconnect with it.
    socket.on('connect_error', async (err) => {
      if (/token/i.test(err.message) && authRetries < MAX_AUTH_RETRIES) {
        authRetries += 1;
        try {
          await axiosClient.get('/auth/me');
          socket.connect();
        } catch {
          // session is gone; the app's normal auth handling takes over
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}