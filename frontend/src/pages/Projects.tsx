import { useEffect, useState } from "react";
import { call } from "../Workflows";
import { useStore } from "../store";
import { type Row } from "./shared";
export function ProjectsWorkspace({
  openConversation,
}: {
  openConversation: (id: string) => void;
}) {
  const store = useStore(),
    [projects, setProjects] = useState<any[]>([]),
    [active, setActive] = useState(
      () => sessionStorage.getItem("zynvixs.project") || "",
    ),
    [detail, setDetail] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [name, setName] = useState(""),
    [showArchived, setShowArchived] = useState(false),
    [kind, setKind] = useState("resumes"),
    [options, setOptions] = useState<Row[]>([]),
    [selected, setSelected] = useState("");
  async function load() {
    setLoading(true);
    try {
      setProjects(await call("career-workspace/projects"));
      if (active) setDetail(await call("career-workspace/projects/" + active));
      setError("");
      await store.refreshConversations();
      window.dispatchEvent(new Event("projects-changed"));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [active]);
  useEffect(() => {
    if (kind === "documents") {
      void call("documents")
        .then((r) =>
          setOptions(
            r.documents.map((d: any) => ({
              id: d.id,
              title: d.name,
              content: "",
              complete: false,
              due: "",
            })),
          ),
        )
        .catch((e) => setError(String(e)));
      return;
    }
    if (kind === "conversations") {
      setOptions(
        store.conversations.map((c) => ({
          ...c,
          content: "",
          complete: false,
          due: "",
        })),
      );
      return;
    }
    void call("career/" + kind)
      .then(setOptions)
      .catch((e) => setError(String(e)));
  }, [kind, store.conversations]);
  return (
    <section className="studio-workspace">
      <div className="studio-hero">
        <small>PROJECTS</small>
        <h2>Keep the whole opportunity together.</h2>
        <p>
          Group chats, their documents, resumes, jobs, applications and career
          work. Archiving preserves your data.
        </p>
      </div>
      {loading && <p role="status">Loading projects…</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await store.createProject(name);
            setName("");
            await load();
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <label>
          Project name
          <input
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="submit">Create project</button>
      </form>
      <label>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived projects
      </label>
      <div className="project-grid">
        {projects
          .filter((p) => showArchived || !p.archived)
          .map((p) => (
            <article key={p.id}>
              <h3>{p.name}</h3>
              <p>{p.archived ? "Archived" : "Active"}</p>
              <button onClick={() => setActive(p.id)}>Open project</button>
              <button
                onClick={async () => {
                  const name = prompt("New project name", p.name);
                  if (!name?.trim()) return;
                  try {
                    await store.renameProject(p.id, name.trim());
                    await load();
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Rename project
              </button>
              <button
                onClick={async () => {
                  try {
                    await call(
                      "career-workspace/projects/" + p.id + "/archive",
                      "PUT",
                      { archived: !p.archived },
                    );
                    await load();
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                {p.archived ? "Restore project" : "Archive project"}
              </button>
            </article>
          ))}
      </div>
      {!projects.length && !loading && <p>No projects yet.</p>}
      {active && detail && (
        <section className="workflow-panel">
          <h2>{projects.find((p) => p.id === active)?.name}</h2>
          <button
            onClick={() => {
              store.newChat(active);
              openConversation("");
            }}
          >
            New chat in this project
          </button>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await call("career-workspace/association", "PUT", {
                  kind,
                  record_id: selected,
                  project_id: active,
                });
                await load();
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            <div className="studio-field-grid">
              <label>
                Work type
                <select
                  aria-label="Work type"
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setSelected("");
                  }}
                >
                  {[
                    "conversations",
                    "documents",
                    "resumes",
                    "jobs",
                    "applications",
                    "searches",
                    "tasks",
                    "interviews",
                    "learning",
                    "linkedin",
                    "automation",
                  ].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Saved item
                <select
                  required
                  aria-label="Saved item"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Select saved work</option>
                  {options.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" disabled={!selected}>
              Associate with this project
            </button>
          </form>
          <h3>Conversations</h3>
          {detail.conversations.map((c: any) => (
            <p key={c.id}>
              <button onClick={() => openConversation(c.id)}>{c.title}</button>
            </p>
          ))}
          {!detail.conversations.length && <p>No conversations associated.</p>}
          <h3>Documents attached to project chats</h3>
          {detail.documents.map((d: any) => (
            <p key={d.id}>{d.name}</p>
          ))}
          {!detail.documents.length && (
            <p>
              No project conversation documents yet. Attach a file in a project
              chat.
            </p>
          )}
          <h3>Career work</h3>
          {detail.work.map((r: any) => (
            <article key={r.id}>
              <h4>
                {r.title} · {r.kind}
              </h4>
              <button
                onClick={async () => {
                  try {
                    await call("career-workspace/association", "PUT", {
                      kind: r.kind,
                      record_id: r.id,
                      project_id: "",
                    });
                    await load();
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Remove association
              </button>
            </article>
          ))}
          {!detail.work.length && <p>No career items associated.</p>}
        </section>
      )}
    </section>
  );
}
