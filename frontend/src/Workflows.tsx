import { ResumeSections } from "./ResumeSections";
import { useEffect, useState } from "react";
export type Item = {
  id: string;
  title: string;
  content: string;
  complete: boolean;
  due: string;
  status?: string;
  job_id?: string;
  metadata?: Record<string, unknown>;
};
export async function call(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
) {
  const form = body instanceof FormData;
  let r: Response;
  try {
    r = await fetch("/api/" + path, {
      method,
      signal,
      headers: form ? {} : { "Content-Type": "application/json" },
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
    });
  } catch (e) {
    if (e instanceof TypeError)
      throw new Error(
        "Cannot reach the Zynvixs backend. Start or restart Zynvixs.bat from the updated folder, open http://127.0.0.1:8765, then retry. Your current form entries are kept on this page.",
      );
    throw e;
  }
  if (!r.ok) {
    let message = await r.text();
    try {
      message = JSON.parse(message).detail;
    } catch {}
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    );
  }
  return r.json();
}
export function ResumeLibrary({
  onUse,
  onSelect,
}: {
  onUse: (text: string) => void;
  onSelect?: (row: Item) => void;
}) {
  const [rows, setRows] = useState<Item[]>([]),
    [active, setActive] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Item | null>(null);
  async function load() {
    try {
      setRows(await call("career/resumes"));
      setActive((await call("career/actions/active-resume")).id);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("resume-changed", refresh);
    return () => window.removeEventListener("resume-changed", refresh);
  }, []);
  async function select(id: string) {
    try {
      await call("career/actions/active-resume", "PUT", { id });
      setActive(id);
      const selected = rows.find((r) => r.id === id);
      if (selected) {
        onUse(selected.content);
        onSelect?.(selected);
      }
      window.dispatchEvent(new Event("resume-changed"));
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <section>
      <h2>Resume library</h2>
      <p>
        Import PDF, DOCX, TXT or Markdown. Scanned PDFs require OCR outside this
        app. Select the resume shared by job search and tailoring.
      </p>
      <label>
        Import resume
        <input
          type="file"
          disabled={busy}
          accept=".pdf,.docx,.txt,.md"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              const form = new FormData();
              form.append("file", f);
              const row = await call(
                "career/actions/import-resume",
                "POST",
                form,
              );
              await load();
              await select(row.id);
              onUse(row.content);
              onSelect?.(row);
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      <button onClick={() => void load()}>Refresh saved versions</button>
      {busy && <p role="status">Importing…</p>}
      {error && <p role="alert">{error}</p>}
      {!rows.length && !busy && <p>No saved resumes yet.</p>}
      {rows.map((r) => (
        <article key={r.id}>
          <h3>
            {r.title}
            {active === r.id ? " · Active" : ""}
          </h3>
          <p>{r.content.slice(0, 180)}…</p>
          <button onClick={() => void select(r.id)}>Select resume</button>
          <button onClick={() => onUse(r.content)}>
            Use as generation input
          </button>
          <button onClick={() => setEdit(r)}>Edit version</button>
          <a href={"/api/career/resumes/" + r.id + "/export?format=pdf"}>
            Download PDF
          </a>{" "}
          ·{" "}
          <a href={"/api/career/resumes/" + r.id + "/export?format=docx"}>
            Download DOCX
          </a>
        </article>
      ))}
      {edit && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await call("career/resumes", "POST", {
                ...edit,
                title: edit.title + " — revised",
                metadata: { parent_id: edit.id },
              });
              setEdit(null);
              await load();
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          <h3>Edit and save a new version</h3>
          <ResumeSections
            text={edit.content}
            onChange={(content) => setEdit({ ...edit, content })}
          />
          <label>
            Title
            <input
              value={edit.title}
              required
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            />
          </label>
          <label>
            Resume text
            <textarea
              aria-label="Resume text"
              value={edit.content}
              required
              onChange={(e) => setEdit({ ...edit, content: e.target.value })}
            />
          </label>
          <button type="submit">Save new version</button>
          <button type="button" onClick={() => setEdit(null)}>
            Cancel edit
          </button>
        </form>
      )}
    </section>
  );
}
export { JobSearch } from "./JobSearch";
type BrowserState = {
  id?: string;
  url: string;
  fields: {
    index: number;
    name: string;
    label: string;
    type: string;
    value: string;
    required: boolean;
  }[];
  description: string;
};
export function BrowserAssistant() {
  const [setup, setSetup] = useState<{
      package_installed: boolean;
      setup: string;
      requires: string;
    } | null>(null),
    [session, setSession] = useState<BrowserState | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [approved, setApproved] = useState(false),
    [message, setMessage] = useState("");
  const job = sessionStorage.getItem("zynvixs.browser-job");
  useEffect(() => {
    void call("career-browser/status")
      .then(setSetup)
      .catch((e) => setError(String(e)));
  }, []);
  async function action(type: string) {
    setError("");
    setBusy(true);
    try {
      if (type === "start") {
        const r = await call("career-browser/start", "POST", { job_id: job });
        setSession(r);
        setValues({});
        setReviewed(false);
        setMessage("Dedicated browser opened. Sign in manually if required.");
      } else if (type === "close") {
        await call("career-browser/" + session?.id, "DELETE");
        setSession(null);
        setMessage("Session closed. Application status unchanged.");
      } else if (type === "submit") {
        const r = await call(
          "career-browser/" + session?.id + "/submit",
          "POST",
          { approved },
        );
        setMessage(r.message);
        setReviewed(false);
        setApproved(false);
      } else {
        const r =
          type === "refresh"
            ? await call("career-browser/" + session?.id)
            : await call(
                "career-browser/" + session?.id + "/" + type,
                "POST",
                type === "fill" ? { values } : {},
              );
        setSession({ ...r, id: session?.id });
        setReviewed(type === "review");
        setApproved(false);
        setMessage(
          type === "review"
            ? "Review captured. Inspect every field below and in the visible browser before approval."
            : "Browser fields updated.",
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="browser-assistant">
      <h2>Browser application assistant</h2>
      <p>
        This controls a dedicated browser only. It does not control your
        desktop. Login, MFA, CAPTCHA, consent checkboxes and file uploads remain
        manual. The assistant will not invent answers.
      </p>
      {setup ? (
        <>
          <p>
            {setup.package_installed
              ? "Browser package installed. Chromium and a visible desktop are also required."
              : "Optional browser package missing."}
          </p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{setup.setup}</pre>
          <p>{setup.requires}</p>
        </>
      ) : (
        <p>Checking connection…</p>
      )}
      {!job && (
        <p>
          Choose a genuine result in Job Search → Application auto-fill first.
        </p>
      )}
      {!session && (
        <button
          disabled={!job || busy || !setup?.package_installed}
          onClick={() => void action("start")}
        >
          Open selected job in dedicated browser
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {session && (
        <>
          <p>Current page: {session.url}</p>
          <p>
            Navigate to the application form in the visible browser, then
            refresh fields. Different domains may require manual handling.
          </p>
          <button disabled={busy} onClick={() => void action("refresh")}>
            Read current page and form
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              try {
                const profile: Item[] = await call("career/profile");
                const normalized = (s: string) =>
                  s.toLowerCase().replace(/[^a-z0-9]/g, "");
                const stored = Object.fromEntries(
                  profile
                    .slice()
                    .reverse()
                    .map((r) => [normalized(r.title), r.content]),
                );
                const aliases: Record<string, string[]> = {
                  fullname: ["fullname", "name"],
                  name: ["name", "fullname"],
                  emailaddress: ["emailaddress", "email"],
                  phonenumber: ["phonenumber", "phone"],
                  city: ["city"],
                  location: ["location", "city"],
                };
                const suggestions: Record<string, string> = {};
                for (const field of session.fields) {
                  const name = normalized(field.label || field.name);
                  const keys = aliases[name] || [name];
                  const value = keys.map((k) => stored[k]).find(Boolean);
                  if (value) suggestions[field.index] = value;
                }
                setValues({ ...values, ...suggestions });
                setReviewed(false);
                setApproved(false);
                setMessage(
                  Object.keys(suggestions).length
                    ? "Saved profile suggestions prepared. Review every answer before clicking Fill. Nothing has been sent to the form yet."
                    : "No exact profile fields matched. Save named sections such as Full name, Email or Phone in Profile Builder, or enter answers manually.",
                );
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Prepare suggestions from saved profile
          </button>
          <button onClick={() => void action("close")}>
            Cancel and close browser
          </button>
          <details>
            <summary>Read page text</summary>
            <p style={{ whiteSpace: "pre-wrap" }}>{session.description}</p>
          </details>
          {session.fields.map((f) => (
            <label key={f.index}>
              {f.label || f.name || "Field " + f.index}
              {f.required ? " (required)" : ""}
              <input
                value={values[f.index] ?? f.value}
                onChange={(e) => {
                  setValues({ ...values, [f.index]: e.target.value });
                  setReviewed(false);
                  setApproved(false);
                }}
              />
            </label>
          ))}
          {!session.fields.length && (
            <p>
              No supported text fields detected. Navigate manually to the form
              or complete it manually.
            </p>
          )}
          <button
            disabled={busy || !session.fields.length}
            onClick={() => void action("fill")}
          >
            Fill only the answers I entered
          </button>
          <button disabled={busy} onClick={() => void action("review")}>
            Review current form before submission
          </button>
          {reviewed && (
            <div className="approval">
              <h3>Review captured field values</h3>
              {session.fields.map((f) => (
                <p key={f.index}>
                  <strong>{f.label || f.name}:</strong> {f.value || "(empty)"}
                </p>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                I reviewed the actual website, attachments, consent and all
                answers, and approve this submission.
              </label>
              <button
                disabled={!approved || busy}
                onClick={() => void action("submit")}
              >
                Submit reviewed application
              </button>
              <p>
                This attempts the unique submit control. Verify the website
                response yourself before marking your application Submitted.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
