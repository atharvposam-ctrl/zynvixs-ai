import { JobSearch, ApplicationTracker } from "./Workflows";
import { CareerDashboard, ResumeBuilder, AutomationSetup } from "./CareerTools";
import { useEffect, useState } from "react";
import App from "./App";
import "./styles/career.css";
import {
  Home,
  ChartNoAxesColumn,
  Search,
  FileText,
  UserRound,
  Mic,
  Layers,
  Mail,
  Zap,
  Folder,
  MessageCircle,
  Settings,
  Bell,
  ShieldCheck,
  SquarePen,
  PanelLeftClose,
  ArrowRight,
  Contact as Linkedin,
} from "lucide-react";
import { useStore } from "./store";
import { Composer } from "./components/Composer";
import { Thread } from "./components/Thread";
import { SettingsDialog } from "./components/Settings";
const pages = [
  "Home",
  "Career Dashboard",
  "Profile Builder",
  "Resume Studio",
  "Job Search",
  "Applications",
  "LinkedIn Optimizer",
  "Interview Prep",
  "Skills & Training",
  "Email Agent",
  "Automation",
  "Projects",
  "Settings",
];
const collections: Record<string, string> = {
  "Career Dashboard": "tasks",
  "Profile Builder": "profile",
  "Resume Studio": "resumes",
  Applications: "applications",
  "LinkedIn Optimizer": "drafts",
  "Interview Prep": "interviews",
  "Skills & Training": "learning",
  "Email Agent": "drafts",
  Automation: "automation",
};
type Row = {
  id: string;
  title: string;
  content: string;
  complete: boolean;
  due: string;
};
async function api(path: string, method = "GET", data?: unknown) {
  const r = await fetch("/api/career/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export default function Career() {
  const [page, updatePage] = useState("Home"),
    [collapsed, collapse] = useState(() => window.innerWidth < 700),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [due, setDue] = useState("");
  function setPage(next: string) {
    updatePage(next);
    if (window.innerWidth < 700) collapse(true);
  }
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 700) collapse(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [uiScale, setUiScale] = useState(() => {
    try {
      return localStorage.getItem("zynvixs.workspaceScale") === "100"
        ? "100"
        : "80";
    } catch {
      return "80";
    }
  });
  const store = useStore();
  const [profile, setProfile] = useState<Row[]>([]),
    [tasks, setTasks] = useState<Row[]>([]),
    [chatSearch, setChatSearch] = useState(false);
  useEffect(() => {
    void store.boot();
    void api("profile")
      .then(setProfile)
      .catch(() => {});
    void api("tasks")
      .then(setTasks)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (page === "Home") {
      void api("profile")
        .then(setProfile)
        .catch(() => {});
      void api("tasks")
        .then(setTasks)
        .catch(() => {});
    }
  }, [page]);
  useEffect(() => {
    document.documentElement.dataset.theme =
      store.settings?.theme === "light" ? "light" : "dark";
  }, [store.settings?.theme]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void useStore.getState().refreshStatus();
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);
  const icons = [
    Home,
    ChartNoAxesColumn,
    UserRound,
    FileText,
    Search,
    FileText,
    Linkedin,
    Mic,
    Layers,
    Mail,
    Zap,
    Folder,
    Settings,
  ];
  const displayName =
    profile.find((r) => /name/i.test(r.title))?.content.trim() || "there";
  const completion = Math.round(
    (["name", "skills", "experience", "preferences"].filter((k) =>
      profile.some(
        (r) => r.title.toLowerCase().includes(k) && r.content.trim(),
      ),
    ).length /
      4) *
      100,
  );
  const kind = collections[page];
  async function refresh() {
    if (!kind) return;
    setLoading(true);
    setError("");
    try {
      setRows(await api(kind));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setRows([]);
    setTitle("");
    setContent("");
    void refresh();
  }, [page]);
  async function save() {
    try {
      await api(kind, "POST", { title, content, due, complete: false });
      setTitle("");
      setContent("");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }
  const shortcuts = [
    "Resume Studio",
    "Job Search",
    "LinkedIn Optimizer",
    "Interview Prep",
    "Skills & Training",
    "Automation",
  ];
  return (
    <div
      style={{
        zoom: Number(uiScale) / 100,
        height: `${10000 / Number(uiScale)}dvh`,
      }}
      className={"career-shell " + (collapsed ? "collapsed" : "")}
    >
      <nav className="career-nav">
        <header>
          <b>ℤ</b> {!collapsed && "Zynvixs AI"}
          <button
            aria-label="Toggle navigation"
            onClick={() => collapse(!collapsed)}
          >
            <PanelLeftClose size={18} />
          </button>
        </header>
        {!collapsed && (
          <>
            <button
              className="new-chat"
              onClick={() => {
                store.newChat();
                setPage("Home");
              }}
            >
              <SquarePen size={18} /> New chat
            </button>
            <button onClick={() => setChatSearch(!chatSearch)}>
              <Search size={18} /> Search chats
            </button>
            {chatSearch && (
              <input
                aria-label="Search saved chats"
                placeholder="Search conversations…"
                value={store.search}
                onChange={(e) => store.setSearch(e.target.value)}
              />
            )}
            <small>WORKSPACE</small>
            {pages.map((p, i) => {
              const Icon = icons[i];
              return (
                <button
                  className={page === p ? "selected" : ""}
                  key={p}
                  onClick={() => {
                    if (p === "Settings") {
                      store.openSettings("general");
                    } else setPage(p);
                  }}
                >
                  <Icon size={19} />
                  {p}
                </button>
              );
            })}
            <div className="nav-divider" />
            <small className="project-label">
              PROJECTS{" "}
              <button
                aria-label="Create project"
                onClick={() => {
                  const name = prompt("Project name");
                  if (name?.trim()) void store.createProject(name.trim());
                }}
              >
                +
              </button>
            </small>
            {store.projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  store.newChat(p.id);
                  setPage("Chat");
                }}
              >
                <Folder size={18} />
                {p.name}
              </button>
            ))}
            <div className="nav-divider" />
            <small>RECENT CHATS</small>
            {store.conversations.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  void store.openConversation(c.id);
                  setPage("Home");
                }}
              >
                <MessageCircle size={17} />
                <span>{c.title}</span>
              </button>
            ))}
            <footer>
              <button onClick={() => store.openSettings("models")}>
                <span
                  className="status-dot"
                  style={{
                    background: store.status?.engine.loaded
                      ? "#42ad60"
                      : "#b18a42",
                  }}
                />
                <span>
                  {store.models.find((m) => m.id === store.settings?.model_id)
                    ?.name || "Local model"}
                  <small>
                    {store.status?.engine.loaded ? "Connected" : "Disconnected"}{" "}
                    · Local model
                  </small>
                </span>
              </button>
              <button onClick={() => setPage("Profile Builder")}>
                <span className="avatar">
                  {displayName === "there"
                    ? "?"
                    : displayName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                </span>
                {displayName === "there" ? "Your profile" : displayName}
              </button>
              <button
                aria-label="Settings"
                onClick={() => store.openSettings("general")}
              >
                <Settings size={20} />
              </button>
            </footer>
          </>
        )}
      </nav>
      <main className="career-main">
        <header className="career-top">
          {page === "Home" ? "Career workspace" : page}
          <div className="top-actions">
            <select
              aria-label="Workspace zoom"
              value={uiScale}
              onChange={(e) => {
                setUiScale(e.target.value);
                try {
                  localStorage.setItem(
                    "zynvixs.workspaceScale",
                    e.target.value,
                  );
                } catch {}
              }}
            >
              <option value="80">80% workspace</option>
              <option value="100">100% workspace</option>
            </select>
            <details>
              <summary>
                <ShieldCheck size={15} /> Private workspace
              </summary>
              Career records and chats are stored locally. Requested job
              searches, browser sessions, model downloads and web research
              contact external services.
            </details>
            <button
              aria-label="View tasks and workflow status"
              title="View tasks and workflow status"
              onClick={() => {
                setPage("Career Dashboard");
              }}
            >
              <Bell size={20} />
            </button>
          </div>
        </header>
        {page === "Home" ? (
          <>
            <div className="home-content">
              {store.messages.length || store.streaming ? (
                <Thread
                  onStarter={(text, mode) => {
                    store.setMode(mode);
                    void store.send(text);
                  }}
                />
              ) : (
                <>
                  <section className="career-welcome">
                    <b>ℤ</b>
                    <h1>
                      Good{" "}
                      {new Date().getHours() < 12
                        ? "morning"
                        : new Date().getHours() < 18
                          ? "afternoon"
                          : "evening"}
                      , {displayName.split(" ")[0]}.<br />
                      <em>What’s your next move?</em>
                    </h1>
                    <p>
                      Your career tools, conversations and next opportunities —
                      in one place.
                    </p>
                  </section>
                  <section className="career-cards">
                    {shortcuts.map((p, i) => (
                      <button key={p} onClick={() => setPage(p)}>
                        <span>
                          {(() => {
                            const Icon = [
                              FileText,
                              Search,
                              Linkedin,
                              Mic,
                              Layers,
                              Zap,
                            ][i];
                            return <Icon size={26} />;
                          })()}
                        </span>
                        <h3>
                          {
                            [
                              "Create a resume",
                              "Find matching jobs",
                              "Optimize LinkedIn",
                              "Practice interviews",
                              "Improve your skills",
                              "Automate applications",
                            ][i]
                          }
                        </h3>
                        <p>
                          {
                            [
                              "Build or improve your resume",
                              "Explore roles that fit your skills",
                              "Strengthen your professional profile",
                              "Prepare with a mock interview",
                              "Learn, practice and track progress",
                              "Review and approve each application",
                            ][i]
                          }
                          <ArrowRight size={18} />
                        </p>
                      </button>
                    ))}
                  </section>
                </>
              )}
            </div>
            <div className="home-composer">
              <Composer />
            </div>
          </>
        ) : ["Chat", "Projects", "Settings"].includes(page) ? (
          <App />
        ) : (
          <section className="career-page">
            {page !== "Career Dashboard" && <h1>{page}</h1>}
            {page === "Resume Studio" && <ResumeBuilder />}
            {page === "Automation" && <AutomationSetup />}
            {page === "Applications" && <ApplicationTracker />}
            {page === "Career Dashboard" && (
              <CareerDashboard
                navigate={(p) => {
                  if (p === "Settings") store.openSettings("models");
                  else setPage(p);
                }}
              >
                <p>
                  Use the form below to create a task with an optional due date.
                </p>
              </CareerDashboard>
            )}
            {page === "Job Search" ? (
              <JobSearch navigate={setPage} />
            ) : (
              <>
                <p>
                  {page === "Career Dashboard"
                    ? "Create tasks and track completion."
                    : page === "Profile Builder"
                      ? "Save named profile sections, including skills, experience and career preferences."
                      : page === "Resume Studio"
                        ? "Save resume text versions. File parsing remains available in the chat workspace."
                        : page === "Email Agent"
                          ? "Save email drafts. Sending and mailbox connections are not configured."
                          : page === "Automation"
                            ? "Save workflow notes. Scheduling and execution are not implemented; no background actions will run."
                            : page === "Interview Prep"
                              ? "Save practice questions and your answers. Automatic feedback is not yet connected."
                              : "Save and manage your work locally."}
                </p>
                {error && (
                  <div role="alert">
                    {error}
                    <button onClick={() => void refresh()}>Retry</button>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <label>
                    Title
                    <input
                      required
                      maxLength={300}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    Details
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </label>
                  {kind === "tasks" && (
                    <label>
                      Due date
                      <input
                        type="date"
                        value={due}
                        onChange={(e) => setDue(e.target.value)}
                      />
                    </label>
                  )}
                  <button type="submit">
                    Save {kind === "tasks" ? "task" : "record"}
                  </button>
                </form>
                {loading ? (
                  <p role="status">Loading…</p>
                ) : rows.length === 0 ? (
                  <p>No saved records yet.</p>
                ) : (
                  rows.map((r) => (
                    <article key={r.id}>
                      <h3>{r.title}</h3>
                      <p style={{ whiteSpace: "pre-wrap" }}>{r.content}</p>
                      {r.due && <p>Due {r.due}</p>}
                      <label>
                        <input
                          type="checkbox"
                          checked={r.complete}
                          onChange={async () => {
                            try {
                              await api(kind + "/" + r.id, "PUT", {
                                ...r,
                                complete: !r.complete,
                              });
                              await refresh();
                            } catch (e) {
                              setError(String(e));
                            }
                          }}
                        />{" "}
                        Complete
                      </label>
                      <button
                        onClick={() => {
                          const blob = new Blob(
                            [r.title + "\n\n" + r.content],
                            { type: "text/plain" },
                          );
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "zynvixs-record.txt";
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }}
                      >
                        Export text
                      </button>
                    </article>
                  ))
                )}
              </>
            )}
          </section>
        )}
      </main>
      {page === "Home" && (
        <aside className="career-summary">
          <h2>Your career at a glance</h2>
          <article>
            <h3>
              <ChartNoAxesColumn size={20} /> Profile completion
            </h3>
            <div className="profile-progress">
              <div
                className="progress-ring"
                style={{
                  background: `conic-gradient(#e6bc65 ${completion}%, #555650 0)`,
                }}
              >
                <span>{completion}%</span>
              </div>
              <div>
                <p>Add your details to get started.</p>
                <button onClick={() => setPage("Profile Builder")}>
                  Complete profile
                </button>
              </div>
            </div>
          </article>
          <article className="matches-card">
            <h3>
              <Search size={21} /> Job matches
            </h3>
            <Search size={30} />
            <h4>Find your next opportunity</h4>
            <p>Add your skills to explore roles.</p>
            <button onClick={() => setPage("Job Search")}>
              Explore jobs →
            </button>
          </article>
          <article>
            <h3>
              <FileText size={18} /> Upcoming tasks
              <button
                aria-label="Add task"
                onClick={() => setPage("Career Dashboard")}
              >
                +
              </button>
            </h3>
            {tasks
              .filter((t) => !t.complete)
              .slice(0, 4)
              .map((t) => (
                <label className="task-row" key={t.id}>
                  <input
                    type="checkbox"
                    checked={t.complete}
                    onChange={async () => {
                      try {
                        await api("tasks/" + t.id, "PUT", {
                          ...t,
                          complete: true,
                        });
                        setTasks(await api("tasks"));
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  />
                  {t.title}
                </label>
              ))}
            {!tasks.some((t) => !t.complete) && (
              <>
                <button
                  className="task-row"
                  onClick={() => setPage("Resume Studio")}
                >
                  ○ Upload your resume
                </button>
                <button
                  className="task-row"
                  onClick={() => setPage("Profile Builder")}
                >
                  ○ Set your career preferences
                </button>
              </>
            )}
          </article>
          <button
            className="dashboard-link"
            onClick={() => setPage("Career Dashboard")}
          >
            View dashboard →
          </button>
        </aside>
      )}
      <SettingsDialog />
    </div>
  );
}
