import { useEffect, useState } from "react";
import { call } from "../Workflows";
import { type Row, useRows, Status, ModelNotice } from "./shared";
export function EmailStudio() {
  const [tested, setTested] = useState<Record<string, string>>({});
  const drafts = useRows("drafts"),
    history = useRows("mail_history"),
    inbox = useRows("mail"),
    [connection, setConnection] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [purpose, setPurpose] = useState(""),
    [source, setSource] = useState(""),
    [edit, setEdit] = useState<Row | null>(null),
    [review, setReview] = useState<any>(null),
    [approved, setApproved] = useState(false);
  useEffect(() => {
    void call("career-mail/status")
      .then(setConnection)
      .catch((e) => drafts.setError(String(e)));
  }, []);
  async function save() {
    if (!edit) return;
    const r = edit.id
      ? await call("career/drafts/" + edit.id, "PUT", edit)
      : await call("career-mail/drafts", "POST", {
          to: edit.metadata?.to || "",
          subject: edit.title,
          body: edit.content,
        });
    setEdit(r);
    setReview(null);
    setApproved(false);
    await drafts.load();
    setMessage("Draft saved locally; no message sent.");
  }
  function changed(row: Row) {
    setEdit(row);
    setReview(null);
    setApproved(false);
  }
  return (
    <section className="studio-workspace">
      <div className="studio-hero">
        <small>EMAIL AGENT</small>
        <h2>Thoughtful drafts. You approve every send.</h2>
        <p>
          Read-only IMAP retrieval and explicit SMTP sending. An SMTP acceptance
          is not a guarantee of delivery.
        </p>
      </div>
      <Status state={drafts} />
      <Status state={history} />
      <Status state={inbox} />
      {message && <p role="status">{message}</p>}
      <details className="workflow-panel" open={!connection?.smtp_configured}>
        <summary>Mail connection & secure setup</summary>
        <p>{connection?.support || "Checking backend configuration…"}</p>
        <p>
          SMTP:{" "}
          {connection?.smtp_configured
            ? tested.smtp || "Host configured, not yet tested"
            : "Missing host"}{" "}
          · IMAP:{" "}
          {connection?.imap_configured
            ? tested.imap || "Host configured, not yet tested"
            : "Missing host"}
        </p>
        <p>
          Set these backend environment variables in the terminal that launches
          Zynvixs. Use your provider’s supported app password. Never paste
          credentials into this page or source control.
        </p>
        <pre>
          ZYNVIXS_SMTP_HOST{"\n"}ZYNVIXS_SMTP_PORT (465 for TLS or 587 for
          startTLS){"\n"}ZYNVIXS_SMTP_SECURITY (tls or starttls){"\n"}
          ZYNVIXS_IMAP_HOST{"\n"}ZYNVIXS_IMAP_PORT (993 for TLS){"\n"}
          ZYNVIXS_IMAP_SECURITY (tls or starttls){"\n"}ZYNVIXS_MAIL_USER{"\n"}
          ZYNVIXS_MAIL_PASSWORD{"\n"}ZYNVIXS_MAIL_FROM
        </pre>
        <p>
          Restart the app after changing environment variables. OAuth-only
          accounts need an integration that is not implemented.
        </p>
        {["smtp", "imap"].map((protocol) => (
          <button
            key={protocol}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await call(
                  "career-mail/test/" + protocol,
                  "POST",
                  {},
                );
                setTested((current) => ({
                  ...current,
                  [protocol]:
                    "Connected — checked " + new Date().toLocaleTimeString(),
                }));
                setMessage(r.message);
              } catch (e) {
                setTested((current) => ({
                  ...current,
                  [protocol]: "Last connection check failed",
                }));
                drafts.setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Test {protocol.toUpperCase()} connection
          </button>
        ))}
        <p>
          For controlled local testing, see STUDIO_WORKFLOWS.md. Test mode
          restricts recipients to .invalid or localhost addresses.
        </p>
      </details>
      <ModelNotice />
      <section className="workflow-panel">
        <h3>Inbox — latest retrieved messages, cached locally</h3>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await call("career-mail/inbox", "POST", {});
              await inbox.load();
              setMessage("Read-only inbox retrieval completed.");
            } catch (e) {
              inbox.setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Retrieve real inbox messages
        </button>
        {!inbox.rows.length && (
          <p>No imported messages. Configure IMAP and retrieve your inbox.</p>
        )}
        {inbox.rows
          .slice()
          .sort(
            (a, b) =>
              String(b.metadata?.fetched_at || "").localeCompare(
                String(a.metadata?.fetched_at || ""),
              ) ||
              (a.metadata?.fetch_rank || 0) - (b.metadata?.fetch_rank || 0),
          )
          .slice(0, 20)
          .map((r) => (
            <details key={r.id}>
              <summary>
                {r.title} · {r.metadata?.from}
              </summary>
              <p>{r.metadata?.date}</p>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.content}</p>
              <button
                onClick={() => {
                  setSource(r.id);
                  setPurpose(
                    "Draft a reply to the selected email using my approved profile. Do not invent commitments.",
                  );
                  setMessage(
                    "Message selected as drafting context. Review the purpose, then generate.",
                  );
                }}
              >
                Use as reply context
              </button>
            </details>
          ))}
      </section>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await call("career-mail/draft-ai", "POST", {
              purpose,
              source_mail_id: source,
            });
            changed(r);
            await drafts.load();
            setMessage(
              "AI draft saved. Add the recipient and review all text before sending.",
            );
          } catch (e) {
            drafts.setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          AI drafting instructions
          <textarea
            required
            minLength={5}
            maxLength={5000}
            aria-label="AI drafting instructions"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </label>
        {source && (
          <button type="button" onClick={() => setSource("")}>
            Remove reply context
          </button>
        )}
        <button disabled={busy} type="submit">
          Generate an email draft
        </button>
      </form>
      <button
        onClick={() =>
          changed({
            id: "",
            title: "",
            content: "",
            complete: false,
            due: "",
            metadata: { kind: "email", to: "" },
          })
        }
      >
        Compose manually
      </button>
      {edit && (
        <section className="workflow-panel">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await save();
              } catch (e) {
                drafts.setError(String(e));
              }
            }}
          >
            <label>
              Recipient email
              <input
                type="email"
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
            <label>
              Subject
              <input
                required
                maxLength={300}
                value={edit.title}
                onChange={(e) => changed({ ...edit, title: e.target.value })}
              />
            </label>
            <label>
              Message
              <textarea
                required
                maxLength={50000}
                aria-label="Message"
                value={edit.content}
                onChange={(e) => changed({ ...edit, content: e.target.value })}
              />
            </label>
            <button type="submit">Save draft</button>
          </form>
          <button
            disabled={!edit.id || busy}
            onClick={async () => {
              try {
                await save();
                const r = await call(
                  "career-mail/drafts/" + edit.id + "/review",
                  "POST",
                  {},
                );
                setReview(r);
                setApproved(false);
              } catch (e) {
                drafts.setError(String(e));
              }
            }}
          >
            Review saved draft for sending
          </button>
          {review && (
            <div className="approval">
              <h3>Final send review</h3>
              <p>To: {review.to}</p>
              <p>Subject: {review.subject}</p>
              <p style={{ whiteSpace: "pre-wrap" }}>{review.body}</p>
              <label>
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                I approve sending this exact message to this recipient.
              </label>
              <button
                disabled={!approved || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await call(
                      "career-mail/drafts/" + edit.id + "/send",
                      "POST",
                      { approved, review_hash: review.review_hash },
                    );
                    setMessage(r.message);
                    setReview(null);
                    setApproved(false);
                    await history.load();
                  } catch (e) {
                    drafts.setError(String(e));
                    await history.load();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send approved email
              </button>
            </div>
          )}
        </section>
      )}
      <h2>Saved email drafts</h2>
      {drafts.rows
        .filter((r) => r.metadata?.kind === "email")
        .map((r) => (
          <article key={r.id}>
            <h3>{r.title}</h3>
            <p>{r.metadata?.to || "No recipient selected"}</p>
            <button onClick={() => changed(r)}>Open draft</button>
          </article>
        ))}
      <details>
        <summary>Preserved drafts from earlier versions</summary>
        {drafts.rows
          .filter((r) => r.metadata?.kind !== "email")
          .map((r) => (
            <article key={r.id}>
              <h3>{r.title}</h3>
              <p>{r.content}</p>
              <button
                onClick={() =>
                  changed({
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
      <h2>Send history</h2>
      {!history.rows.length && <p>No send attempts recorded.</p>}
      {history.rows.map((r) => (
        <article key={r.id}>
          <h3>{r.title}</h3>
          <p>{r.content}</p>
          <p>
            {r.metadata?.state} · {r.metadata?.at}
          </p>
        </article>
      ))}
    </section>
  );
}
