import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileText,
  UserRound,
  Search,
  BriefcaseBusiness,
  Sparkles,
} from "lucide-react";
import { call } from "./Workflows";
import { type Row, parse } from "./pages/shared";
import { PdfResumePreview } from "./PdfResumePreview";
export type LinkedinSource = {
  role: string;
  headline: string;
  about: string;
  experience: string;
};
function resumeBody(f: Record<string, string>) {
  return {
    name: f.name || "",
    role: f.target_role || "",
    email: f.email || "",
    phone: f.phone || "",
    location: f.location || "",
    links: [f.linkedin, f.portfolio].filter(Boolean).join(" | "),
    summary: f.summary || "",
    education: f.education || "",
    experience: f.experience || "",
    skills: f.skills || "",
    projects: f.projects || "",
    certifications: f.certifications || "",
  };
}
const signature = (v: Record<string, string>) =>
  JSON.stringify(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
export function LinkedinBanners({
  navigate,
  focus,
}: {
  navigate: (p: string) => void;
  focus: (id: string) => void;
}) {
  return (
    <section className="linkedin-banners" aria-label="LinkedIn career banners">
      <div className="linkedin-journey-banner">
        <div>
          <small>ONE PROFILE. YOUR NEXT CHAPTER.</small>
          <h2>Your profile → Your resume → Your next application.</h2>
          <p>
            Start with your real details. Shape your professional story and
            review every next step.
          </p>
          <button onClick={() => focus("linkedin-profile-intake")}>
            Build your professional story
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="linkedin-banner-art" aria-hidden="true">
          <span>in</span>
          <b>Your professional story</b>
          <i />
          <i />
          <i />
          <small>PROFILE · RESUME · OPPORTUNITY</small>
        </div>
      </div>
      <div className="linkedin-banner-grid">
        {[
          {
            title: "Make your profile stand out",
            text: "Create and review LinkedIn drafts.",
            action: "Create LinkedIn content",
            icon: Sparkles,
            run: () => focus("linkedin-source-form"),
            tone: "purple",
          },
          {
            title: "Turn your profile into a resume",
            text: "Preview and download a real PDF.",
            action: "Create a resume PDF",
            icon: FileText,
            run: () => focus("linkedin-resume-action"),
            tone: "blue",
          },
          {
            title: "Find your next opportunity",
            text: "Search genuine supported listings.",
            action: "Find matching jobs",
            icon: Search,
            run: () => navigate("Job Search"),
            tone: "teal",
          },
          {
            title: "Prepare your next application",
            text: "Review a saved job and your details.",
            action: "Review saved opportunities",
            icon: BriefcaseBusiness,
            run: () => focus("linkedin-application-handoff"),
            tone: "rose",
          },
        ].map((b) => (
          <div
            className={"linkedin-small-banner linkedin-tone-" + b.tone}
            key={b.title}
          >
            <b.icon size={26} />
            <h3>{b.title}</h3>
            <p>{b.text}</p>
            <button onClick={b.run}>
              {b.action}
              <ArrowRight size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
export function LinkedinJourney({
  navigate,
  useSource,
  disabled = false,
}: {
  navigate: (p: string) => void;
  useSource: (source: LinkedinSource, replace: boolean) => void;
  disabled?: boolean;
}) {
  const [fields, setFields] = useState<Record<string, string>>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [replace, setReplace] = useState(false);
  const [resumes, setResumes] = useState<Row[]>([]),
    [resume, setResume] = useState(""),
    [jobs, setJobs] = useState<Row[]>([]),
    [job, setJob] = useState(""),
    [pdf, setPdf] = useState<Row | null>(null),
    [savedSignature, setSavedSignature] = useState(""),
    [reveal, setReveal] = useState(0);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [p, r, a, j] = await Promise.all([
        call("career-workspace/profile"),
        call("career/resumes"),
        call("career/actions/active-resume"),
        call("career/jobs"),
      ]);
      setFields((current) => ({ ...p.fields, ...current }));
      setResumes(r);
      setResume(a.id || "");
      setJobs(j);
      const active = r.find(
        (v: Row) => v.id === a.id && v.metadata?.kind === "form_resume",
      );
      if (active) {
        setPdf(active);
        setSavedSignature(signature(active.metadata.source_fields));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const stale = !!pdf && signature(resumeBody(fields)) !== savedSignature;
  async function save() {
    await call("career-workspace/profile", "PUT", { fields });
    window.dispatchEvent(new Event("profile-changed"));
  }
  function source(values = fields): LinkedinSource {
    return {
      role: values.target_role || "",
      headline:
        values.headline ||
        (values.target_role ? "Target role: " + values.target_role : ""),
      about: [
        values.summary,
        values.education ? "Education: " + values.education : "",
        values.skills ? "Skills: " + values.skills : "",
        values.projects ? "Projects: " + values.projects : "",
        values.certifications ? "Certifications: " + values.certifications : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 12000),
      experience: (values.experience || "").slice(0, 16000),
    };
  }
  async function useSavedProfile() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await call("career-workspace/profile");
      useSource(source(saved.fields), replace);
      setMessage(
        "Saved profile used as LinkedIn source. Your currently typed profile fields were kept; nothing was published.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveAndUse() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await save();
      useSource(source(), replace);
      setMessage(
        "Profile information saved. LinkedIn source fields were filled for your review; nothing was published.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function createPdf() {
    if (!fields.name?.trim() || !fields.target_role?.trim()) {
      setError(
        "Enter your full name and career target role before creating a resume.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    let profileSaved = false;
    try {
      await save();
      profileSaved = true;
      const body = resumeBody(fields);
      const result = await call(
        "career/actions/resume-from-info",
        "POST",
        body,
      );
      setPdf(result);
      setSavedSignature(signature(body));
      setResumes((r) => [result, ...r]);
      setResume(result.id);
      setReveal((n) => n + 1);
      window.dispatchEvent(new Event("resume-changed"));
      setMessage(
        "Profile and resume saved. This version is now the active resume. Review the PDF before downloading.",
      );
    } catch (e) {
      setError(
        (profileSaved ? "Profile saved, but PDF creation failed: " : "") +
          String(e),
      );
    } finally {
      setBusy(false);
    }
  }
  async function useResume() {
    setBusy(true);
    setError("");
    try {
      const row = resumes.find((r) => r.id === resume);
      if (!row) throw new Error("Select a saved resume first.");
      await call("career/actions/active-resume", "PUT", { id: row.id });
      useSource(
        {
          role: fields.target_role || "",
          headline: "",
          about: row.content.slice(0, 12000),
          experience: "",
        },
        replace,
      );
      setMessage(
        "Saved resume text placed in the LinkedIn source for review. Your shared profile was not overwritten.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function prepare(browser = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const row = jobs.find((j) => j.id === job);
      const listing = row ? parse(row) : null;
      if (!listing?.id)
        throw new Error(
          "Select a valid saved vacancy, or retrieve it again in Job Search.",
        );
      if (resume)
        await call("career/actions/active-resume", "PUT", { id: resume });
      const application = await call(
        "career-jobs/" + listing.id + "/application",
        "POST",
        {},
      );
      if (
        resume &&
        application.resume_id !== resume &&
        ["saved", "draft", "reviewing"].includes(application.status)
      )
        await call("career/applications/" + application.id, "PUT", {
          ...application,
          resume_id: resume,
        });
      if (browser) {
        sessionStorage.setItem("zynvixs.browser-job", listing.id);
        navigate("Automation");
      } else {
        navigate("Applications");
      }
    } catch (e) {
      setError(
        String(e) +
          " Review the listing again in Job Search if its cache is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="linkedin-journey"
      aria-label="Shared profile and career workflow"
    >
      {error && (
        <p role="alert" className="linkedin-journey-error">
          {error}
          <button onClick={() => void load()}>Reload saved context</button>
        </p>
      )}
      {message && (
        <p role="status" className="application-message">
          {message}
        </p>
      )}
      {loading && (
        <p role="status">Loading shared profile, resumes and saved jobs…</p>
      )}
      <section id="linkedin-profile-intake" className="linkedin-profile-intake">
        <header>
          <span>
            <UserRound size={21} />
            Your approved information
          </span>
          <h2>Enter your details once. Review how you use them.</h2>
          <p>
            These fields share storage with Profile Builder. Saving them does
            not publish to LinkedIn or send an application. Never enter
            passwords or login codes here.
          </p>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveAndUse();
          }}
        >
          <fieldset disabled={loading || busy || disabled}>
            <div className="linkedin-intake-grid">
              {[
                ["name", "Full name", 150],
                ["target_role", "Career target role", 150],
                ["email", "Email", 300],
                ["phone", "Phone", 100],
                ["location", "City / location", 300],
                ["headline", "Professional headline", 1000],
                ["linkedin", "LinkedIn profile URL", 1000],
                ["portfolio", "Portfolio / GitHub URL", 1000],
              ].map(([key, label, max]) => (
                <label key={String(key)}>
                  {label}
                  <input
                    aria-label={String(label)}
                    type={
                      key === "email"
                        ? "email"
                        : key === "linkedin" || key === "portfolio"
                          ? "url"
                          : "text"
                    }
                    maxLength={Number(max)}
                    value={fields[String(key)] || ""}
                    onChange={(e) =>
                      setFields({ ...fields, [String(key)]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <details className="linkedin-background-fields" open>
              <summary>Education, experience and skills</summary>
              {[
                ["summary", "Professional summary", 4000],
                ["education", "Education", 8000],
                ["experience", "Career experience", 12000],
                ["skills", "Skills", 4000],
                ["projects", "Portfolio projects", 8000],
                ["certifications", "Certifications", 4000],
              ].map(([key, label, max]) => (
                <label key={String(key)}>
                  {label}
                  <textarea
                    aria-label={String(label)}
                    maxLength={Number(max)}
                    value={fields[String(key)] || ""}
                    onChange={(e) =>
                      setFields({ ...fields, [String(key)]: e.target.value })
                    }
                  />
                </label>
              ))}
            </details>
            <label className="linkedin-replace-source">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />{" "}
              Replace filled LinkedIn source sections when importing details or
              resume text
            </label>
            <div className="job-actions">
              <button className="application-primary" type="submit">
                Save details & use in LinkedIn draft
              </button>
              <button type="button" onClick={() => void useSavedProfile()}>
                Use saved profile in LinkedIn draft
              </button>
              <button
                id="linkedin-resume-action"
                type="button"
                onClick={() => void createPdf()}
              >
                Save details & preview resume PDF
              </button>
            </div>
            <p className="linkedin-local-note">
              Resume formatting uses only supplied facts and needs no model. AI
              wording improvements require a connected model.
            </p>
          </fieldset>
        </form>
      </section>
      {pdf && (
        <PdfResumePreview
          key={pdf.id}
          id={pdf.id}
          title={pdf.title}
          text={pdf.content}
          previewId="linkedin-resume-pdf"
          stale={stale}
          staleMessage="Your details changed. Save details & preview resume PDF again before downloading."
          revealRequest={reveal}
          onEdit={() =>
            document
              .getElementById("linkedin-profile-intake")
              ?.scrollIntoView({ block: "start" })
          }
        />
      )}
      <section className="linkedin-workflow-step">
        <h3>
          <FileText size={20} />
          Use a saved resume
        </h3>
        <label>
          Selected career resume
          <select
            aria-label="Selected career resume"
            disabled={busy || disabled}
            value={resume}
            onChange={(e) => setResume(e.target.value)}
          >
            <option value="">Choose a resume</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <div className="job-actions">
          <button
            disabled={!resume || busy || disabled}
            onClick={() => void useResume()}
          >
            Use selected resume as LinkedIn source
          </button>
          <button onClick={() => navigate("Resume Studio")}>
            Upload or manage resumes
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
      <section
        id="linkedin-application-handoff"
        className="linkedin-workflow-step"
      >
        <h3>
          <BriefcaseBusiness size={20} />
          Review a real opportunity
        </h3>
        <p>
          Choose a resume above and a genuine saved vacancy. Preparing creates a
          draft application; it does not mark it submitted. Review profile
          facts, attachments and form answers in the browser assistant before
          approving any final submission.
        </p>
        <label>
          Saved opportunity
          <select
            aria-label="Saved opportunity"
            value={job}
            disabled={busy || disabled}
            onChange={(e) => setJob(e.target.value)}
          >
            <option value="">Choose a saved job</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        {!jobs.length && (
          <p>
            No saved jobs yet. Retrieve and save a vacancy in Job Search first.
          </p>
        )}
        <div className="job-actions">
          <button
            disabled={!job || !resume || busy || disabled}
            onClick={() => void prepare()}
          >
            Prepare selected application
          </button>
          <button
            disabled={!job || !resume || busy || disabled}
            onClick={() => void prepare(true)}
          >
            Review browser auto-fill
          </button>
          <button onClick={() => navigate("Job Search")}>
            Find genuine jobs
            <ArrowRight size={15} />
          </button>
        </div>
        <p className="linkedin-local-note">
          Browser assistance needs the optional browser worker and a visible
          browser. Site login, CAPTCHA, MFA, consent and uploads can require
          manual steps.
        </p>
      </section>
    </section>
  );
}
