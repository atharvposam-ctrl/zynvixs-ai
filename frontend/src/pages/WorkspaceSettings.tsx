import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useState } from "react";
import { call } from "../Workflows";
import { useStore } from "../store";
export function WorkspaceSettings({
  navigate,
}: {
  navigate: (p: string) => void;
}) {
  const store = useStore(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [savingTheme, setSavingTheme] = useState(false);
  async function changeTheme(theme: "light" | "dark" | "system") {
    setSavingTheme(true); setError(""); setMessage("");
    try {
      const settings = await call("settings", "PATCH", { theme });
      useStore.setState({settings});
      setMessage("Appearance saved. This choice applies across your workspace.");
    } catch (e) { setError(String(e)); }
    finally { setSavingTheme(false); }
  }
  return (
    <section className="studio-workspace">
      <div className="studio-hero">
        <small>SETTINGS</small>
        <h2>Your models, connections and workspace.</h2>
        <p>
          The existing local engine is llama.cpp. No Ollama or cloud-model
          connection is claimed.
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <section className="workspace-appearance" aria-label="Workspace appearance">
        <h3>Appearance</h3>
        <p>Choose White or Black for the whole application. Your choice is saved on this workspace.</p>
        <div className="appearance-choices">
          {([
            {id:"light", label:"White", note:"Bright surfaces and blue accents", icon:Sun},
            {id:"dark", label:"Black", note:"Dark surfaces and blue accents", icon:Moon},
            {id:"system", label:"System", note:"Follow your device appearance", icon:Monitor},
          ] as const).map(t => <button key={t.id} className={`appearance-choice appearance-${t.id}`} aria-pressed={store.settings?.theme === t.id} disabled={savingTheme || !store.settings} onClick={() => void changeTheme(t.id)}>
            <span className="appearance-swatch" aria-hidden="true"><i/><b/><b/></span>
            <span><t.icon size={18}/><strong>{t.label}</strong>{store.settings?.theme === t.id && <Check size={17}/>}</span>
            <small>{t.note}</small>
          </button>)}
        </div>
        {savingTheme && <p role="status">Saving appearance…</p>}
      </section>
      <div className="dashboard-tools">
        {[
          ["Models & hardware", "models"],
          ["Generation", "generation"],
          ["Web research", "research"],
          ["Memory", "memory"],
          ["Privacy & data", "privacy"],
          ["General appearance", "general"],
        ].map(([label, section]) => (
          <button
            key={section}
            onClick={() => store.openSettings(section as any)}
          >
            <h3>{label}</h3>
            <p>Open existing configuration</p>
          </button>
        ))}
      </div>
      <article>
        <h3>Local engine</h3>
        <p>
          {store.status?.engine.loaded
            ? "Loaded: " + store.status.engine.model_name
            : "No model loaded"}
        </p>
        <button
          onClick={async () => {
            try {
              const [status, models] = await Promise.all([
                call("status"),
                call("models"),
              ]);
              useStore.setState({ status, models: models.models });
              setMessage("Backend model status refreshed.");
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          Refresh model status
        </button>
        <button onClick={() => store.openSettings("models")}>
          Discover / load local models
        </button>
      </article>
      <article>
        <h3>Email connection</h3>
        <p>
          Configure SMTP/IMAP using backend environment credentials, then test
          them without sending mail.
        </p>
        <button onClick={() => navigate("Email Agent")}>
          Open email setup and tests
        </button>
      </article>
      <article>
        <h3>Browser worker</h3>
        <p>
          Optional Playwright + Chromium. Dedicated sessions require the app and
          a visible desktop to stay running.
        </p>
        <button onClick={() => navigate("Automation")}>
          Open browser setup
        </button>
      </article>
      <article>
        <h3>Workspace scale & data</h3>
        <p>
          Use the top-bar 80%/100% selector. It persists per browser and never
          changes browser zoom. Export includes career records and existing chat
          data; secrets are excluded.
        </p>
        <a href="/api/export">Export workspace JSON</a>
      </article>
    </section>
  );
}
