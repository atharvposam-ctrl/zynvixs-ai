import { BrowserAssistant } from "./Workflows";
import { useEffect, useState } from "react";
import {
  FileText,
  Search,
  UserRound,
  Zap,
  ChartNoAxesColumn,
  Briefcase,
  ArrowRight,
  Settings,
  GraduationCap,
  Mic,
} from "lucide-react";
type Item = {
  id: string;
  title: string;
  content: string;
  complete: boolean;
  due: string;
};
async function request(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/career/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
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
export function CareerDashboard({
  navigate,
  children,
}: {
  navigate: (page: string) => void;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<Record<string, Item[]>>({}),
    [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const kinds = [
        "profile",
        "resumes",
        "applications",
        "tasks",
        "jobs",
        "interviews",
        "learning",
        "automation",
      ];
      const results = await Promise.all(kinds.map((k) => request(k)));
      setData(Object.fromEntries(kinds.map((k, i) => [k, results[i]])));
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const tools = [
    [
      "AI Resume Builder",
      "Create a draft from your real skills, education and experience.",
      "Resume Studio",
      FileText,
    ],
    [
      "Find opportunities",
      "Review job portal options and connection status.",
      "Job Search",
      Search,
    ],
    [
      "Career profile",
      "Keep your background and job preferences in one place.",
      "Profile Builder",
      UserRound,
    ],
    [
      "Application tracker",
      "Record applications and follow-up notes.",
      "Applications",
      Briefcase,
    ],
    [
      "Browser & automation",
      "Prepare the information required for an application assistant.",
      "Automation",
      Zap,
    ],
    [
      "Interview practice",
      "Keep practice questions and answers.",
      "Interview Prep",
      Mic,
    ],
    [
      "Skills & training",
      "Track what you are learning.",
      "Skills & Training",
      GraduationCap,
    ],
    [
      "Model & connections",
      "Open model and workspace configuration.",
      "Settings",
      Settings,
    ],
  ] as const;
  return (
    <>
      <section className="career-dashboard">
        <div className="dashboard-heading">
          <div>
            <small>YOUR CAREER WORKSPACE</small>
            <h1>Build your next opportunity.</h1>
            <p>
              Create your resume, organize applications and plan your next step.
            </p>
          </div>
          <button onClick={() => navigate("Resume Studio")}>
            Create an AI resume <ArrowRight size={17} />
          </button>
        </div>
        {error && (
          <p role="alert">
            {error}
            <button onClick={() => void load()}>Retry</button>
          </p>
        )}
        <div className="dashboard-stats">
          {[
            ["Saved resumes", data.resumes?.length],
            ["Applications tracked", data.applications?.length],
            ["Open tasks", data.tasks?.filter((t) => !t.complete).length],
            ["Profile sections", data.profile?.length],
            ["Saved jobs", data.jobs?.length],
            ["Interview notes", data.interviews?.length],
            [
              "Learning items completed",
              data.learning?.filter((t) => t.complete).length,
            ],
            ["Automation sessions / notes", data.automation?.length],
          ].map(([label, value]) => (
            <article key={String(label)}>
              <ChartNoAxesColumn size={20} />
              <strong>{value === undefined ? "—" : value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
        <h2>What would you like to work on?</h2>
        <div className="dashboard-tools">
          {tools.map(([title, description, page, Icon]) => (
            <button key={title} onClick={() => navigate(page)}>
              <Icon size={25} />
              <h3>{title}</h3>
              <p>{description}</p>
              <span>Open workspace →</span>
            </button>
          ))}
        </div>
      </section>
      <section className="dashboard-task-editor">
        <h2>Your tasks</h2>
        {children}
      </section>
    </>
  );
}
export { ResumeBuilder } from "./ResumeStudio";
export function AutomationSetup() {
  const [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  return (
    <section className="automation-setup">
      <BrowserAssistant />
      <small>BROWSER APPLICATION ASSISTANT</small>
      <h2>Prepare your application workspace.</h2>
      <p>
        <strong>
          Full-PC control and unattended automation are not provided. Use the
          dedicated browser assistant above for supported forms.
        </strong>{" "}
        Saving this checklist does not start a browser or submit applications.
      </p>
      <div className="automation-columns">
        <article>
          <h3>Information needed from you</h3>
          <ul>
            <li>Full name, email, phone and city.</li>
            <li>Reviewed resume, education, skills and work history.</li>
            <li>
              Target roles, locations, work arrangement and salary expectations.
            </li>
            <li>Work authorization, sponsorship needs and notice period.</li>
            <li>Portfolio, GitHub and LinkedIn URLs.</li>
            <li>
              Selected job listing and truthful answers to screening questions.
            </li>
          </ul>
        </article>
        <article>
          <h3>Connections needed</h3>
          <ul>
            <li>Running local AI model for resume and answer drafting.</li>
            <li>
              Install the optional Playwright package and Chromium, then open a
              dedicated session above.
            </li>
            <li>Your manual sign-in for portals, MFA and CAPTCHA.</li>
            <li>Your review and approval before any final submission.</li>
          </ul>
          <p>
            Do not save passwords, OTPs or API keys in these notes. Use the
            portal’s own login page.
          </p>
        </article>
      </div>
      <p>
        Scheduled execution is not available. Keep this app running while using
        the browser worker; closing it ends the session.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setSaved(false);
          try {
            await request("automation", "POST", {
              title: "Application setup checklist",
              content: notes,
              complete: false,
              due: "",
            });
            setSaved(true);
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <label>
          Your preferences and setup notes
          <textarea
            required
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <button type="submit">Save setup checklist</button>
      </form>
      {saved && (
        <p role="status">Checklist saved locally. No automation has run.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
