import { useEffect, useState } from "react";
import { call } from "../Workflows";
import { type Row, download, ModelNotice } from "./shared";
const profileFields = [
  ["name", "Full name", "contact"],
  ["email", "Email", "contact"],
  ["phone", "Phone", "contact"],
  ["location", "City / location", "contact"],
  ["headline", "Professional headline", "contact"],
  ["linkedin", "LinkedIn URL", "contact"],
  ["portfolio", "Portfolio / GitHub URL", "contact"],
  ["education", "Education — institution, qualification, dates", "background"],
  [
    "experience",
    "Experience — employer, role, dates, achievements",
    "background",
  ],
  ["skills", "Skills", "background"],
  ["projects", "Portfolio projects — title, contribution, links", "background"],
  [
    "certifications",
    "Certifications — issuer, credential, dates",
    "background",
  ],
  [
    "preferences",
    "Career preferences — roles, locations, remote work, salary",
    "preferences",
  ],
  [
    "work_authorization",
    "Work authorization / sponsorship needs",
    "preferences",
  ],
  ["notice_period", "Notice period / availability", "preferences"],
];
export function ProfileEditor() {
  const [legacy, setLegacy] = useState<Row[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({}),
    [completion, setCompletion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [resumes, setResumes] = useState<Row[]>([]),
    [resume, setResume] = useState(""),
    [suggestions, setSuggestions] = useState<Record<string, string> | null>(
      null,
    ),
    [approved, setApproved] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const r = await call("career-workspace/profile");
      setFields(r.fields);
      setLegacy(r.legacy_sections || []);
      setCompletion(r.completion);
      setResumes(await call("career/resumes"));
      setResume((await call("career/actions/active-resume")).id);
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="studio-workspace">
      <div className="studio-hero">
        <small>YOUR SHARED CAREER PROFILE</small>
        <h2>Tell your professional story.</h2>
        <p>
          Approved facts power resume drafting, job matching and browser form
          suggestions. Never save passwords here.
        </p>
        <strong>{completion}% complete</strong>
        <progress max={100} value={completion} />
        <p>
          Completion counts name, email, location, education, skills and career
          preferences.
        </p>
      </div>
      {legacy.length > 0 && (
        <details>
          <summary>Other preserved profile notes ({legacy.length})</summary>
          {legacy.map((r) => (
            <article key={r.id}>
              <h3>{r.title}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.content}</p>
              <button onClick={() => download("profile-note.txt", r.content)}>
                Export note
              </button>
              <button
                onClick={() => {
                  setFields({
                    ...fields,
                    experience:
                      (fields.experience || "") +
                      "\n" +
                      r.title +
                      ": " +
                      r.content,
                  });
                  setMessage(
                    "Note copied into the Experience editor. Review before saving.",
                  );
                }}
              >
                Copy into experience editor
              </button>
            </article>
          ))}
        </details>
      )}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void load()}>Retry loading profile</button>
        </p>
      )}
      {busy && <p role="status">Working…</p>}
      {message && <p role="status">{message}</p>}
      <details className="workflow-panel">
        <summary>Import suggestions from a saved resume</summary>
        <ModelNotice />
        <label>
          Resume
          <select value={resume} onChange={(e) => setResume(e.target.value)}>
            <option value="">Select a saved resume</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!resume || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await call("career-workspace/profile/import", "POST", {
                resume_id: resume,
              });
              setSuggestions(r.fields);
              setApproved(false);
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Extract suggestions for review
        </button>
        {suggestions && (
          <>
            <h3>Review extracted fields</h3>
            {Object.entries(suggestions).map(([key, value]) => (
              <p key={key}>
                <strong>{key}:</strong> {value || "(not provided)"}
              </p>
            ))}
            <label>
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              I reviewed these suggestions. Add them to the editor without
              overwriting filled fields.
            </label>
            <button
              disabled={!approved}
              onClick={() => {
                setFields({
                  ...suggestions,
                  ...Object.fromEntries(
                    Object.entries(fields).filter(([, v]) => v.trim()),
                  ),
                });
                setSuggestions(null);
                setMessage(
                  "Suggestions added to editor. Review and save to persist.",
                );
              }}
            >
              Use reviewed suggestions
            </button>
          </>
        )}
      </details>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await call("career-workspace/profile", "PUT", { fields });
            setCompletion(r.completion);
            setMessage("Profile saved locally.");
            window.dispatchEvent(new Event("profile-changed"));
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          ["contact", "Contact & identity"],
          ["background", "Experience & qualifications"],
          ["preferences", "Career preferences"],
        ].map(([group, label]) => (
          <fieldset key={group}>
            <legend>{label}</legend>
            <div className="studio-field-grid">
              {profileFields
                .filter((f) => f[2] === group)
                .map(([key, label]) => (
                  <label key={key}>
                    {label}
                    {group === "contact" ? (
                      <input
                        type={key === "email" ? "email" : "text"}
                        maxLength={1000}
                        value={fields[key] || ""}
                        onChange={(e) =>
                          setFields({ ...fields, [key]: e.target.value })
                        }
                      />
                    ) : (
                      <textarea
                        aria-label={label}
                        maxLength={16000}
                        value={fields[key] || ""}
                        onChange={(e) =>
                          setFields({ ...fields, [key]: e.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
            </div>
          </fieldset>
        ))}
        <button disabled={busy} type="submit">
          Save approved profile
        </button>
      </form>
    </section>
  );
}
