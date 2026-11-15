import { useEffect, useState } from "react";
import { call } from "../Workflows";
import { type Row, useRows, Status } from "./shared";
const statuses = [
  "draft",
  "reviewing",
  "submitted",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];
export function ApplicationsBoard() {
  const state = useRows("applications"),
    [view, setView] = useState("board"),
    [edit, setEdit] = useState<Row | null>(null),
    [resumes, setResumes] = useState<Row[]>([]),
    [filter, setFilter] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    void call("career/resumes")
      .then(setResumes)
      .catch((e) => state.setError(String(e)));
  }, []);
  async function change(row: Row, status: string) {
    if (
      status === "submitted" &&
      row.status !== "submitted" &&
      !confirm(
        "Have you verified the employer’s actual confirmation that this application was received?",
      )
    )
      return;
    try {
      await call("career/applications/" + row.id, "PUT", {
        ...row,
        status,
        submission_verified: status === "submitted",
      });
      await state.load();
      setMessage("Application status saved.");
    } catch (e) {
      state.setError(String(e));
    }
  }
  function card(row: Row) {
    return (
      <article
        draggable
        key={row.id}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", row.id)}
      >
        <h3>{row.title}</h3>
        <p>{row.status || "draft"}</p>
        {row.due && <p>Follow-up / deadline: {row.due}</p>}
        <p>{row.metadata?.notes || ""}</p>
        <button onClick={() => setEdit(row)}>Open application details</button>
        <label>
          Status
          <select
            aria-label="Status"
            value={row.status || "draft"}
            onChange={(e) => void change(row, e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </article>
    );
  }
  return (
    <section className="studio-workspace">
      <div className="studio-hero">
        <small>APPLICATIONS</small>
        <h2>Every opportunity, with a clear next step.</h2>
        <p>
          Track drafts, confirmations and follow-ups. Opening a job or clicking
          a submit control is not proof of submission.
        </p>
      </div>
      <Status state={state} />
      {message && <p role="status">{message}</p>}
      <div className="job-actions">
        <button onClick={() => setView("board")}>Kanban board</button>
        <button onClick={() => setView("list")}>List view</button>
        <button
          onClick={() =>
            setEdit({
              id: "",
              title: "",
              content: "",
              complete: false,
              due: "",
              status: "draft",
              resume_id: "",
              metadata: { notes: "" },
            })
          }
        >
          Track an application manually
        </button>
        <label>
          Filter applications
          <input value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
      </div>
      {!state.loading && !state.rows.length && (
        <p>
          No tracked applications. Start from a real job result or add a
          verified external opportunity.
        </p>
      )}
      {view === "list" ? (
        state.rows
          .filter((r) => r.title.toLowerCase().includes(filter.toLowerCase()))
          .map(card)
      ) : (
        <div className="kanban-board">
          {statuses.map((status) => (
            <section
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const row = state.rows.find(
                  (r) => r.id === e.dataTransfer.getData("text/plain"),
                );
                if (row) void change(row, status);
              }}
            >
              <h3>
                {status} ·{" "}
                {
                  state.rows.filter((r) => (r.status || "draft") === status)
                    .length
                }
              </h3>
              {state.rows
                .filter(
                  (r) =>
                    (r.status || "draft") === status &&
                    r.title.toLowerCase().includes(filter.toLowerCase()),
                )
                .map(card)}
            </section>
          ))}
        </div>
      )}
      {edit && (
        <section className="workflow-panel">
          <h2>
            {edit.id ? "Application details" : "Track external application"}
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const result = edit.id
                  ? await call("career/applications/" + edit.id, "PUT", edit)
                  : await call("career/applications", "POST", edit);
                setEdit(result);
                await state.load();
                setMessage("Application details saved.");
              } catch (e) {
                state.setError(String(e));
              }
            }}
          >
            <label>
              Role and company
              <input
                required
                maxLength={300}
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </label>
            <label>
              Original listing URL / details
              <textarea
                aria-label="Original listing URL / details"
                value={edit.content}
                onChange={(e) => setEdit({ ...edit, content: e.target.value })}
              />
            </label>
            {/^https:\/\/\S+$/.test(edit.content) && (
              <a href={edit.content} target="_blank" rel="noopener noreferrer">
                Open original listing ↗
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
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            {edit.resume_id && (
              <a
                href={
                  "/api/career/resumes/" + edit.resume_id + "/export?format=pdf"
                }
              >
                Export linked resume PDF
              </a>
            )}
            <label>
              Notes
              <textarea
                aria-label="Notes"
                value={edit.metadata?.notes || ""}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    metadata: { ...edit.metadata, notes: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Deadline / follow-up date
              <input
                type="date"
                value={edit.due}
                onChange={(e) => setEdit({ ...edit, due: e.target.value })}
              />
            </label>
            <button type="submit">Save application details</button>
            <button type="button" onClick={() => setEdit(null)}>
              Close details
            </button>
          </form>
          {edit.id && (
            <>
              <h3>Status history</h3>
              {edit.metadata?.history?.length ? (
                edit.metadata.history.map((h: any, i: number) => (
                  <p key={i}>
                    {h.at}: {h.from || "created"} → {h.to}
                  </p>
                ))
              ) : (
                <p>No recorded status changes yet.</p>
              )}
              <button
                disabled={!edit.due}
                onClick={async () => {
                  try {
                    const task = await call("career/tasks", "POST", {
                      title: "Follow up: " + edit.title,
                      content: edit.content,
                      due: edit.due,
                      metadata: { application_id: edit.id },
                    });
                    setMessage(
                      "Follow-up task created for " +
                        task.due +
                        ". It appears on Career Dashboard.",
                    );
                  } catch (e) {
                    state.setError(String(e));
                  }
                }}
              >
                Create a dashboard reminder task
              </button>
              <p>
                Reminders are shown in the app when it is open; no background
                email or OS notification is assumed.
              </p>
            </>
          )}
        </section>
      )}
    </section>
  );
}
