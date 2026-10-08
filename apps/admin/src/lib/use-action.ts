import { useReducer } from "react";

type State = { pending: string | null; error: string | null };
type Event = { type: "start"; key: string } | { type: "done" } | { type: "fail"; error: string };

function reducer(_: State, event: Event): State {
  switch (event.type) {
    case "start":
      return { pending: event.key, error: null };
    case "done":
      return { pending: null, error: null };
    case "fail":
      return { pending: null, error: event.error };
  }
}

/**
 * Runs one admin action at a time: `pending` is the key of the running one
 * (so only its button shows busy) and `error` the last failure's message,
 * shown by the page until the next action.
 */
export function useAction() {
  const [state, dispatch] = useReducer(reducer, { pending: null, error: null });
  async function run(key: string, action: () => Promise<unknown>): Promise<boolean> {
    dispatch({ type: "start", key });
    try {
      await action();
      dispatch({ type: "done" });
      return true;
    } catch (error) {
      dispatch({ type: "fail", error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
  return { run, ...state };
}
