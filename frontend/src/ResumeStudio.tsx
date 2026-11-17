import { useEffect, useRef, useState } from "react";
import { call, ResumeLibrary, type Item } from "./Workflows";
import { ResumeSections } from "./ResumeSections";
import { PdfResumePreview } from "./PdfResumePreview";

export function ResumeBuilder() {
  const [role, setRole] = useState(""),
    [facts, setFacts] = useState(""),
    [description, setDescription] = useState(() => {
      const value = sessionStorage.getItem("zynvixs.tailor-description") || "";
      sessionStorage.removeItem("zynvixs.tailor-description");
      return value;
    }),
    [length, setLength] = useState("1-2"),
    [customPages, setCustomPages] = useState(12),
    [paper, setPaper] = useState("a4"),
    [view, setView] = useState("editor"),
    [saved, setSaved] = useState<Item | null>(null),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    void Promise.all([
      call("career/resumes"),
      call("career/actions/active-resume"),
    ])
      .then(([rows, active]) => {
        const row: Item | undefined = rows.find(
          (r: Item) => r.id === active.id,
        );
        if (row) {
          setFacts(row.content);
          setSaved(row);
          setDraft(row.content);
          setRole(
            String(
              row.metadata?.target_role ||
                (
                  row.metadata?.source_fields as
                    Record<string, string> | undefined
                )?.role ||
                "",
            ),
          );
          setLength(String(row.metadata?.length_preference || "1-2"));
          setPaper(String(row.metadata?.paper_size || "a4"));
          setCustomPages(Number(row.metadata?.custom_pages || 12));
        }
      })
      .catch((e) => setError(String(e)));
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (editing)
      setTimeout(
        () =>
          document
            .querySelector<HTMLTextAreaElement>(
              '[aria-label="Editable resume text"]',
            )
            ?.focus(),
        0,
      );
  }, [editing]);
  async function accept(row: Item) {
    setSaved(row);
    setDraft(row.content);
    await call("career/actions/active-resume", "PUT", { id: row.id });
    window.dispatchEvent(new Event("resume-changed"));
  }
  async function generate() {
    setBusy(true);
    setError("");
    setMessage("");
    controller.current = new AbortController();
    try {
      const row = await call(
        "career/actions/resume",
        "POST",
        {
          role,
          facts,
          job_description: description,
          length_preference: length,
          paper_size: paper,
          custom_pages: customPages,
        },
        controller.current.signal,
      );
      await accept(row);
      setView("preview");
      setMessage("AI draft saved. Review the actual PDF on the right.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError")
        setMessage(
          "Generation cancelled in this view. Check saved resumes for any draft completed before cancellation.",
        );
      else setError(String(e));
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  async function useProfile() {
    setError("");
    try {
      const rows: Item[] = await call("career/profile");
      const latest = Array.from(
        new Map(
          rows
            .slice()
            .reverse()
            .map((r) => [r.title.toLowerCase(), r]),
        ).values(),
      );
      if (!latest.length)
        throw new Error("Save your profile in Profile Builder first.");
      setFacts(latest.map((r) => r.title + ": " + r.content).join("\n\n"));
      const target = latest.find(
        (r) => r.title.trim().toLowerCase() === "resume target role",
      );
      if (target?.content.trim()) setRole(target.content.trim());
    } catch (e) {
      setError(String(e));
    }
  }
  async function saveText(content: string, aiEdit = false) {
    if (
      length === "custom" &&
      (!Number.isInteger(customPages) || customPages < 1 || customPages > 30)
    ) {
      setError("Choose a custom page target from 1 to 30.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const row = await call("career/resumes", "POST", {
        title: aiEdit
          ? (saved?.title || "Resume") + " — revised"
          : (role || "Resume") + " — supplied text",
        content,
        metadata: {
          ...saved?.metadata,
          kind: aiEdit ? "reviewed_resume" : "supplied_text",
          target_role: role,
          length_preference: length,
          paper_size: paper,
          custom_pages: customPages,
          ...(aiEdit ? { parent_id: saved?.id } : {}),
        },
      });
      await accept(row);
      setView("preview");
      setMessage(
        aiEdit
          ? "New version saved and PDF refreshed."
          : "Your supplied text was saved without AI rewriting. Review the PDF on the right.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="resume-studio-workspace" data-mobile-view={view}>
      <header className="resume-studio-heading">
        <div>
          <small>RESUME STUDIO</small>
          <h2>Your experience. A polished resume.</h2>
          <p>
            Work on the left. Review and download the actual PDF on the right.
          </p>
        </div>
        <span className="studio-local-tag">Local workspace</span>
      </header>
      <div
        className="resume-mobile-tabs"
        role="group"
        aria-label="Resume workspace view"
      >
        <button
          aria-pressed={view === "editor"}
          onClick={() => setView("editor")}
        >
          Editor
        </button>
        <button
          aria-pressed={view === "preview"}
          onClick={() => setView("preview")}
        >
          Preview
        </button>
      </div>
      <div className="resume-workbench">
        <div className="resume-input-panel">
          <h3>Resume inputs</h3>
          <button disabled={busy} onClick={() => void useProfile()}>
            Use saved profile
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <label>
              Target role
              <input
                required
                maxLength={200}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Software Developer"
              />
            </label>
            <label>
              Length target
              <select
                aria-label="Resume length target"
                value={length}
                disabled={busy}
                onChange={(e) => setLength(e.target.value)}
              >
                <option value="1-2">1–2 pages · concise resume</option>
                <option value="4-5">4–5 pages · detailed CV</option>
                <option value="12">Up to 12 pages · extended CV</option>
                <option value="custom">Custom page target</option>
              </select>
            </label>
            {length === "custom" && (
              <label>
                Custom page target
                <input
                  aria-label="Custom page target"
                  disabled={busy}
                  type="number"
                  min={1}
                  max={30}
                  required
                  value={customPages}
                  onChange={(e) => setCustomPages(Number(e.target.value))}
                />
              </label>
            )}
            <label>
              Paper size
              <select
                aria-label="Resume paper size"
                value={paper}
                disabled={busy}
                onChange={(e) => setPaper(e.target.value)}
              >
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
            </label>
            {saved &&
              (length !== String(saved.metadata?.length_preference || "1-2") ||
                paper !== String(saved.metadata?.paper_size || "a4") ||
                (length === "custom" &&
                  customPages !==
                    Number(saved.metadata?.custom_pages || 12))) && (
                <p role="status">
                  Layout settings changed. Save edits & refresh PDF to apply
                  them to a new version.
                </p>
              )}
            <p className="length-help">
              This target changes AI detail and PDF layout. Actual page count is
              shown in the preview. Short sources are never padded with invented
              facts or blank pages; long content is never silently removed to
              fit.
            </p>
            <label>
              Your real background
              <textarea
                disabled={busy}
                aria-label="Resume source information"
                required
                minLength={20}
                maxLength={100000}
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                placeholder="Paste your real experience, education, skills and achievements."
              />
            </label>
            <label>
              Job description (optional)
              <textarea
                disabled={busy}
                aria-label="Target job description"
                maxLength={12000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="resume-generation-actions">
              <button disabled={busy} type="submit">
                {busy ? "Generating resume…" : "Generate and save AI draft"}
              </button>
              {busy && (
                <button
                  type="button"
                  onClick={() => controller.current?.abort()}
                >
                  Cancel generation
                </button>
              )}
              <button
                type="button"
                disabled={busy || facts.trim().length < 20}
                onClick={() => void saveText(facts)}
              >
                Preview supplied text without AI
              </button>
            </div>
          </form>
          {busy && (
            <p role="status">
              Working locally. Longer targets can take more time and depend on
              model context.
            </p>
          )}
          {error && <div role="alert">{error}</div>}
          {message && <p role="status">{message}</p>}
          {saved && (
            <details
              className="studio-draft-editor"
              open={editing}
              onToggle={(e) => setEditing(e.currentTarget.open)}
            >
              <summary>Edit generated / saved text</summary>
              <ResumeSections
                text={draft}
                onChange={setDraft}
                showPreview={false}
              />
              <label>
                Editable resume text
                <textarea
                  disabled={busy}
                  aria-label="Editable resume text"
                  value={draft}
                  maxLength={100000}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <button
                disabled={busy || !draft.trim()}
                onClick={() => void saveText(draft, true)}
              >
                Save edits & refresh PDF
              </button>
              <a
                href={"/api/career/resumes/" + saved.id + "/export?format=docx"}
              >
                Download saved DOCX
              </a>
            </details>
          )}
          <details className="studio-resume-library" open>
            <summary>Saved resumes & imports</summary>
            <ResumeLibrary
              onSelect={(row) => {
                setSaved(row);
                setDraft(row.content);
                const source = row.metadata?.source_fields as
                  Record<string, string> | undefined;
                setRole(
                  String(row.metadata?.target_role || source?.role || ""),
                );
                setLength(String(row.metadata?.length_preference || "1-2"));
                setPaper(String(row.metadata?.paper_size || "a4"));
                setCustomPages(Number(row.metadata?.custom_pages || 12));
              }}
              onUse={(text) => {
                setFacts(text);
                setMessage(
                  "Saved text loaded into the inputs. Generate a draft or preview the supplied text.",
                );
              }}
            />
          </details>
        </div>
        <aside className="resume-output-panel" aria-label="Resume output">
          <div className="resume-output-heading">
            <h3>Resume output</h3>
            <span>{saved ? "Saved PDF" : "Waiting for your resume"}</span>
          </div>
          {saved ? (
            <>
              <p className="output-length-note">
                Saved length target:{" "}
                {String(saved.metadata?.length_preference || "not specified")}.
                The page counter below shows the actual PDF length.
              </p>
              {(saved.metadata?.context_limited === true ||
                saved.metadata?.finish_reason === "length") && (
                <p role="status">
                  The model reached an output or context limit. This draft may
                  be incomplete. Review the ending, increase model context where
                  supported, or work on fewer sections at a time.
                </p>
              )}
              <a
                href={"/api/career/resumes/" + saved.id + "/export?format=docx"}
              >
                Download saved DOCX
              </a>
              <PdfResumePreview
                key={saved.id}
                id={saved.id}
                title={saved.title}
                text={saved.content}
                targetPages={
                  saved.metadata?.length_preference === "custom"
                    ? Number(saved.metadata?.custom_pages || 12)
                    : Number(
                        String(saved.metadata?.length_preference || "1-2")
                          .split("-")
                          .pop(),
                      )
                }
                stale={
                  draft !== saved.content ||
                  length !==
                    String(saved.metadata?.length_preference || "1-2") ||
                  paper !== String(saved.metadata?.paper_size || "a4") ||
                  (length === "custom" &&
                    customPages !== Number(saved.metadata?.custom_pages || 12))
                }
                previewId="studio-resume-pdf"
                staleMessage="The editor has unsaved changes. Use Save edits & refresh PDF to update this preview and download."
                onEdit={() => {
                  setEditing(true);
                  setView("editor");
                }}
              />
            </>
          ) : (
            <div className="resume-output-empty">
              <div className="empty-paper">PDF</div>
              <h3>Your resume preview appears here</h3>
              <p>
                Generate an AI draft, select an existing active resume, or
                preview your supplied text. No sample candidate or fabricated
                output is shown.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
