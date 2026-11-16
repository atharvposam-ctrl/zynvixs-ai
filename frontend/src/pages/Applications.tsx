import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  CalendarClock,
  Check,
  ExternalLink,
  Plus,
  Search,
  X,
} from "lucide-react";
import { call } from "../Workflows";
import { ApplicationBanners } from "../ApplicationBanners";
import { CareerPageFooter } from "../CareerRecommendations";
import { type Row, useRows, Status, download } from "./shared";
const stages = [
  ["saved", "Saved"],
  ["draft", "Preparing"],
  ["reviewing", "Reviewing"],
  ["submitted", "Applied"],
  ["interview", "Interview"],
  ["offer", "Offer"],
  ["rejected", "Rejected"],
  ["withdrawn", "Withdrawn"],
];
const columns = [
  ["saved", "Saved"],
  ["preparing", "Preparing"],
  ["submitted", "Applied"],
  ["interview", "Interview"],
  ["offer", "Offer"],
  ["rejected", "Rejected"],
  ["withdrawn", "Withdrawn"],
];
const label = (value: string) =>
  stages.find(([key]) => key === value)?.[1] || value;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const stage = (r: Row) => r.status || "draft";
const bucket = (r: Row) =>
  ["draft", "reviewing"].includes(stage(r)) ? "preparing" : stage(r);
const isDraft = (r: Row) => ["saved", "draft", "reviewing"].includes(stage(r));
const url = (row: Row) =>
  /^https:\/\/\S+$/.test(row.metadata?.listing_url || "")
    ? row.metadata?.listing_url
    : /^https:\/\/\S+$/.test(row.content)
      ? row.content
      : "";
const dateText = (s: string) =>
  s
    ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleString(
        undefined,
        s.length === 10
          ? { dateStyle: "medium" }
          : { dateStyle: "medium", timeStyle: "short" },
      )
    : "Not recorded";
