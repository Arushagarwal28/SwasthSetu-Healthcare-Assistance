/** Pulls the most useful message out of the backend's error envelope. */
export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as {
    response?: { data?: { error?: { message?: string; details?: { message?: string }[] } } };
  };
  const error = e?.response?.data?.error;
  return error?.details?.[0]?.message || error?.message || fallback;
};
