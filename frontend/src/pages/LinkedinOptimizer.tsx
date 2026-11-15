import { useState } from "react";
import { call } from "../Workflows";
import {
  type Row,
  parse,
  download,
  useRows,
  Status,
  ModelNotice,
} from "./shared";
function LegacyDrafts({ useText }: { useText: (text: string) => void }) {
  const state = useRows("drafts");
  const legacy = state.rows.filter((r) => r.metadata?.kind !== "email");
  return legacy.length ? (
    <details>
      <summary>
        Existing unclassified workspace drafts ({legacy.length})
      </summary>
      <p>
        These notes are preserved from earlier versions. Review them before
        using them as profile text.
      </p>
      {legacy.map((r) => (
        <article key={r.id}>
          <h3>{r.title}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{r.content}</p>
          <button onClick={() => useText(r.content)}>Use as source text</button>
          <button onClick={() => download("saved-note.txt", r.content)}>
            Export original note
          </button>
        </article>
      ))}
    </details>
  ) : null;
}
export function LinkedinStudio() {
  const state = useRows("linkedin"),
    [role, setRole] = useState(""),
    [original, setOriginal] = useState({
      headline: "",
      about: "",
      experience: "",
    }),
    [active, setActive] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const data = active ? parse(active) : null;
  return (
    <section className="studio-workspace">
      <div className="studio-hero">
        <small>LINKEDIN OPTIMIZER</small>
        <h2>A clearer profile, grounded in your experience.</h2>
        <p>
          Draft improvements locally. No LinkedIn account access or automatic
          publishing is provided.
        </p>
      </div>
      <LegacyDrafts
        useText={(text) =>
          setOriginal({ ...original, about: text.slice(0, 12000) })
        }
      />
      <ModelNotice />
      <Status state={state} />
      {message && <p role="status">{message}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          state.setError("");
          try {
            setActive(
              await call("career-ai/linkedin", "POST", { ...original, role }),
            );
            await state.load();
          } catch (e) {
            state.setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Target role
          <input
            required
            value={role}
            maxLength={200}
            onChange={(e) => setRole(e.target.value)}
          />
        </label>
        <label>
          Import profile export (PDF, DOCX, TXT, JSON)
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                const form = new FormData();
                form.append("file", file);
                const r = await call(
                  "career-workspace/extract-document",
                  "POST",
                  form,
                );
                setOriginal({ ...original, about: r.text.slice(0, 12000) });
                setMessage(
                  "Imported text placed in About for review. Move experience details to the appropriate section before generating.",
                );
              } catch (e) {
                state.setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {(["headline", "about", "experience"] as const).map((key) => (
          <label key={key}>
            {key[0].toUpperCase() + key.slice(1)}
            <textarea
              aria-label={key[0].toUpperCase() + key.slice(1)}
              maxLength={
                key === "headline" ? 1000 : key === "about" ? 12000 : 16000
              }
              value={original[key]}
              onChange={(e) =>
                setOriginal({ ...original, [key]: e.target.value })
              }
            />
          </label>
        ))}
        <button disabled={busy} type="submit">
          {busy ? "Generating suggestions…" : "Generate profile improvements"}
        </button>
      </form>
      {data && active && (
        <section>
          <h2>Original vs proposed</h2>
          <p>
            AI-generated suggestions. Verify every statement before copying to
            LinkedIn.
          </p>
          {(["headline", "about", "experience"] as const).map((key) => (
            <div className="comparison-grid" key={key}>
              <article>
                <h3>Original {key}</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {data.original[key] || "(empty)"}
                </p>
              </article>
              <article>
                <label>
                  Proposed {key}
                  <textarea
                    aria-label={"Proposed " + key}
                    value={data.proposed[key]}
                    onChange={(e) =>
                      setActive({
                        ...active,
                        content: JSON.stringify({
                          ...data,
                          proposed: { ...data.proposed, [key]: e.target.value },
                        }),
                      })
                    }
                  />
                </label>
              </article>
            </div>
          ))}
          <h3>Why these changes</h3>
          <ul>
            {data.proposed.explanations.map((x: string, i: number) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          <p>Suggested keywords: {data.proposed.keywords.join(", ")}</p>
          <div className="job-actions">
            <button
              onClick={async () => {
                try {
                  const { id, ...record } = active;
                  setActive(
                    await call("career/linkedin", "POST", {
                      ...record,
                      title:
                        active.title.replace(/ — revised$/, "") + " — revised",
                    }),
                  );
                  await state.load();
                  setMessage("New version saved.");
                } catch (e) {
                  state.setError(String(e));
                }
              }}
            >
              Save edited version
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    ["headline", "about", "experience"]
                      .map((k) => data.proposed[k])
                      .join("\n\n"),
                  );
                  setMessage("Copied proposed text.");
                } catch (e) {
                  state.setError("Clipboard unavailable; use Export text.");
                }
              }}
            >
              Copy proposed text
            </button>
            <button
              onClick={() =>
                download(
                  "linkedin-draft.txt",
                  ["headline", "about", "experience"]
                    .map((k) => k.toUpperCase() + "\n" + data.proposed[k])
                    .join("\n\n"),
                )
              }
            >
              Export text
            </button>
          </div>
        </section>
      )}
      <h2>Saved versions</h2>
      {!state.loading && !state.rows.length && <p>No LinkedIn drafts yet.</p>}
      {state.rows.map((r) => (
        <article key={r.id}>
          <h3>{r.title}</h3>
          <button
            onClick={() => {
              setActive(r);
              setMessage("Saved version opened.");
            }}
          >
            Open version
          </button>
        </article>
      ))}
    </section>
  );
}
