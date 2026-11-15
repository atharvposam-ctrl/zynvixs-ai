import { useEffect, useState } from "react";
export type Item = {
  id: string;
  title: string;
  content: string;
  complete: boolean;
  due: string;
  status?: string;
  job_id?: string;
};
export async function call(path: string, method = "GET", body?: unknown) {
  const form = body instanceof FormData;
  const r = await fetch("/api/" + path, {
    method,
    headers: form ? {} : { "Content-Type": "application/json" },
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });
  if (!r.ok) {
    let message = await r.text();
    try {
      message = JSON.parse(message).detail;
    } catch {}
    throw new Error(message);
  }
  return r.json();
}
export function ResumeLibrary({ onUse }: { onUse: (text: string) => void }) {
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
  }, []);
  async function select(id: string) {
    try {
      await call("career/actions/active-resume", "PUT", { id });
      setActive(id);
      const selected = rows.find((r) => r.id === id);
      if (selected) onUse(selected.content);
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
              });
              setEdit(null);
              await load();
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          <h3>Edit and save a new version</h3>
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
type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  arrangement: string;
  description: string;
  url: string;
  source: string;
  sources: { source: string; url: string }[];
  salary: string;
  posted: string;
  date_label?: string;
  job_type: string;
  match: {
    score: number | null;
    matched: string[];
    missing: string[];
    experience: string;
    location: string;
    explanation: string;
  };
};
export function JobSearch({ navigate }: { navigate: (p: string) => void }) {
  const [resumes, setResumes] = useState<Item[]>([]),
    [resume, setResume] = useState(""),
    [jobs, setJobs] = useState<Job[]>([]),
    [saved, setSaved] = useState<Item[]>([]),
    [criteria, setCriteria] = useState(""),
    [providers, setProviders] = useState<
      { provider: string; status: string; count?: number; error?: string }[]
    >([]),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<Job | null>(null),
    [message, setMessage] = useState("");
  async function load() {
    try {
      setResumes(await call("career/resumes"));
      setResume((await call("career/actions/active-resume")).id);
      setSaved(await call("career/jobs"));
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function search() {
    setBusy(true);
    setError("");
    setJobs([]);
    try {
      const r = await call("career-jobs/search", "POST", {
        ...filters,
        resume_id: resume,
      });
      setJobs(r.jobs);
      setProviders(r.providers);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function action(job: Job, type: string) {
    setError("");
    try {
      if (type === "tailor") {
        sessionStorage.setItem("zynvixs.tailor-description", job.description);
        navigate("Resume Studio");
        return;
      }
      if (type === "browser") {
        sessionStorage.setItem("zynvixs.browser-job", job.id);
        navigate("Automation");
        return;
      }
      await call("career-jobs/" + job.id + "/" + type, "POST", {});
      setMessage(
        type === "save"
          ? "Job saved."
          : "Draft application created. It has not been submitted.",
      );
      await load();
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <section className="job-workspace">
      <h2>Find matching jobs</h2>
      <p>
        Searching contacts Remotive and the company boards you configure below.
        No generated vacancies. Matching is an estimated keyword overlap, not a
        hiring probability.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label>
          Active resume
          <select
            required
            value={resume}
            onChange={async (e) => {
              setResume(e.target.value);
              setJobs([]);
              setProviders([]);
              setCriteria("");
              try {
                await call("career/actions/active-resume", "PUT", {
                  id: e.target.value,
                });
              } catch (x) {
                setError(String(x));
              }
            }}
          >
            <option value="">Select a saved resume</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!resume}
          onClick={async () => {
            try {
              const r = await call("career-jobs/criteria", "POST", {
                resume_id: resume,
              });
              setCriteria(
                "Skills: " +
                  r.skills.join(", ") +
                  " · Experience: " +
                  (r.experience_mentions.join(", ") || "not detected") +
                  " · Suggested roles: " +
                  r.suggested_roles.join(", "),
              );
              if (r.suggested_roles[0])
                setFilters({ ...filters, role: r.suggested_roles[0] });
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          Extract and review criteria
        </button>
        {criteria && <p>{criteria}</p>}
        <div className="filter-grid">
          {[
            ["role", "Role"],
            ["keywords", "Keywords"],
            ["company", "Company"],
            ["location", "Location"],
            ["experience", "Experience phrase, e.g. 2 years"],
            ["job_type", "Job type"],
            ["greenhouse", "Greenhouse board slug"],
            ["lever", "Lever company slug"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={filters[key] || ""}
                onChange={(e) =>
                  setFilters({ ...filters, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <label>
            Work arrangement
            <select
              value={filters.arrangement || ""}
              onChange={(e) =>
                setFilters({ ...filters, arrangement: e.target.value })
              }
            >
              <option value="">Any / unspecified</option>
              <option>remote</option>
              <option>hybrid</option>
              <option value="on-site">on-site</option>
            </select>
          </label>
          <label>
            Source
            <select
              value={filters.source || ""}
              onChange={(e) =>
                setFilters({ ...filters, source: e.target.value })
              }
            >
              <option value="">All configured</option>
              <option>Remotive</option>
              <option>Greenhouse</option>
              <option>Lever</option>
            </select>
          </label>
          <label>
            Posted / updated after
            <input
              type="date"
              value={filters.posted_after || ""}
              onChange={(e) =>
                setFilters({ ...filters, posted_after: e.target.value })
              }
            />
          </label>
        </div>
        <p>
          Remotive: public API. Greenhouse / Lever: enter the employer’s board
          slug to enable retrieval. Other portals below are outbound links only.
        </p>
        <button type="submit" disabled={!resume || busy}>
          {busy ? "Retrieving real vacancies…" : "Search reviewed criteria"}
        </button>
      </form>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void search()}>Retry search</button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <h3>Provider status</h3>
      {providers.length ? (
        providers.map((p) => (
          <p key={p.provider}>
            {p.provider}: {p.status}{" "}
            {p.count !== undefined ? "(" + p.count + " retrieved)" : ""}{" "}
            {p.error}
          </p>
        ))
      ) : (
        <p>Not checked yet. Run a search to verify provider availability.</p>
      )}
      {[
        ["LinkedIn", "https://www.linkedin.com/jobs/"],
        ["Indeed", "https://www.indeed.com/"],
        ["Naukri", "https://www.naukri.com/"],
      ].map(([p, url]) => (
        <p key={p}>
          <a target="_blank" rel="noopener noreferrer" href={url}>
            {p} — outbound portal link ↗
          </a>
        </p>
      ))}
      <h3>Results ({jobs.length})</h3>
      {!jobs.length && !busy && (
        <p>
          No current results. Select a resume and review your criteria before
          searching.
        </p>
      )}
      {jobs.map((j) => (
        <article key={j.id}>
          <h3>
            {j.title} · {j.company}
          </h3>
          <p>
            {j.location || "Location not provided"} · {j.arrangement} ·{" "}
            {j.job_type || "Type not provided"}
          </p>
          <p>
            {j.source} · Salary: {j.salary || "Not provided"} ·{" "}
            {j.date_label || "Posted"}: {j.posted || "Not provided"}
          </p>
          <p>
            <strong>
              Estimated skills compatibility:{" "}
              {j.match.score === null
                ? "Not enough information"
                : j.match.score + "%"}
            </strong>
          </p>
          <details>
            <summary>Why this matches</summary>
            <p>
              Matching skills: {j.match.matched.join(", ") || "None detected"}
            </p>
            <p>
              Other listing skills:{" "}
              {j.match.missing.join(", ") || "None detected"}
            </p>
            <p>Experience: {j.match.experience}</p>
            <p>{j.match.location}</p>
            <p>{j.match.explanation}</p>
          </details>
          <div className="job-actions">
            <button onClick={() => void action(j, "save")}>Save Job</button>
            <button onClick={() => setDetail(j)}>View Details</button>
            <a href={j.url} target="_blank" rel="noopener noreferrer">
              Open Original ↗
            </a>
            <button onClick={() => void action(j, "tailor")}>
              Tailor Resume
            </button>
            <button onClick={() => void action(j, "application")}>
              Start Application
            </button>
            <button onClick={() => void action(j, "browser")}>
              Open browser assistant
            </button>
          </div>
          <small>
            Listing supplied by{" "}
            {j.source === "Remotive" ? "Remotive.com" : j.source}
          </small>
        </article>
      ))}
      {detail && (
        <section className="job-detail">
          <button onClick={() => setDetail(null)}>Close details</button>
          <h2>{detail.title}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{detail.description}</p>
          {detail.sources.map((s) => (
            <p key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.source} original listing
              </a>
            </p>
          ))}
        </section>
      )}
      <h3>Saved jobs</h3>
      {saved.length ? (
        saved.map((r) => {
          const j: Job = JSON.parse(r.content);
          return (
            <article key={r.id}>
              <h4>{r.title}</h4>
              <a href={j.url} target="_blank" rel="noopener noreferrer">
                Open Original
              </a>
              <button onClick={() => setDetail(j)}>
                View saved description
              </button>
            </article>
          );
        })
      ) : (
        <p>No saved vacancies yet.</p>
      )}
    </section>
  );
}
export function ApplicationTracker() {
  const [rows, setRows] = useState<Item[]>([]),
    [error, setError] = useState("");
  async function load() {
    try {
      setRows(await call("career/applications"));
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section>
      <h2>Application pipeline</h2>
      <p>
        Opening a listing creates no submission. Change the status to Submitted
        only after verifying the employer’s confirmation.
      </p>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {!rows.length && <p>No tracked applications.</p>}
      {rows.map((r) => (
        <article key={r.id}>
          <h3>{r.title}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{r.content}</p>
          <label>
            Verified status
            <select
              value={r.status || "draft"}
              onChange={async (e) => {
                const status = e.target.value;
                if (
                  status === "submitted" &&
                  !confirm(
                    "Have you verified that the employer received this application?",
                  )
                )
                  return;
                try {
                  await call("career/applications/" + r.id, "PUT", {
                    ...r,
                    status,
                  });
                  await load();
                } catch (x) {
                  setError(String(x));
                }
              }}
            >
              {[
                "draft",
                "reviewing",
                "submitted",
                "interview",
                "offer",
                "rejected",
                "withdrawn",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </article>
      ))}
    </section>
  );
}
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
          Choose a genuine result in Job Search → Open browser assistant first.
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
                  profile.map((r) => [normalized(r.title), r.content]),
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
