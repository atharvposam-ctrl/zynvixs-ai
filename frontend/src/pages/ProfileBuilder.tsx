import { PdfResumePreview } from "../PdfResumePreview";
import { useEffect, useState } from "react";
import { call } from "../Workflows";
import { type Row, download, ModelNotice } from "./shared";
const profileFields = [
  ["name", "Full name", "contact"],
  ["target_role", "Resume target role", "contact"],
  ["summary", "Professional summary for your resume", "background"],
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
function resumeInfo(fields: Record<string, string>) {
  return {
    name: (fields.name || "").trim(),
    role: (fields.target_role || "").trim(),
    email: (fields.email || "").trim(),
    phone: (fields.phone || "").trim(),
    location: (fields.location || "").trim(),
    links: [fields.linkedin, fields.portfolio]
      .map((v) => (v || "").trim())
      .filter(Boolean)
      .join(" | "),
    summary: (fields.summary || "").trim(),
    education: (fields.education || "").trim(),
    experience: (fields.experience || "").trim(),
    skills: (fields.skills || "").trim(),
    projects: (fields.projects || "").trim(),
    certifications: (fields.certifications || "").trim(),
  };
}
function signature(info: Record<string, string>) {
  return JSON.stringify(
    Object.entries(info).sort(([a], [b]) => a.localeCompare(b)),
  );
}
export function ProfileEditor() {
  const [legacy, setLegacy] = useState<Row[]>([]);
  const [generatedFields, setGeneratedFields] = useState("");
  const [revealRequest, setRevealRequest] = useState(0);
  const [resumeResult, setResumeResult] = useState<Row | null>(null),
    [resumeStale, setResumeStale] = useState(false);
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
  useEffect(() => {
    if (resumeResult)
      setResumeStale(signature(resumeInfo(fields)) !== generatedFields);
  }, [fields, resumeResult, generatedFields]);
  async function createResume() {
    if (!fields.name?.trim() || !fields.target_role?.trim()) {
      setError(
        "Enter your full name and Resume target role before creating a resume.",
      );
      document
        .querySelector<HTMLInputElement>(
          !fields.name?.trim()
            ? 'input[name="name"]'
            : 'input[name="target_role"]',
        )
        ?.focus();
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    let profileSaved = false;
    try {
      const snapshot = { ...fields };
      const saved = await call("career-workspace/profile", "PUT", {
        fields: snapshot,
      });
      profileSaved = true;
      setCompletion(saved.completion);
      window.dispatchEvent(new Event("profile-changed"));
      const info = resumeInfo(snapshot);
      const result = await call(
        "career/actions/resume-from-info",
        "POST",
        info,
      );
      setGeneratedFields(signature(info));
      setRevealRequest((v) => v + 1);
      setResumeResult(result);
      setResumeStale(false);
      setMessage(
        "Your information and resume were saved. The resume is now active; review the PDF below.",
      );
      window.dispatchEvent(new Event("resume-changed"));
    } catch (e) {
      setError(
        (profileSaved ? "Profile saved, but resume creation failed: " : "") +
          String(e),
      );
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    setBusy(true);
    try {
      const r = await call("career-workspace/profile");
      setFields((current) => ({ ...r.fields, ...current }));
      setLegacy(r.legacy_sections || []);
      setCompletion(r.completion);
      const savedResumes: Row[] = await call("career/resumes");
      setResumes(savedResumes);
      const lastForm = savedResumes.find(
        (row) =>
          row.metadata?.kind === "form_resume" && row.metadata?.source_fields,
      );
      if (lastForm) {
        setResumeResult(lastForm);
        setGeneratedFields(signature(lastForm.metadata!.source_fields));
      }

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
        id="profile-resume-form"
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
        <div className="profile-resume-intro">
          <small>CREATE A RESUME FROM YOUR INFORMATION</small>
          <h2>Fill in your details. Preview. Download.</h2>
          <p>
            Enter your name, target role and background below. We format only
            the facts you enter; no AI model is required. Career preferences,
            work authorization and notice period stay out of this resume.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              if (e.currentTarget.form?.reportValidity()) void createResume();
            }}
          >
            {busy
              ? "Saving your information…"
              : "Save info & preview resume PDF"}
          </button>
          {resumeResult && (
            <button
              type="button"
              onClick={() => setRevealRequest((v) => v + 1)}
            >
              View last saved PDF
            </button>
          )}
        </div>
        {[
          ["contact", "Contact & identity"],
          ["background", "Experience & qualifications"],
          ["preferences", "Career preferences"],
        ].map(([group, label]) => (
          <fieldset key={group} disabled={busy}>
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
                        name={key}
                        maxLength={
                          key === "name" || key === "target_role"
                            ? 150
                            : key === "email" || key === "location"
                              ? 300
                              : key === "phone"
                                ? 100
                                : key === "linkedin" || key === "portfolio"
                                  ? 400
                                  : 1000
                        }
                        value={fields[key] || ""}
                        onChange={(e) => {
                          setFields({ ...fields, [key]: e.target.value });
                          setResumeStale(true);
                        }}
                      />
                    ) : (
                      <textarea
                        aria-label={label}
                        maxLength={
                          key === "summary" ||
                          key === "skills" ||
                          key === "certifications"
                            ? 4000
                            : key === "education" || key === "projects"
                              ? 8000
                              : key === "experience"
                                ? 12000
                                : 16000
                        }
                        value={fields[key] || ""}
                        onChange={(e) => {
                          setFields({ ...fields, [key]: e.target.value });
                          setResumeStale(true);
                        }}
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
      {resumeResult && (
        <PdfResumePreview
          key={resumeResult.id}
          id={resumeResult.id}
          title={resumeResult.title}
          text={resumeResult.content}
          stale={resumeStale}
          revealRequest={revealRequest}
        />
      )}
    </section>
  );
}