type Context = {
  job: any;
  resume: { id: string; title: string } | null;
  profile: Record<string, string>;
  tasks: Row[];
};
export function ApplicationsBoard({
  navigate,
}: {
  navigate: (page: string) => void;
}) {
  const state = useRows("applications");
  const [view, setView] = useState("board"),
    [edit, setEdit] = useState<Row | null>(null),
    [base, setBase] = useState(""),
    [resumes, setResumes] = useState<Row[]>([]),
    [tasks, setTasks] = useState<Row[]>([]);
  const [filter, setFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [detailError, setDetailError] = useState("");
  const [context, setContext] = useState<Context | null>(null),
    [contextLoading, setContextLoading] = useState(false),
    [contextError, setContextError] = useState(""),
    [contextRetry, setContextRetry] = useState(0),
    [reminderKind, setReminderKind] = useState("follow_up");
  const drawer = useRef<HTMLDialogElement>(null),
    workspace = useRef<HTMLDivElement>(null);
  const dirty = !!edit && JSON.stringify(edit) !== base;
  async function loadRelated() {
    try {
      const [r, t] = await Promise.all([
        call("career/resumes"),
        call("career/tasks"),
      ]);
      setResumes(r);
      setTasks(t);
    } catch (e) {
      state.setError(String(e));
    }
  }
  useEffect(() => {
    void loadRelated();
  }, []);
  useEffect(() => {
    if (edit && drawer.current && !drawer.current.open)
      drawer.current.showModal();
  }, [edit]);
  useEffect(() => {
    let alive = true;
    setContext(null);
    setContextError("");
    if (!edit?.id) {
      setContextLoading(false);
      return;
    }
    setContextLoading(true);
    void call("career-workspace/applications/" + edit.id + "/context")
      .then((r) => {
        if (alive) setContext(r);
      })
      .catch((e) => {
        if (alive) setContextError(String(e));
      })
      .finally(() => {
        if (alive) setContextLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [edit?.id, contextRetry]);
  function open(row: Row) {
    const next = { ...row, metadata: { ...row.metadata } };
    setEdit(next);
    setBase(JSON.stringify(next));
    setDetailError("");
    setMessage("");
  }
  function close() {
    if (dirty && !confirm("Discard unsaved application details?")) return;
    drawer.current?.close();
    setEdit(null);
    setDetailError("");
  }
  function newApplication() {
    open({
      id: "",
      title: "",
      content: "",
      complete: false,
      due: "",
      status: "draft",
      resume_id: "",
      metadata: {},
    });
  }
  function meta(key: string, value: string) {
    if (!edit) return;
    const next = { ...edit.metadata, [key]: value };
    const oldTitle = [edit.metadata?.role, edit.metadata?.company]
      .filter(Boolean)
      .join(" — ");
    const title =
      ["role", "company"].includes(key) &&
      (!edit.title || edit.title === oldTitle)
        ? [next.role, next.company].filter(Boolean).join(" — ")
        : edit.title;
    setEdit({ ...edit, title, metadata: next });
  }
  function moveView(next: string, preset = "") {
    setView(next);
    setStatusFilter(preset);
    setFilter("");
    setFrom("");
    setTo("");
    requestAnimationFrame(() =>
      workspace.current?.scrollIntoView({ block: "start" }),
    );
  }
  async function change(row: Row, status: string) {
    if (
      status === "submitted" &&
      stage(row) !== "submitted" &&
      !confirm(
        "Have you verified the employer’s actual confirmation that this application was received?",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    state.setError("");
    try {
      const result = await call("career/applications/" + row.id, "PUT", {
        ...row,
        status,
        submission_verified:
          status === "submitted" || !!row.submission_verified,
        metadata: {
          ...row.metadata,
          ...(status === "submitted" && !row.metadata?.application_date
            ? { application_date: today() }
            : {}),
        },
      });
      if (edit?.id === row.id) open(result);
      await state.load();
      setMessage("Application status saved.");
    } catch (e) {
      state.setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(row: Row) {
    const result: Row = await call(
      "career/applications" + (row.id ? "/" + row.id : ""),
      row.id ? "PUT" : "POST",
      row,
    );
    setEdit(result);
    setBase(JSON.stringify(result));
    setContextRetry((n) => n + 1);
    await state.load();
    return result;
  }
  async function saveDetails() {
    if (!edit) return;
    setBusy(true);
    setMessage("");
    setDetailError("");
    try {
      await save(edit);
      setMessage("Application details saved.");
    } catch (e) {
      setDetailError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function createReminder() {
    if (!edit) return;
    const due =
      reminderKind === "follow_up"
        ? edit.due
        : edit.metadata?.[
            reminderKind === "interview" ? "interview_date" : "deadline"
          ];
    if (!due) {
      setDetailError("Choose a date for this reminder first.");
      return;
    }
    setBusy(true);
    setMessage("");
    setDetailError("");
    try {
      const saved = await save(edit);
      await call(
        "career-workspace/applications/" + saved.id + "/reminder",
        "POST",
        { due, kind: reminderKind },
      );
      await loadRelated();
      setContextRetry((n) => n + 1);
      setMessage(
        "Reminder saved. It appears here and on Career Dashboard; existing reminders are reused.",
      );
    } catch (e) {
      setDetailError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function completeTask(task: Row) {
    const before = tasks;
    setTasks((items) =>
      items.map((t) =>
        t.id === task.id ? { ...t, complete: !task.complete } : t,
      ),
    );
    setBusy(true);
    try {
      await call("career/tasks/" + task.id, "PUT", {
        ...task,
        complete: !task.complete,
      });
      await loadRelated();
      setMessage("Reminder completion saved.");
    } catch (e) {
      setTasks(before);
      state.setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function prepare(destination: string) {
    if (!edit) return;
    setBusy(true);
    setMessage("");
    setDetailError("");
    try {
      if (destination === "Automation") {
        if (!context?.job)
          throw new Error(
            "This application has no cached supported job. Open Job Search and choose Application auto-fill on a retrieved listing.",
          );
        sessionStorage.setItem("zynvixs.browser-job", context.job.id);
      } else {
        if (edit.resume_id)
          await call("career/actions/active-resume", "PUT", {
            id: edit.resume_id,
          });
        if (destination === "Resume Studio" && context?.job?.description)
          sessionStorage.setItem(
            "zynvixs.tailor-description",
            context.job.description,
          );
        if (destination === "Interview Prep")
          sessionStorage.setItem(
            "zynvixs.interview-role",
            edit.metadata?.role || edit.title,
          );
      }
      drawer.current?.close();
      setEdit(null);
      navigate(destination);
    } catch (e) {
      setDetailError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const appTasks = tasks.filter((t) =>
    state.rows.some((r) => r.id === t.metadata?.application_id),
  );
  const rows = state.rows.filter((r) => {
    const q = filter.toLowerCase().trim(),
      date =
        r.metadata?.application_date ||
        r.metadata?.created_at?.slice(0, 10) ||
        "";
    return (
      (!q ||
        [
          r.title,
          r.metadata?.role,
          r.metadata?.company,
          r.metadata?.location,
          r.metadata?.recruiter_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)) &&
      (!statusFilter ||
        (statusFilter === "unfinished"
          ? isDraft(r)
          : statusFilter === "preparing"
            ? bucket(r) === "preparing"
            : stage(r) === statusFilter)) &&
      (!from || (date && date >= from)) &&
      (!to || (date && date <= to))
    );
  });
  const linkedTasks = (r: Row) =>
    appTasks.filter((t) => t.metadata?.application_id === r.id && !t.complete);
  const activity = [
    ...state.rows.flatMap((r) =>
      (r.metadata?.history || []).map((h: any, i: number) => ({
        id: r.id + "-" + i,
        at: h.at,
        text: `${h.from ? label(h.from) : "Created"} → ${label(h.to)}`,
        row: r,
      })),
    ),
    ...appTasks.flatMap((t) =>
      (t.metadata?.completion_history || []).map((h: any, i: number) => ({
        id: "task-" + t.id + "-" + i,
        at: h.at,
        text:
          (h.complete ? "Completed reminder: " : "Reopened reminder: ") +
          t.title,
        row: state.rows.find((r) => r.id === t.metadata?.application_id)!,
      })),
    ),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  function card(row: Row) {
    return (
      <article
        className="application-card"
        draggable={!busy}
        key={row.id}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", row.id)}
      >
        <div className="application-card-top">
          <span className="application-company-mark" aria-hidden="true">
            {(row.metadata?.company || row.title).slice(0, 2).toUpperCase()}
          </span>
          <span className={"application-stage stage-" + stage(row)}>
            {label(stage(row))}
          </span>
        </div>
        <h3>{row.title}</h3>
        {row.metadata?.company && <p>{row.metadata.company}</p>}
        <p>{row.metadata?.location || "Location not recorded"}</p>
        <p className="application-card-date">
          <CalendarClock size={14} />
          {row.due
            ? "Next follow-up: " + dateText(row.due)
            : row.metadata?.next_action || "Set your next action"}
        </p>
        <small>
          {row.resume_id
            ? "Resume: " +
              (resumes.find((r) => r.id === row.resume_id)?.title ||
                "Linked version unavailable")
            : "No resume version linked"}
        </small>
        {linkedTasks(row).length > 0 && (
          <small>
            {linkedTasks(row).length} open reminder
            {linkedTasks(row).length === 1 ? "" : "s"}
          </small>
        )}
        <button onClick={() => open(row)}>
          Open application details
          <ArrowRight size={14} />
        </button>
        <label>
          Status
          <select
            aria-label="Status"
            disabled={busy}
            value={stage(row)}
            onChange={(e) => void change(row, e.target.value)}
          >
            {stages.map(([id, text]) => (
              <option key={id} value={id}>
                {text}
              </option>
            ))}
          </select>
        </label>
      </article>
    );
  }
  return (
    <section className="studio-workspace applications-workspace">
      <div className="applications-heading">
        <div>
          <small>YOUR APPLICATION COMMAND CENTER</small>
          <h2>Every opportunity. A clear next step.</h2>
          <p>
            Track your real applications, prepare thoughtfully and follow up on
            time.
          </p>
        </div>
        <button className="application-primary" onClick={newApplication}>
          <Plus size={17} />
          Track an application manually
        </button>
      </div>
      <Status state={state} />
      {message && !edit && (
        <p role="status" className="application-message">
          {message}
        </p>
      )}
      <div className="application-stat-grid">
        {[
          {
            text: "Applications tracked",
            value: state.rows.length,
            run: () => moveView("board"),
          },
          {
            text: "Awaiting response",
            value: state.rows.filter((r) => stage(r) === "submitted").length,
            run: () => moveView("list", "submitted"),
          },
          {
            text: "Interviews",
            value: state.rows.filter((r) => stage(r) === "interview").length,
            run: () => moveView("list", "interview"),
          },
          {
            text: "Offers",
            value: state.rows.filter((r) => stage(r) === "offer").length,
            run: () => moveView("list", "offer"),
          },
        ].map((s) => (
          <button key={s.text} onClick={s.run}>
            <span>{s.text}</span>
            <strong>{state.loading ? "—" : s.value}</strong>
            <small>
              View saved records
              <ArrowRight size={13} />
            </small>
          </button>
        ))}
      </div>
      <ApplicationBanners
        drafts={state.rows.filter(isDraft).length}
        navigate={navigate}
        onDrafts={() =>
          moveView("board", state.rows.some(isDraft) ? "unfinished" : "")
        }
        onReminders={() => moveView("reminders")}
        onActivity={() => moveView("activity")}
      />
      <div className="application-work-area" ref={workspace}>
        <div className="application-view-tabs">
          {[
            ["board", "Kanban board"],
            ["list", "List view"],
            ["reminders", "Reminders"],
            ["activity", "Activity history"],
          ].map(([key, text]) => (
            <button
              key={key}
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {text}
            </button>
          ))}
        </div>
        {["board", "list"].includes(view) && (
          <>
            <div className="application-filters">
              <label>
                <Search size={15} />
                Filter applications
                <input
                  aria-label="Filter applications"
                  placeholder="Company, role or recruiter…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
              <label>
                Application stage
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All stages</option>
                  <option value="unfinished">Saved & preparing</option>
                  {columns.map(([key, text]) => (
                    <option key={key} value={key}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Application / created date from
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                Application / created date to
                <input
                  type="date"
                  min={from || undefined}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <button
                onClick={() => {
                  setFilter("");
                  setStatusFilter("");
                  setFrom("");
                  setTo("");
                }}
              >
                Clear filters
              </button>
            </div>
            <p className="application-method">
              {rows.length} matching saved application
              {rows.length === 1 ? "" : "s"}. Opening a listing never marks it
              Applied. Applied requires your confirmation.
            </p>
            {!state.loading && !state.rows.length && (
              <div className="application-empty">
                <Bookmark size={27} />
                <h3>Your application journey starts here</h3>
                <p>
                  Choose a genuine job in Job Search or track an external
                  opportunity manually.
                </p>
                <button onClick={() => navigate("Job Search")}>
                  Find opportunities
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
            {state.rows.length > 0 && !rows.length && (
              <p>No applications match these filters.</p>
            )}
            {view === "board" ? (
              <div
                className="applications-board"
                aria-label="Application status board"
              >
                {columns.map(([id, text]) => (
                  <section
                    key={id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const row = state.rows.find(
                        (r) => r.id === e.dataTransfer.getData("text/plain"),
                      );
                      if (row)
                        void change(row, id === "preparing" ? "draft" : id);
                    }}
                  >
                    <h3>
                      {text}
                      <span>{rows.filter((r) => bucket(r) === id).length}</span>
                    </h3>
                    {rows.filter((r) => bucket(r) === id).map(card)}
                    {!rows.some((r) => bucket(r) === id) && (
                      <p className="application-column-empty">
                        No applications here yet
                      </p>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="applications-list">{rows.map(card)}</div>
            )}
          </>
        )}
        {view === "reminders" && (
          <section className="application-reminders">
            <h3>Application reminders</h3>
            <p>
              Tasks are saved locally and also appear on Career Dashboard. Keep
              the app open to view them; no background email or OS alert is
              claimed.
            </p>
            {!appTasks.length && (
              <p>
                No application reminders yet. Open an application, choose a date
                and create a reminder.
              </p>
            )}
            {[...appTasks]
              .sort((a, b) => a.due.localeCompare(b.due))
              .map((t) => (
                <article key={t.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={t.complete}
                      disabled={busy}
                      onChange={() => void completeTask(t)}
                    />
                    {t.title}
                  </label>
                  <span>
                    {dateText(t.due)} ·{" "}
                    {t.complete
                      ? "Completed"
                      : t.due < today()
                        ? "Overdue"
                        : "Upcoming"}
                  </span>
                  <button
                    onClick={() => {
                      const row = state.rows.find(
                        (r) => r.id === t.metadata?.application_id,
                      );
                      if (row) open(row);
                    }}
                  >
                    Open linked application
                  </button>
                </article>
              ))}
          </section>
        )}
        {view === "activity" && (
          <section className="application-activity">
            <h3>Your saved application activity</h3>
            <p>
              Recorded status changes and reminder completion events. Older
              records may not contain creation dates or completion history.
            </p>
            {!activity.length && <p>No recorded status changes yet.</p>}
            {activity.map((a) => (
              <article key={a.id}>
                <Check size={18} />
                <div>
                  <h4>{a.row.title}</h4>
                  <p>{a.text}</p>
                  <small>{dateText(a.at)}</small>
                </div>
                <button onClick={() => open(a.row)}>Review application</button>
              </article>
            ))}
          </section>
        )}
      </div>
      {edit && (
        <dialog
          ref={drawer}
          className="application-drawer"
          aria-label="Application details panel"
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <header>
            <div>
              <small>{edit.id ? label(stage(edit)) : "NEW OPPORTUNITY"}</small>
              <h2>
                {edit.id ? "Application details" : "Track external application"}
              </h2>
            </div>
            <button aria-label="Close application details" onClick={close}>
              <X size={21} />
            </button>
          </header>
          {detailError && <p role="alert">{detailError}</p>}
          {message && (
            <p role="status" className="application-message">
              {message}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveDetails();
            }}
          >
            <fieldset disabled={busy} className="application-detail-fields">
              <label>
                Role and company
                <input
                  required
                  maxLength={300}
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </label>
              <div className="application-detail-grid">
                {[
                  ["company", "Company"],
                  ["role", "Role"],
                  ["location", "Location"],
                  ["next_action", "Next action"],
                ].map(([key, text]) => (
                  <label key={key}>
                    {text}
                    <input
                      maxLength={200}
                      value={edit.metadata?.[key] || ""}
                      onChange={(e) => meta(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label>
                Original listing URL / details
                <textarea
                  aria-label="Original listing URL / details"
                  value={edit.content}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      content: e.target.value,
                      metadata: {
                        ...edit.metadata,
                        listing_url: /^https:\/\/\S+$/.test(e.target.value)
                          ? e.target.value
                          : "",
                      },
                    })
                  }
                />
              </label>
              {url(edit) && (
                <a href={url(edit)} target="_blank" rel="noopener noreferrer">
                  Open original listing
                  <ExternalLink size={14} />
                </a>
              )}
              <label>
                Resume version
                <select
                  aria-label="Resume version"
                  value={edit.resume_id || ""}
                  onChange={(e) =>
                    setEdit({ ...edit, resume_id: e.target.value })
                  }
                >
                  <option value="">No linked resume</option>
                  {edit.resume_id &&
                    !resumes.some((r) => r.id === edit.resume_id) && (
                      <option value={edit.resume_id}>
                        Linked version unavailable
                      </option>
                    )}
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
              {edit.resume_id &&
                resumes.some((r) => r.id === edit.resume_id) && (
                  <a
                    href={
                      "/api/career/resumes/" +
                      edit.resume_id +
                      "/export?format=pdf"
                    }
                  >
                    Export linked resume PDF
                  </a>
                )}
              <label>
                Cover letter used
                <textarea
                  maxLength={16000}
                  value={edit.metadata?.cover_letter || ""}
                  onChange={(e) => meta("cover_letter", e.target.value)}
                />
              </label>
              {edit.metadata?.cover_letter && (
                <button
                  type="button"
                  onClick={() =>
                    download(
                      "application-cover-letter.txt",
                      edit.metadata?.cover_letter,
                    )
                  }
                >
                  Download cover letter text
                </button>
              )}
              <div className="application-detail-grid">
                {[
                  ["application_date", "Application date"],
                  ["interview_date", "Interview date"],
                  ["deadline", "Application deadline"],
                ].map(([key, text]) => (
                  <label key={key}>
                    {text}
                    <input
                      type="date"
                      value={edit.metadata?.[key] || ""}
                      onChange={(e) => meta(key, e.target.value)}
                    />
                  </label>
                ))}
                <label>
                  Deadline / follow-up date
                  <input
                    type="date"
                    value={edit.due}
                    onChange={(e) => setEdit({ ...edit, due: e.target.value })}
                  />
                </label>
              </div>
              <h3>Recruiter contact</h3>
              <div className="application-detail-grid">
                {[
                  ["recruiter_name", "Recruiter name", "text"],
                  ["recruiter_email", "Recruiter email", "email"],
                  ["recruiter_phone", "Recruiter phone", "tel"],
                ].map(([key, text, type]) => (
                  <label key={key}>
                    {text}
                    <input
                      type={type}
                      maxLength={250}
                      value={edit.metadata?.[key] || ""}
                      onChange={(e) => meta(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label>
                Notes
                <textarea
                  aria-label="Notes"
                  maxLength={16000}
                  value={edit.metadata?.notes || ""}
                  onChange={(e) => meta("notes", e.target.value)}
                />
              </label>
              <div className="application-detail-actions">
                <button className="application-primary" type="submit">
                  {busy ? "Saving…" : "Save application details"}
                </button>
                <button type="button" onClick={close}>
                  Close details
                </button>
              </div>
            </fieldset>
          </form>
          {edit.id && (
            <>
              <section className="application-detail-section">
                <h3>Follow-ups & dates</h3>
                <label>
                  Reminder type
                  <select
                    aria-label="Reminder type"
                    value={reminderKind}
                    onChange={(e) => setReminderKind(e.target.value)}
                  >
                    <option value="follow_up">Follow-up date</option>
                    <option value="interview">Interview date</option>
                    <option value="deadline">Application deadline</option>
                  </select>
                </label>
                <button
                  disabled={busy || !edit.title.trim()}
                  onClick={() => void createReminder()}
                >
                  Create a dashboard reminder task
                </button>
                <p>
                  Uses the selected date field above and saves your details
                  first. Duplicate reminders are reused. View reminders in this
                  app or Career Dashboard.
                </p>
              </section>
              <section className="application-detail-section">
                <h3>Reviewed application assistant</h3>
                {contextLoading && (
                  <p role="status">Loading saved application context…</p>
                )}
                {contextError && (
                  <p role="alert">
                    {contextError}
                    <button onClick={() => setContextRetry((n) => n + 1)}>
                      Retry application context
                    </button>
                  </p>
                )}
                {context && (
                  <>
                    <p>
                      Saved profile:{" "}
                      {context.profile.name || "Name not entered"} ·{" "}
                      {context.profile.email || "Email not entered"}
                    </p>
                    <p>
                      Linked resume:{" "}
                      {context.resume?.title || "No available linked resume"}
                    </p>
                    <p>
                      {context.job
                        ? "A supported cached listing is available."
                        : "No supported cached listing is linked. Use Job Search to choose one for browser assistance."}
                    </p>
                  </>
                )}
                <p>
                  Review profile facts and screening answers. Browser setup,
                  login, uploads, CAPTCHA and MFA may need your input; final
                  submission requires your approval.
                </p>
                {dirty && <p>Save your changes before opening another tool.</p>}
                <div className="job-actions">
                  <button
                    disabled={busy || dirty}
                    onClick={() => {
                      drawer.current?.close();
                      setEdit(null);
                      navigate("Profile Builder");
                    }}
                  >
                    Review saved profile
                  </button>
                  <button
                    disabled={
                      busy ||
                      dirty ||
                      !edit.resume_id ||
                      !resumes.some((r) => r.id === edit.resume_id)
                    }
                    onClick={() => void prepare("Resume Studio")}
                  >
                    Tailor linked resume
                  </button>
                  <button
                    disabled={busy || dirty || !edit.resume_id}
                    onClick={() => void prepare("Interview Prep")}
                  >
                    Prepare for this interview
                  </button>
                  <button
                    disabled={busy || dirty || !context?.job}
                    onClick={() => void prepare("Automation")}
                  >
                    Open reviewed browser assistant
                  </button>
                </div>
              </section>
              <section className="application-detail-section">
                <h3>Status history</h3>
                {edit.metadata?.history?.length ? (
                  edit.metadata.history.map((h: any, i: number) => (
                    <p key={i}>
                      {dateText(h.at)}: {h.from ? label(h.from) : "Created"} →{" "}
                      {label(h.to)}
                    </p>
                  ))
                ) : (
                  <p>No recorded status changes yet.</p>
                )}
              </section>
            </>
          )}
        </dialog>
      )}
      <CareerPageFooter navigate={navigate} />
    </section>
  );
}
