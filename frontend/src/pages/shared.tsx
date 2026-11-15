import { useEffect, useState } from "react";
import { call, type Item } from "../Workflows";
import { useStore } from "../store";
export type Row = Item & {
  resume_id?: string;
  project_id?: string | null;
  metadata?: Record<string, any>;
  submission_verified?: boolean;
};
export function parse(row: Row) {
  try {
    return JSON.parse(row.content);
  } catch {
    return null;
  }
}
export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useRows(kind: string) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      setRows(await call("career/" + kind));
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [kind]);
  return { rows, error, setError, loading, load };
}
export function Status({ state }: { state: ReturnType<typeof useRows> }) {
  return (
    <>
      {state.loading && <p role="status">Loading saved work…</p>}
      {state.error && (
        <p role="alert">
          {state.error}
          <button onClick={() => void state.load()}>Retry loading</button>
        </p>
      )}
    </>
  );
}
export function ModelNotice() {
  const loaded = useStore((s) => s.status?.engine.loaded);
  const open = useStore((s) => s.openSettings);
  return !loaded ? (
    <div className="connection-note">
      <strong>Local model disconnected.</strong>
      <p>
        Writing and feedback actions require a loaded model. Your saved work
        remains available.
      </p>
      <button onClick={() => open("models")}>Configure local model</button>
    </div>
  ) : (
    <p className="connection-note">
      Connected local model · AI suggestions require your review.
    </p>
  );
}
