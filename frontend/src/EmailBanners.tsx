import {
  ArrowRight,
  Mail,
  CalendarClock,
  FileText,
  MessageCircle,
  Send,
} from "lucide-react";
export function EmailBanners({
  draft,
  attachments,
  reminders,
  disabled = false,
}: {
  disabled?: boolean;
  draft: (kind: string) => void;
  attachments: () => void;
  reminders: () => void;
}) {
  return (
    <section className="email-banners" aria-label="Email career banners">
      <div className="email-intro-banner">
        <div>
          <small>THE RIGHT WORDS. YOUR APPROVAL.</small>
          <h2>Start a conversation that moves your career forward.</h2>
          <p>
            Use your real experience to draft thoughtful introductions,
            follow-ups and replies. You review every send.
          </p>
          <button disabled={disabled} onClick={() => draft("introduction")}>
            Introduce yourself professionally
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="email-banner-art" aria-hidden="true">
          <Mail size={52} />
          <b>Your next conversation</b>
          <i />
          <i />
          <span>DRAFT · REVIEW · SEND</span>
        </div>
      </div>
      <div className="email-banner-grid">
        {[
          {
            title: "Follow up thoughtfully",
            text: "Use a tracked application as context.",
            action: "Draft an application follow-up",
            icon: Send,
            run: () => draft("followup"),
            tone: "blue",
          },
          {
            title: "Leave a thoughtful impression",
            text: "Prepare an interview thank-you.",
            action: "Draft an interview thank-you",
            icon: MessageCircle,
            run: () => draft("thankyou"),
            tone: "purple",
          },
          {
            title: "Send the right resume",
            text: "Choose and preview an exact saved version.",
            action: "Choose a resume attachment",
            icon: FileText,
            run: attachments,
            tone: "teal",
          },
          {
            title: "Keep conversations moving",
            text: "Review your saved follow-up tasks.",
            action: "View email follow-ups",
            icon: CalendarClock,
            run: reminders,
            tone: "rose",
          },
        ].map((b) => (
          <div
            className={"email-small-banner email-tone-" + b.tone}
            key={b.title}
          >
            <b.icon size={26} />
            <h3>{b.title}</h3>
            <p>{b.text}</p>
            <button disabled={disabled} onClick={b.run}>
              {b.action}
              <ArrowRight size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
