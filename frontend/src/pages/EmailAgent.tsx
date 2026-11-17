import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Mail,
  Plus,
  RefreshCw,
  Paperclip,
} from "lucide-react";
import { call } from "../Workflows";
import { EmailBanners } from "../EmailBanners";
import { CareerPageFooter } from "../CareerRecommendations";
import { type Row, useRows, Status, ModelNotice } from "./shared";
const purposes: Record<string, string> = {
  introduction:
    "Draft a concise recruiter introduction using only my approved profile and selected resume. Do not invent achievements, availability or the recipient address.",
  application:
    "Draft a professional application email for my selected tracked application using approved profile/resume facts. Do not claim I submitted anything.",
  followup:
    "Draft a polite follow-up about the selected tracked application. Use only recorded dates and facts; do not invent an earlier conversation or commitment.",
  thankyou:
    "Draft a brief interview thank-you using only the interview details I provide. Do not invent an interview, names, discussion topics or commitments.",
  reply:
    "Draft an interview response to the selected email using only my approved facts and instructions. Do not invent availability or accept terms on my behalf.",
};
const attachmentUrl = (id: string) =>
  "/api/career/resumes/" +
  encodeURIComponent(id) +
  "/export?format=pdf&inline=true";
function fresh(): Row {
  return {
    id: "",
    title: "",
    content: "",
    complete: false,
    due: "",
    resume_id: "",
    metadata: {
      kind: "email",
      to: "",
      application_id: "",
      resume_format: "pdf",
    },
  };
}
export function EmailStudio({
  navigate,
}: {
  navigate: (page: string) => void;
}) {
  const drafts = useRows("drafts"),
    history = useRows("mail_history"),
    inbox = useRows("mail");
  const [tasks, setTasks] = useState<Row[]>([]),
    [applications, setApplications] = useState<Row[]>([]),
    [resumes, setResumes] = useState<Row[]>([]),
    [connection, setConnection] = useState<any>(null),
    [tested, setTested] = useState<Record<string, string>>({}),
    [setupOpen, setSetupOpen] = useState(false);
  const [view, setView] = useState("inbox"),
    [read, setRead] = useState<Row | null>(null),
    [edit, setEdit] = useState<Row | null>(null),
    [base, setBase] = useState(""),
    [review, setReview] = useState<any>(null),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [appFilter, setAppFilter] = useState(""),
    [attemptFilter, setAttemptFilter] = useState(""),
    [purpose, setPurpose] = useState(purposes.introduction),
    [source, setSource] = useState(""),
    [template, setTemplate] = useState("introduction"),
    [aiApplication, setAiApplication] = useState(""),
    [aiResume, setAiResume] = useState(""),
    [aiOpen, setAiOpen] = useState(false),
    [due, setDue] = useState("");
  const work = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLFormElement>(null);
  const dirty = !!edit && JSON.stringify(edit) !== base;
  async function loadContext() {
    setError("");
    try {
      const [c, a, r, t] = await Promise.all([
        call("career-mail/status"),
        call("career/applications"),
        call("career/resumes"),
        call("career/tasks"),
      ]);
      setConnection(c);
      setSetupOpen(!c.smtp_configured || !c.imap_configured);
      setApplications(a);
      setResumes(r);
      setTasks(t.filter((x: Row) => x.metadata?.kind === "email_followup"));
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void loadContext();
  }, []);
  function resetReview() {
    setReview(null);
    setApproved(false);
  }
  function changed(row: Row) {
    setEdit(row);
    resetReview();
    setMessage("");
  }
  function switchView(next: string) {
    setView(next);
    setRead(null);
    setSearch("");
    setAppFilter("");
    requestAnimationFrame(() =>
      work.current?.scrollIntoView({ block: "start" }),
    );
  }
  function openDraft(row: Row) {
    if (
      dirty &&
      row.id !== edit?.id &&
      !confirm("Discard unsaved edits before opening another draft?")
    )
      return;
    setEdit(row);
    setBase(JSON.stringify(row));
    resetReview();
    setView("drafts");
    setMessage("Draft opened locally. No message sent.");
  }
  function compose(focusAttachment = false) {
    if (
      dirty &&
      !confirm("Discard unsaved edits before starting another draft?")
    )
      return;
    const row = fresh();
    setEdit(row);
    setBase(JSON.stringify(row));
    resetReview();
    setView("drafts");
    setMessage("");
    requestAnimationFrame(() => {
      work.current?.scrollIntoView({ block: "start" });
      if (focusAttachment)
        document.getElementById("email-resume-attachment")?.focus();
    });
  }
  function startTemplate(kind: string) {
    setTemplate(kind);
    setPurpose(purposes[kind]);
    setAiOpen(true);
    setView("drafts");
    setMessage(
      "Review the instructions and context, then generate. No email has been sent.",
    );
    requestAnimationFrame(() =>
      document.getElementById("email-ai-instructions")?.focus(),
    );
  }
  async function testConnection(protocol: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await call("career-mail/test/" + protocol, "POST", {});
      setTested((v) => ({
        ...v,
        [protocol]: "Connected · checked " + new Date().toLocaleTimeString(),
      }));
      setMessage(r.message);
    } catch (e) {
      setTested((v) => ({ ...v, [protocol]: "Last check failed" }));
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function retrieve() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await call("career-mail/inbox", "POST", {});
      await inbox.load();
      setView("inbox");
      setMessage(
        "Read-only inbox retrieval completed. Messages are cached locally.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!edit) throw new Error("Compose or open a draft first.");
    const r: Row = edit.id
      ? await call("career/drafts/" + edit.id, "PUT", edit)
      : await call("career-mail/drafts", "POST", {
          to: edit.metadata?.to || "",
          subject: edit.title,
          body: edit.content,
          resume_id: edit.resume_id || "",
          resume_format: edit.metadata?.resume_format || "pdf",
          application_id: edit.metadata?.application_id || "",
          source_mail_id: edit.metadata?.source_mail_id || "",
        });
    setEdit(r);
    setBase(JSON.stringify(r));
    resetReview();
    await drafts.load();
    return r;
  }
  async function saveClick() {
    if (!composer.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await save();
      setMessage("Draft saved locally; no message sent.");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (
      dirty &&
      !confirm(
        "Replace the currently edited draft with a new AI draft? Unsaved edits will be discarded.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await call("career-mail/draft-ai", "POST", {
        purpose,
        source_mail_id: source,
        application_id: aiApplication,
        resume_id: aiResume,
      });
      setEdit(r);
      setBase(JSON.stringify(r));
      resetReview();
      await drafts.load();
      setView("drafts");
      setMessage(
        "AI draft saved. Enter a recipient and review all text and attachments before sending.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function reviewDraft() {
    if (!edit) return;
    if (!composer.current?.reportValidity()) return;
    if (!edit.metadata?.to) {
      setError("Enter one recipient email before reviewing for sending.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const row = await save();
      setReview(
        await call("career-mail/drafts/" + row.id + "/review", "POST", {}),
      );
      setApproved(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!edit || !review) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await call("career-mail/drafts/" + edit.id + "/send", "POST", {
        approved,
        review_hash: review.review_hash,
      });
      setMessage(r.message);
      resetReview();
      await history.load();
    } catch (e) {
      setError(String(e));
      await history.load();
    } finally {
      setBusy(false);
    }
  }
  async function reminder(kind: "drafts" | "mail") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!due) throw new Error("Choose a follow-up date first.");
      let id = read?.id;
      if (kind === "drafts") {
        if (!composer.current?.reportValidity()) return;
        id = (await save()).id;
      }
      if (!id) throw new Error("Select a message or save a draft first.");
      await call(
        "career-mail/" +
          (kind === "mail" ? "messages" : "drafts") +
          "/" +
          id +
          "/reminder",
        "POST",
        { due },
      );
      const rows = await call("career/tasks");
      setTasks(rows.filter((r: Row) => r.metadata?.kind === "email_followup"));
      setMessage(
        "Email follow-up saved locally. No email is scheduled or sent; duplicate tasks are reused.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function complete(task: Row) {
    const before = tasks;
    setTasks((rows) =>
      rows.map((r) =>
        r.id === task.id ? { ...r, complete: !task.complete } : r,
      ),
    );
    setBusy(true);
    setError("");
    try {
      await call("career/tasks/" + task.id, "PUT", {
        ...task,
        complete: !task.complete,
      });
      setMessage("Follow-up completion saved.");
    } catch (e) {
      setTasks(before);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function linkMessage(application_id: string) {
    if (!read) return;
    setBusy(true);
    setError("");
    try {
      const r = await call("career/mail/" + read.id, "PUT", {
        ...read,
        metadata: { ...read.metadata, application_id },
      });
      setRead(r);
      await inbox.load();
      setMessage(
        "Message linked locally. The external mailbox was not changed.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function useApplication() {
    if (!edit) return;
    const a = applications.find((a) => a.id === edit.metadata?.application_id);
    if (!a) return;
    changed({
      ...edit,
      resume_id: edit.resume_id || a.resume_id || "",
      metadata: {
        ...edit.metadata,
        to: edit.metadata?.to || a.metadata?.recruiter_email || "",
      },
    });
    setMessage(
      "Available recruiter email and resume were used only in empty fields. Review before sending.",
    );
  }
  const emailDrafts = drafts.rows.filter((r) => r.metadata?.kind === "email");
  const inboxRows = [...inbox.rows].sort(
    (a, b) =>
      String(b.metadata?.fetched_at || "").localeCompare(
        String(a.metadata?.fetched_at || ""),
      ) || (a.metadata?.fetch_rank || 0) - (b.metadata?.fetch_rank || 0),
  );
  const rows = (
    view === "inbox"
      ? inboxRows
      : view === "sent"
        ? [...history.rows].sort((a, b) =>
            String(b.metadata?.at || "").localeCompare(
              String(a.metadata?.at || ""),
            ),
          )
        : emailDrafts
  ).filter(
    (r) =>
      (!search ||
        [r.title, r.content, r.metadata?.to, r.metadata?.from]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!appFilter || r.metadata?.application_id === appFilter) &&
      (!(view === "sent" && attemptFilter) ||
        r.metadata?.state === attemptFilter),
  );
  const applicationName = (id: string) =>
    applications.find((r) => r.id === id)?.title ||
    "Linked application unavailable";
  return (
    <section className="studio-workspace email-workspace">
      <div className="email-workspace-heading">
        <div>
          <small>YOUR CAREER CONVERSATIONS</small>
          <h2>Thoughtful messages. You approve every send.</h2>
          <p>Write, review and track your career emails in one workspace.</p>
        </div>
        <button
          className="application-primary"
          disabled={busy}
          onClick={() => compose()}
        >
          <Plus size={17} />
          Compose manually
        </button>
      </div>
      <div className="email-connection-bar">
        <span>
          <Mail size={18} />
          SMTP:{" "}
          {!connection
            ? "Not checked"
            : connection.smtp_configured
              ? tested.smtp || "Configured · not tested"
              : "Setup required"}
        </span>
        <span>
          IMAP:{" "}
          {!connection
            ? "Not checked"
            : connection.imap_configured
              ? tested.imap || "Configured · not tested"
              : "Setup required"}
        </span>
        <button onClick={() => setSetupOpen(!setupOpen)}>
          Mail connection & secure setup
        </button>
      </div>
      <details
        className="email-connection-setup"
        open={setupOpen}
        onToggle={(e) => setSetupOpen(e.currentTarget.open)}
      >
        <summary>Connection settings</summary>
        <p>{connection?.support || "Loading backend connection status…"}</p>
        <p>
          Set these environment variables in the terminal that launches Zynvixs,
          then restart. Use provider-supported app passwords. Never paste
          credentials into drafts, profile fields or source control. OAuth-only
          accounts need an integration that is not implemented.
        </p>
        <pre>
          ZYNVIXS_SMTP_HOST{"\n"}ZYNVIXS_SMTP_PORT (465 for TLS / 587 for
          startTLS){"\n"}ZYNVIXS_SMTP_SECURITY (tls or starttls){"\n"}
          ZYNVIXS_IMAP_HOST{"\n"}ZYNVIXS_IMAP_PORT (993 for TLS){"\n"}
          ZYNVIXS_IMAP_SECURITY (tls or starttls){"\n"}ZYNVIXS_MAIL_USER{"\n"}
          ZYNVIXS_MAIL_PASSWORD{"\n"}ZYNVIXS_MAIL_FROM
        </pre>
        <div className="job-actions">
          {["smtp", "imap"].map((p) => (
            <button
              disabled={busy}
              key={p}
              onClick={() => void testConnection(p)}
            >
              Test {p.toUpperCase()} connection
            </button>
          ))}
          <button disabled={busy} onClick={() => void loadContext()}>
            Refresh connection status
          </button>
        </div>
        <p>
          Tests check connections without sending a message. Local fixture mode
          is restricted to loopback hosts and .invalid/localhost recipients; see
          STUDIO_WORKFLOWS.md.
        </p>
      </details>
      <Status state={drafts} />
      <Status state={inbox} />
      <Status state={history} />
      {error && (
        <p className="email-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="application-message" role="status">
          {message}
        </p>
      )}
      <EmailBanners
        disabled={busy}
        draft={startTemplate}
        attachments={() => compose(true)}
        reminders={() => switchView("followups")}
      />
      <div className="email-summary-grid">
        {[
          ["Cached inbox", inbox.loading ? "—" : inbox.rows.length],
          ["Saved email drafts", drafts.loading ? "—" : emailDrafts.length],
          [
            "Accepted by SMTP",
            history.loading
              ? "—"
              : history.rows.filter(
                  (r) => r.metadata?.state === "accepted_by_smtp",
                ).length,
          ],
          [
            "Open follow-ups",
            !connection ? "—" : tasks.filter((t) => !t.complete).length,
          ],
        ].map(([text, value]) => (
          <div key={String(text)}>
            <span>{text}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="email-work-area" ref={work}>
        <div className="email-tabs">
          {[
            ["inbox", "Inbox"],
            ["drafts", "Drafts"],
            ["sent", "Sent"],
            ["followups", "Follow-ups"],
          ].map(([key, text]) => (
            <button
              disabled={busy}
              key={key}
              aria-pressed={view === key}
              onClick={() => switchView(key)}
            >
              {text}
            </button>
          ))}
        </div>
        <details
          className="email-ai-box"
          open={aiOpen}
          onToggle={(e) => setAiOpen(e.currentTarget.open)}
        >
          <summary>AI email writer · requires a connected model</summary>
          <ModelNotice />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <fieldset disabled={busy}>
              <div className="email-context-grid">
                <label>
                  Email purpose
                  <select
                    aria-label="Email purpose"
                    value={template}
                    onChange={(e) => {
                      setTemplate(e.target.value);
                      setPurpose(purposes[e.target.value]);
                    }}
                  >
                    {[
                      ["introduction", "Recruiter introduction"],
                      ["application", "Application email"],
                      ["followup", "Application follow-up"],
                      ["thankyou", "Interview thank-you"],
                      ["reply", "Interview reply"],
                    ].map(([key, text]) => (
                      <option key={key} value={key}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Application context
                  <select
                    aria-label="Application context"
                    value={aiApplication}
                    onChange={(e) => setAiApplication(e.target.value)}
                  >
                    <option value="">No application selected</option>
                    {applications.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Resume facts & attachment (optional)
                  <select
                    aria-label="AI resume attachment"
                    value={aiResume}
                    onChange={(e) => setAiResume(e.target.value)}
                  >
                    <option value="">No resume selected</option>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                AI drafting instructions
                <textarea
                  id="email-ai-instructions"
                  required
                  minLength={5}
                  maxLength={5000}
                  aria-label="AI drafting instructions"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </label>
              {source && (
                <p>
                  Reply context selected from your cached inbox.{" "}
                  <button type="button" onClick={() => setSource("")}>
                    Remove reply context
                  </button>
                </p>
              )}
              <button type="submit">Generate an email draft</button>
              <p>
                The connected model uses saved profile facts and selected
                context. It does not choose a recipient or send the message.
              </p>
            </fieldset>
          </form>
        </details>
        {view === "followups" ? (
          <section className="email-followups">
            <h3>Your email follow-up tasks</h3>
            <p>
              Saved tasks appear here and on Career Dashboard. Keep the app open
              to view reminders; no background email or OS notification is
              claimed.
            </p>
            {!tasks.length && (
              <p>
                No email follow-ups yet. Open a message or draft and choose a
                date.
              </p>
            )}
            {[...tasks]
              .sort((a, b) => a.due.localeCompare(b.due))
              .map((t) => (
                <article key={t.id}>
                  <label>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={t.complete}
                      onChange={() => void complete(t)}
                    />
                    {t.title}
                  </label>
                  <span>
                    {t.due} · {t.complete ? "Complete" : "Open"}
                  </span>
                  <button
                    onClick={() => {
                      const [kind, id] = String(
                        t.metadata?.email_key || "",
                      ).split(":");
                      const row = (
                        kind === "drafts" ? emailDrafts : inbox.rows
                      ).find((r) => r.id === id);
                      if (row) {
                        if (kind === "drafts") openDraft(row);
                        else {
                          switchView("inbox");
                          setRead(row);
                        }
                      } else
                        setError(
                          "The original email record is unavailable; your reminder is preserved.",
                        );
                    }}
                  >
                    Open linked conversation
                  </button>
                </article>
              ))}
          </section>
        ) : (
          <>
            <div className="email-list-toolbar">
              <label>
                <input
                  aria-label="Search emails"
                  placeholder="Search subject, sender or message…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                aria-label="Filter email applications"
                value={appFilter}
                onChange={(e) => setAppFilter(e.target.value)}
              >
                <option value="">All application links</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
              {view === "sent" && (
                <select
                  aria-label="Filter send outcomes"
                  value={attemptFilter}
                  onChange={(e) => setAttemptFilter(e.target.value)}
                >
                  <option value="">All outcomes</option>
                  <option value="accepted_by_smtp">Accepted by SMTP</option>
                  <option value="failed_or_unknown">Failed / unknown</option>
                </select>
              )}
              {view === "inbox" && (
                <button disabled={busy} onClick={() => void retrieve()}>
                  <RefreshCw size={15} />
                  Retrieve real inbox messages
                </button>
              )}
            </div>
            <div className="email-split">
              <aside
                className="email-message-list"
                aria-label="Email message list"
              >
                <h3>
                  {view === "inbox"
                    ? "Cached inbox"
                    : view === "sent"
                      ? "Send attempts"
                      : "Saved email drafts"}
                </h3>
                {!rows.length && (
                  <p>
                    {view === "inbox"
                      ? "No cached messages match. Configure IMAP and retrieve your inbox."
                      : view === "sent"
                        ? "No matching send attempts recorded."
                        : "No matching saved drafts. Compose manually or use the AI writer."}
                  </p>
                )}
                {rows.map((r) => (
                  <button
                    disabled={busy}
                    key={r.id}
                    aria-pressed={
                      view === "drafts" ? edit?.id === r.id : read?.id === r.id
                    }
                    onClick={() =>
                      view === "drafts" ? openDraft(r) : setRead(r)
                    }
                  >
                    <strong>{r.title}</strong>
                    <span>
                      {view === "inbox"
                        ? r.metadata?.from || "Sender not recorded"
                        : r.metadata?.to || "Recipient not selected"}
                    </span>
                    <small>
                      {view === "sent"
                        ? r.metadata?.state
                        : r.metadata?.date || "Saved locally"}
                    </small>
                  </button>
                ))}
              </aside>
              <section
                className="email-reader-composer"
                aria-label="Email reading and composing panel"
              >
                {view === "drafts" ? (
                  edit ? (
                    <>
                      <h3>
                        {edit.id ? "Edit saved draft" : "Compose a new draft"}
                      </h3>
                      <form
                        id="email-compose-form"
                        ref={composer}
                        onSubmit={(e) => {
                          e.preventDefault();
                          void saveClick();
                        }}
                      >
                        <fieldset disabled={busy}>
                          <label>
                            Recipient email
                            <input
                              type="email"
                              aria-label="Recipient email"
                              value={edit.metadata?.to || ""}
                              onChange={(e) =>
                                changed({
                                  ...edit,
                                  metadata: {
                                    ...edit.metadata,
                                    to: e.target.value,
                                    kind: "email",
                                  },
                                })
                              }
                            />
                          </label>
                          <p className="email-small-note">
                            One recipient address. Saving does not send.
                          </p>
                          <label>
                            Subject
                            <input
                              required
                              maxLength={300}
                              value={edit.title}
                              onChange={(e) =>
                                changed({ ...edit, title: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Message
                            <textarea
                              required
                              maxLength={50000}
                              aria-label="Message"
                              value={edit.content}
                              onChange={(e) =>
                                changed({ ...edit, content: e.target.value })
                              }
                            />
                          </label>
                          <div className="email-context-grid">
                            <label>
                              Linked application
                              <select
                                aria-label="Linked email application"
                                value={edit.metadata?.application_id || ""}
                                onChange={(e) =>
                                  changed({
                                    ...edit,
                                    metadata: {
                                      ...edit.metadata,
                                      application_id: e.target.value,
                                    },
                                  })
                                }
                              >
                                <option value="">No linked application</option>
                                {applications.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Resume attachment
                              <select
                                id="email-resume-attachment"
                                aria-label="Resume attachment"
                                value={edit.resume_id || ""}
                                onChange={(e) =>
                                  changed({
                                    ...edit,
                                    resume_id: e.target.value,
                                  })
                                }
                              >
                                <option value="">No attachment</option>
                                {resumes.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Attachment format
                              <select
                                aria-label="Attachment format"
                                value={edit.metadata?.resume_format || "pdf"}
                                onChange={(e) =>
                                  changed({
                                    ...edit,
                                    metadata: {
                                      ...edit.metadata,
                                      resume_format: e.target.value,
                                    },
                                  })
                                }
                              >
                                <option value="pdf">PDF</option>
                                <option value="docx">DOCX</option>
                              </select>
                            </label>
                          </div>
                          {edit.resume_id && (
                            <a
                              href={attachmentUrl(edit.resume_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Paperclip size={15} />
                              Preview selected resume PDF
                            </a>
                          )}
                          <div className="job-actions">
                            <button
                              type="button"
                              disabled={!edit.metadata?.application_id}
                              onClick={useApplication}
                            >
                              Use linked recruiter email / resume in empty
                              fields
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate("Resume Studio")}
                            >
                              Manage resume versions
                              <ArrowRight size={15} />
                            </button>
                          </div>
                          <button type="submit">Save draft</button>
                        </fieldset>
                      </form>
                      <button
                        disabled={busy}
                        onClick={() => void reviewDraft()}
                      >
                        Review saved draft for sending
                      </button>
                      {review && (
                        <section className="email-final-review">
                          <h3>Final send review</h3>
                          <p>
                            From: {review.from || "Sender needs backend setup"}
                          </p>
                          <p>To: {review.to}</p>
                          <p>Subject: {review.subject}</p>
                          <pre>{review.body}</pre>
                          {review.attachments?.length ? (
                            review.attachments.map((a: any) => (
                              <div key={a.sha256}>
                                <p>
                                  <Paperclip size={15} />
                                  {a.filename} · {a.size} bytes
                                </p>
                                <small>SHA-256: {a.sha256}</small>
                                <a
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  href={
                                    "/api/career-mail/drafts/" +
                                    edit.id +
                                    "/attachment?review_hash=" +
                                    review.review_hash
                                  }
                                >
                                  Preview reviewed attachment ↗
                                </a>
                              </div>
                            ))
                          ) : (
                            <p>No attachments</p>
                          )}
                          <label className="email-approval">
                            <input
                              type="checkbox"
                              checked={approved}
                              onChange={(e) => setApproved(e.target.checked)}
                            />
                            I approve sending this exact message to this
                            recipient.
                          </label>
                          <button
                            className="application-primary"
                            disabled={
                              !approved || busy || !connection?.smtp_configured
                            }
                            onClick={() => void send()}
                          >
                            Send approved email
                          </button>
                          {!connection?.smtp_configured && (
                            <p>
                              Configure SMTP in secure setup before sending.
                            </p>
                          )}
                          <p>
                            SMTP acceptance does not prove recipient delivery.
                            Duplicate attempts for the same draft version are
                            blocked; inspect history before retrying.
                          </p>
                        </section>
                      )}
                      <div className="email-reminder-controls">
                        <label>
                          Email follow-up date
                          <input
                            type="date"
                            aria-label="Email follow-up date"
                            value={due}
                            onChange={(e) => setDue(e.target.value)}
                          />
                        </label>
                        <button
                          disabled={!due || busy}
                          onClick={() => void reminder("drafts")}
                        >
                          Save draft & create follow-up
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="email-empty-panel">
                      <Mail size={33} />
                      <h3>Your next conversation starts here</h3>
                      <p>
                        Choose a saved draft, compose manually or use the AI
                        writer.
                      </p>
                    </div>
                  )
                ) : read ? (
                  <>
                    <h3>{read.title}</h3>
                    <p>
                      {view === "sent"
                        ? "To: " + (read.metadata?.to || "Not recorded")
                        : "From: " + (read.metadata?.from || "Not recorded")}
                    </p>
                    <p>
                      {view === "sent"
                        ? read.metadata?.at
                        : read.metadata?.date}
                    </p>
                    {view === "sent" && (
                      <p className="email-outcome">
                        {read.metadata?.state === "accepted_by_smtp"
                          ? "Accepted by SMTP — delivery is not confirmed"
                          : "Failed or outcome unknown — check your provider before retrying"}
                      </p>
                    )}
                    <pre className="email-plain-message">
                      {view === "sent"
                        ? read.metadata?.sent_body ||
                          "This older attempt has no saved message snapshot. " +
                            read.content
                        : read.content}
                    </pre>
                    {read.metadata?.application_id && (
                      <p>
                        Application:{" "}
                        {applicationName(read.metadata.application_id)}
                      </p>
                    )}
                    {view === "sent" &&
                      read.metadata?.attachments?.length > 0 && (
                        <a
                          href={
                            "/api/career-mail/history/" +
                            read.id +
                            "/attachment"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Preview saved attempt attachment ↗
                        </a>
                      )}
                    {view === "inbox" && (
                      <>
                        <label>
                          Link cached message to an application
                          <select
                            aria-label="Inbox application link"
                            disabled={busy}
                            value={read.metadata?.application_id || ""}
                            onChange={(e) => void linkMessage(e.target.value)}
                          >
                            <option value="">No linked application</option>
                            {applications.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          onClick={() => {
                            setSource(read.id);
                            setAiApplication(
                              read.metadata?.application_id || "",
                            );
                            startTemplate("reply");
                          }}
                        >
                          Use as reply context
                        </button>
                        <div className="email-reminder-controls">
                          <label>
                            Email follow-up date
                            <input
                              type="date"
                              value={due}
                              onChange={(e) => setDue(e.target.value)}
                            />
                          </label>
                          <button
                            disabled={!due || busy}
                            onClick={() => void reminder("mail")}
                          >
                            Create message follow-up
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="email-empty-panel">
                    <Mail size={33} />
                    <h3>Select a conversation</h3>
                    <p>
                      {view === "inbox"
                        ? "Inbox retrieval is explicit and read-only. Only plain text is displayed; remote images are not loaded."
                        : "Select an attempt to inspect its actual recorded outcome."}
                    </p>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
        <details className="email-legacy-drafts">
          <summary>Preserved drafts from earlier versions</summary>
          {drafts.rows
            .filter((r) => r.metadata?.kind !== "email")
            .map((r) => (
              <article key={r.id}>
                <h3>{r.title}</h3>
                <pre>{r.content}</pre>
                <button
                  onClick={() =>
                    openDraft({
                      ...r,
                      metadata: { ...r.metadata, kind: "email", to: "" },
                    })
                  }
                >
                  Review as an email draft
                </button>
              </article>
            ))}
        </details>
      </div>
      <CareerPageFooter navigate={navigate} />
    </section>
  );
}
