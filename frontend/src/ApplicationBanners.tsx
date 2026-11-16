import {
  ArrowRight,
  FileText,
  Mic,
  CalendarClock,
  ChartNoAxesColumn,
  BriefcaseBusiness,
} from "lucide-react";
export function ApplicationBanners({
  drafts,
  onDrafts,
  onReminders,
  onActivity,
  navigate,
}: {
  drafts: number;
  onDrafts: () => void;
  onReminders: () => void;
  onActivity: () => void;
  navigate: (page: string) => void;
}) {
  return (
    <section
      className="application-banners"
      aria-label="Application career banners"
    >
      <div className="application-hero-banner">
        <div>
          <small>YOUR NEXT MOVE STARTS HERE</small>
          <h2>Good opportunities deserve a clear next step.</h2>
          <p>
            {drafts
              ? `${drafts} saved or preparing application${drafts === 1 ? "" : "s"} to review.`
              : "Keep your resume, follow-ups and interview preparation together."}
          </p>
          <button onClick={onDrafts}>
            {drafts ? "Review unfinished applications" : "Review your pipeline"}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="application-banner-art" aria-hidden="true">
          <span>
            <BriefcaseBusiness size={37} />
          </span>
          <i />
          <i />
          <i />
          <b>PREPARE · REVIEW · FOLLOW UP</b>
        </div>
      </div>
      <div className="application-banner-tiles">
        {[
          {
            title: "A resume for the role",
            text: "Tailor your real experience.",
            action: "Open Resume Studio",
            icon: FileText,
            run: () => navigate("Resume Studio"),
            tone: "blue",
          },
          {
            title: "Ready for the conversation",
            text: "Prepare with your connected model.",
            action: "Open Interview Prep",
            icon: Mic,
            run: () => navigate("Interview Prep"),
            tone: "purple",
          },
          {
            title: "Keep your next step in view",
            text: "Review saved tasks and dates.",
            action: "View application reminders",
            icon: CalendarClock,
            run: onReminders,
            tone: "teal",
          },
          {
            title: "See your application journey",
            text: "Read actual status changes.",
            action: "View application activity",
            icon: ChartNoAxesColumn,
            run: onActivity,
            tone: "rose",
          },
        ].map((b) => (
          <div
            className={`application-banner-tile app-banner-${b.tone}`}
            key={b.title}
          >
            <b.icon size={27} />
            <h3>{b.title}</h3>
            <p>{b.text}</p>
            <button onClick={b.run}>
              {b.action}
              <ArrowRight size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
