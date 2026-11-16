import {
  ArrowRight,
  Globe,
  Monitor,
  UserRound,
  FileText,
  Search,
  BriefcaseBusiness,
  ExternalLink,
  Check,
  Hand,
} from "lucide-react";
export function AutomationGuide({
  navigate,
  openBrowser,
}: {
  navigate: (page: string) => void;
  openBrowser: () => void;
}) {
  return (
    <section className="automation-guide" aria-label="Browser control guide">
      <section className="automation-control-banner">
        <div>
          <small>BROWSER CONTROL · YOU STAY IN CHARGE</small>
          <h2>Your next application, with a helping hand.</h2>
          <p>
            Open a supported job listing in a dedicated browser, prepare answers
            from your approved information and review the application before
            submitting.
          </p>
          <button onClick={openBrowser}>
            Open browser workspace
            <ArrowRight size={17} />
          </button>
          <span>
            Dedicated browser session · Full-PC control is not available
          </span>
        </div>
        <div className="automation-banner-art" aria-hidden="true">
          <div>
            <i />
            <i />
            <i />
          </div>
          <Monitor size={63} />
          <b>READ → PREPARE → REVIEW</b>
          <span>
            <Check size={16} /> Your approval comes first
          </span>
        </div>
      </section>
      <div className="automation-shortcut-banners">
        {[
          {
            title: "Your information, ready to use",
            text: "Review contact details, experience and career preferences.",
            action: "Review my profile",
            icon: UserRound,
            page: "Profile Builder",
            tone: "blue",
          },
          {
            title: "The right resume for the role",
            text: "Choose or tailor a saved resume before applying.",
            action: "Prepare my resume",
            icon: FileText,
            page: "Resume Studio",
            tone: "purple",
          },
          {
            title: "Find a genuine opportunity",
            text: "Retrieve jobs from supported sources and keep original links.",
            action: "Find jobs to prepare",
            icon: Search,
            page: "Job Search",
            tone: "teal",
          },
          {
            title: "Keep your application in view",
            text: "Track drafts, confirmed submissions and follow-ups.",
            action: "Open application tracker",
            icon: BriefcaseBusiness,
            page: "Applications",
            tone: "rose",
          },
        ].map((b) => (
          <div
            className={"automation-shortcut automation-tone-" + b.tone}
            key={b.page}
          >
            <b.icon size={26} />
            <h3>{b.title}</h3>
            <p>{b.text}</p>
            <button onClick={() => navigate(b.page)}>
              {b.action}
              <ArrowRight size={15} />
            </button>
          </div>
        ))}
      </div>
      <section className="automation-how-it-works">
        <header>
          <h2>How browser assistance works</h2>
          <p>
            The assistant works inside its own visible browser. It does not take
            over other apps, your files or your desktop.
          </p>
        </header>
        <div>
          {[
            [
              "Choose a real job",
              "In Job Search, retrieve a vacancy and choose Application auto-fill. This passes the genuine listing to this workspace.",
            ],
            [
              "Open and sign in",
              "Install the optional browser worker if needed, then start the selected job. Sign in yourself and navigate to the application form.",
            ],
            [
              "Read and prepare",
              "Read the current page, prepare saved-profile suggestions and inspect every answer. Unknown screening questions need your input.",
            ],
            [
              "Fill and review",
              "Fill only reviewed answers, inspect the actual website and attachments, and explicitly approve any final submit action.",
            ],
          ].map(([title, text], i) => (
            <article key={title}>
              <span>{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="automation-portals">
        <header>
          <Globe size={23} />
          <div>
            <h2>Job portals & company career sites</h2>
            <p>
              Explore portals manually, or retrieve vacancies from supported
              sources in Job Search. Opening a portal never submits an
              application.
            </p>
          </div>
        </header>
        <div className="automation-portal-grid">
          {[
            [
              "LinkedIn",
              "https://www.linkedin.com/jobs/",
              "Sign-in, Easy Apply and dynamic forms can require manual handling. No LinkedIn API or verified portal-specific automation is provided.",
            ],
            [
              "Naukri",
              "https://www.naukri.com/",
              "Use your own account and review each vacancy. No live Naukri retrieval or verified application integration is implemented.",
            ],
            [
              "Indeed",
              "https://www.indeed.com/",
              "Applications may redirect to another employer site. Different domains can require manual navigation and filling.",
            ],
            [
              "Glassdoor",
              "https://www.glassdoor.com/Job/index.htm",
              "Explore listings in your own browser. This is an outbound link, not a connected job feed.",
            ],
          ].map(([name, href, text]) => (
            <article key={name}>
              <span className="automation-portal-mark" aria-hidden="true">
                {name.slice(0, 2)}
              </span>
              <h3>{name}</h3>
              <strong>Outbound portal link · manual exploration</strong>
              <p>{text}</p>
              <a href={href} target="_blank" rel="noopener noreferrer">
                Open {name}
                <ExternalLink size={14} />
              </a>
            </article>
          ))}
        </div>
        <div className="automation-company-sources">
          <h3>Supported listing retrieval</h3>
          <p>
            Remotive has a public jobs API. Greenhouse and Lever use the
            employer board identifiers you configure in Job Search. Retrieved
            results can be handed to the generic browser assistant; complex
            application forms are not guaranteed to work.
          </p>
          <button onClick={() => navigate("Job Search")}>
            Configure sources & choose a vacancy
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
      <section className="automation-control-boundaries">
        <Hand size={27} />
        <div>
          <h3>What stays with you</h3>
          <p>
            Login, passwords, CAPTCHA, MFA, consent, file uploads and
            unsupported questions remain manual. The assistant never invents
            qualifications or screening answers. Filling a form or clicking
            submit is not proof of employer receipt; mark Applied only after you
            verify confirmation.
          </p>
          <p>
            Keep Zynvixs and its visible browser open while working. Scheduled,
            unattended applications and full-PC control are not available.
            Portal behavior can change; use manual controls when a site is
            unsupported.
          </p>
        </div>
      </section>
    </section>
  );
}
