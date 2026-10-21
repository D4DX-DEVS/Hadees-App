import { DependencyList, useCallback, useEffect, useState } from 'react';

/**
 * Load async data keyed by `deps`. `loading` is derived (no setState inside the effect body),
 * stale responses are ignored, and `reload()` re-runs the loader.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(deps) + ':' + nonce;
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown }>({ key: '' });

  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setState({ key, data }),
      (error) => alive && setState({ key, error }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const fresh = state.key === key;
  return {
    data: fresh ? state.data : undefined,
    error: fresh ? state.error : undefined,
    loading: !fresh,
    reload,
  };
}
