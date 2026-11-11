import { useCallback, useEffect, useState } from "react";
import { view } from "../chain/rpc";

export interface ViewState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  /** Fetch again now. */
  reload(): void;
}

/** A contract view, refreshed every `refreshMs` when given. Keeps the last good value on error.
 * `args === null` skips the call (for views that need something not known yet). */
export function useView<T>(method: string, args: object | null = {}, refreshMs?: number): ViewState<T> {
  const key = args === null ? null : JSON.stringify(args);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<ViewState<T>, "reload">>({
    data: undefined,
    error: undefined,
    loading: key !== null,
  });
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (key === null) {
      setState({ data: undefined, error: undefined, loading: false });
      return;
    }
    let live = true;
    const load = () =>
      Promise.resolve()
        .then(() => view<T>(method, JSON.parse(key)))
        .then((data) => live && setState({ data, error: undefined, loading: false }))
        .catch((error: Error) => live && setState((s) => ({ ...s, error, loading: false })));
    load();
    const t = refreshMs ? setInterval(load, refreshMs) : undefined;
    return () => {
      live = false;
      if (t) clearInterval(t);
    };
  }, [method, key, refreshMs, tick]);

  return { ...state, reload };
}
