import { useEffect, useState } from "react";
import { call } from "../Workflows";
import { type Row, parse, useRows, Status, ModelNotice } from "./shared";
export function InterviewStudio() {
  const state = useRows("interviews"),
    [resumes, setResumes] = useState<Row[]>([]),
    [jobs, setJobs] = useState<Row[]>([]),
    [resume, setResume] = useState(""),
    [job, setJob] = useState(""),
    [role, setRole] = useState(""),
    [active, setActive] = useState<Row | null>(null),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false);
  const data = active ? parse(active) : null;
  useEffect(() => {
    void Promise.all([
      call("career/resumes"),
      call("career/jobs"),
      call("career/actions/active-resume"),
    ])
      .then(([r, j, a]) => {
        setResumes(r);
        setJobs(j);
        setResume(a.id);
      })
      .catch((e) => state.setError(String(e)));
  }, []);
  return (
    <section className="studio-workspace">
      <div className="studio-hero">
        <small>INTERVIEW PREPARATION</small>
        <h2>Practice one answer at a time.</h2>
        <p>
          Questions use your selected resume and optional saved job. Feedback is
          an AI practice assessment, not a hiring prediction.
        </p>
      </div>
      <ModelNotice />
      <Status state={state} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          state.setError("");
          try {
            setActive(
              await call("career-ai/interviews", "POST", {
                resume_id: resume,
                job_id: job,
                role,
              }),
            );
            setAnswer("");
            await state.load();
          } catch (e) {
            state.setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="studio-field-grid">
          <label>
            Resume
            <select
              required
              value={resume}
              onChange={async (e) => {
                setResume(e.target.value);
                try {
                  await call("career/actions/active-resume", "PUT", {
                    id: e.target.value,
                  });
                } catch (x) {
                  state.setError(String(x));
                }
              }}
            >
              <option value="">Select resume</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Saved job (optional)
            <select value={job} onChange={(e) => setJob(e.target.value)}>
              <option value="">Role-only practice</option>
              {jobs.map((j) => (
                <option key={j.id} value={parse(j)?.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target role
            <input
              required
              maxLength={200}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
        </div>
        <button type="submit" disabled={busy || !resume}>
          {busy ? "Preparing questions…" : "Start interview session"}
        </button>
      </form>
      {active && data?.questions && (
        <article className="practice-session">
          <h2>{active.title}</h2>
          <progress max={data.questions.length} value={data.answers.length} />
          <p>
            {data.answers.length} of {data.questions.length} answers reviewed
          </p>
          {data.answers.length < data.questions.length && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                state.setError("");
                try {
                  setActive(
                    await call(
                      "career-ai/interviews/" + active.id + "/answer",
                      "POST",
                      { answer, question_index: data.answers.length },
                    ),
                  );
                  setAnswer("");
                  await state.load();
                } catch (e) {
                  state.setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>Question {data.answers.length + 1}</h3>
              <p>{data.questions[data.answers.length]}</p>
              <label>
                Your answer
                <textarea
                  required
                  minLength={5}
                  maxLength={12000}
                  aria-label="Your answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy
                  ? "Reviewing your answer…"
                  : "Save answer and get feedback"}
              </button>
            </form>
          )}
          {data.answers.map((a: any, i: number) => (
            <details key={i} open={i === data.answers.length - 1}>
              <summary>
                Question {i + 1}: {data.questions[i]}
              </summary>
              <p>
                <strong>Your answer:</strong> {a.answer}
              </p>
              <h4>AI feedback — strengths</h4>
              <ul>
                {a.feedback.strengths.map((s: string, k: number) => (
                  <li key={k}>{s}</li>
                ))}
              </ul>
              <h4>Practice next</h4>
              <ul>
                {a.feedback.improvements.map((s: string, k: number) => (
                  <li key={k}>{s}</li>
                ))}
              </ul>
              <p>
                <strong>Suggested revision:</strong>{" "}
                {a.feedback.suggested_answer}
              </p>
            </details>
          ))}
          {data.summary && (
            <section>
              <h3>Session summary</h3>
              <p>{data.summary.label}</p>
              <h4>Strengths</h4>
              <ul>
                {data.summary.strengths.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <h4>Practice areas</h4>
              <ul>
                {data.summary.practice_areas.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}
        </article>
      )}
      <h2>Saved sessions</h2>
      {!state.loading && !state.rows.length && (
        <p>No interview sessions yet.</p>
      )}
      {state.rows.map((r) => (
        <article key={r.id}>
          <h3>{r.title}</h3>
          {parse(r)?.questions ? (
            <>
              <p>
                {parse(r).answers.length}/{parse(r).questions.length} answered ·{" "}
                {r.complete ? "Completed" : "In progress"}
              </p>
              <button
                onClick={() => {
                  setActive(r);
                  setAnswer("");
                }}
              >
                Resume / review session
              </button>
            </>
          ) : (
            <p style={{ whiteSpace: "pre-wrap" }}>Legacy note: {r.content}</p>
          )}
        </article>
      ))}
    </section>
  );
}
