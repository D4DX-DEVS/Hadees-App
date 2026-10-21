/** Turns any thrown value into a short message for the user. Technical detail stays in the console only. */
export function friendlyError(e: unknown): string {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[app]', e);
  const m = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
  if (/network|fetch|internet|timeout|timed out|statement timeout|connection|offline/.test(m)) {
    return 'No internet connection, or the server is slow. Please check your connection and try again.';
  }
  if (/not found|404|no rows/.test(m)) return 'We could not find that. It may have been moved or removed.';
  return 'Something went wrong. Please try again.';
}
