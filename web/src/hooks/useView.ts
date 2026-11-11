import { useEffect, useState } from "react";
import { view } from "../chain/rpc";

export interface ViewState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/** A contract view, refreshed every `refreshMs` when given. Keeps the last good value on error. */
export function useView<T>(method: string, args: object = {}, refreshMs?: number): ViewState<T> {
  const key = JSON.stringify(args);
  const [state, setState] = useState<ViewState<T>>({ data: undefined, error: undefined, loading: true });

  useEffect(() => {
    let live = true;
    const load = () =>
      view<T>(method, JSON.parse(key))
        .then((data) => live && setState({ data, error: undefined, loading: false }))
        .catch((error: Error) => live && setState((s) => ({ ...s, error, loading: false })));
    load();
    const t = refreshMs ? setInterval(load, refreshMs) : undefined;
    return () => {
      live = false;
      if (t) clearInterval(t);
    };
  }, [method, key, refreshMs]);

  return state;
}
