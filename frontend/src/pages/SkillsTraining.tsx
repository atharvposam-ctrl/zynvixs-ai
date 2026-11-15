import { useEffect, useState } from "react";
import { call } from "../Workflows";
import { type Row, parse, useRows, Status } from "./shared";
export function LearningStudio() {
  const state = useRows("learning"),
    [resumes, setResumes] = useState<Row[]>([]),
    [jobs, setJobs] = useState<Row[]>([]),
    [resume, setResume] = useState(""),
    [job, setJob] = useState(""),
    [busy, setBusy] = useState(false),
    [goal, setGoal] = useState("");
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
  async function savePlan(row: Row, data: any) {
    try {
      await call("career/learning/" + row.id, "PUT", {
        ...row,
        content: JSON.stringify(data),
        complete:
          data.lessons.length > 0 && data.lessons.every((l: any) => l.complete),
      });
      await state.load();
    } catch (e) {
      state.setError(String(e));
    }
  }
  return (
    <section className="studio-workspace">
      <div className="studio-hero">
        <small>SKILLS & TRAINING</small>
        <h2>Turn skill gaps into evidence of progress.</h2>
        <p>
          Plans compare recognized listing skills with your resume/profile.
          Resource links point to official documentation; progress reflects your
          own lesson checkboxes, not certified proficiency.
        </p>
      </div>
      <Status state={state} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await call("career-ai/learning", "POST", {
              resume_id: resume,
              job_id: job,
            });
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
            Saved job
            <select
              required
              value={job}
              onChange={(e) => setJob(e.target.value)}
            >
              <option value="">Select saved vacancy</option>
              {jobs.map((j) => (
                <option key={j.id} value={parse(j)?.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={busy || !resume || !job}>
          Create skill-gap learning plan
        </button>
      </form>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await call("career/learning", "POST", {
              title: goal,
              content: JSON.stringify({
                method: "Manual learning goal; progress is self-reported.",
                lessons: [
                  {
                    skill: goal,
                    activity: "Define a practice task and a resource below.",
                    url: "",
                    resource_title: "Your resource",
                    complete: false,
                    practice_notes: "",
                  },
                ],
              }),
            });
            setGoal("");
            await state.load();
          } catch (e) {
            state.setError(String(e));
          }
        }}
      >
        <label>
          Or add a manual learning goal
          <input
            required
            maxLength={200}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
        <button type="submit">Create learning goal</button>
      </form>
      {!state.loading && !state.rows.length && (
        <p>No learning plans yet. Save a real job or add your own goal.</p>
      )}
      {state.rows.map((row) => {
        const plan = parse(row);
        if (!plan?.lessons)
          return (
            <article key={row.id}>
              <h3>{row.title}</h3>
              <p>{row.content}</p>
            </article>
          );
        return (
          <LearningPlan key={row.id} row={row} initial={plan} save={savePlan} />
        );
      })}
    </section>
  );
}
function LearningPlan({
  row,
  initial,
  save,
}: {
  row: Row;
  initial: any;
  save: (r: Row, p: any) => Promise<void>;
}) {
  const [plan, setPlan] = useState(initial),
    [saving, setSaving] = useState(false);
  useEffect(() => setPlan(initial), [row.content]);
  function edit(i: number, key: string, value: any) {
    setPlan({
      ...plan,
      lessons: plan.lessons.map((l: any, k: number) =>
        k === i ? { ...l, [key]: value } : l,
      ),
    });
  }
  const complete = plan.lessons.filter((l: any) => l.complete).length;
  return (
    <article>
      <h3>{row.title}</h3>
      <p>{plan.method}</p>
      <progress max={plan.lessons.length || 1} value={complete} />
      <p>
        {complete}/{plan.lessons.length} marked complete ·{" "}
        {plan.lessons.length
          ? Math.round((complete / plan.lessons.length) * 100)
          : 0}
        %
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await save(row, plan);
          } finally {
            setSaving(false);
          }
        }}
      >
        {plan.lessons.map((l: any, i: number) => (
          <fieldset key={i}>
            <legend>{l.skill}</legend>
            <label>
              Practice activity
              <textarea
                required
                aria-label="Practice activity"
                value={l.activity}
                onChange={(e) => edit(i, "activity", e.target.value)}
              />
            </label>
            <label>
              Verified resource URL
              <input
                type="url"
                pattern="https://.*"
                value={l.url}
                onChange={(e) => edit(i, "url", e.target.value)}
              />
            </label>
            {/^https:\/\//.test(l.url) && (
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                Open learning resource ↗
              </a>
            )}
            <label>
              Practice evidence / notes
              <textarea
                aria-label="Practice evidence / notes"
                value={l.practice_notes}
                onChange={(e) => edit(i, "practice_notes", e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={l.complete}
                onChange={(e) => edit(i, "complete", e.target.checked)}
              />
              I completed this lesson / practice task
            </label>
          </fieldset>
        ))}
        <button disabled={saving} type="submit">
          Save learning progress
        </button>
      </form>
    </article>
  );
}
