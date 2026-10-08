import { useReducer } from "react";
import { type DescribedError, describeError } from "#lib/errors";

type State = { pending: string | null; error: DescribedError | null };
type Event =
  | { type: "start"; key: string }
  | { type: "done" }
  | { type: "fail"; error: DescribedError }
  | { type: "dismiss" };

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case "start":
      return { pending: event.key, error: null };
    case "done":
      return { pending: null, error: null };
    case "fail":
      return { pending: null, error: event.error };
    case "dismiss":
      return { ...state, error: null };
  }
}

/**
 * Runs one admin action at a time: `pending` is the key of the running one
 * (so only its button shows busy) and `error` the last failure, explained,
 * until the next action or `dismiss()`. `run` resolves to that failure, or
 * null on success, so a page can react (refetch after "not found").
 */
export function useAction() {
  const [state, dispatch] = useReducer(reducer, { pending: null, error: null });
  async function run(key: string, action: () => Promise<unknown>): Promise<DescribedError | null> {
    dispatch({ type: "start", key });
    try {
      await action();
      dispatch({ type: "done" });
      return null;
    } catch (error) {
      const described = describeError(error);
      dispatch({ type: "fail", error: described });
      return described;
    }
  }
  return { run, dismiss: () => dispatch({ type: "dismiss" }), ...state };
}
