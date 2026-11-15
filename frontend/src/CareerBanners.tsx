import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Sparkles, Target, UserRound, Pause, Play } from "lucide-react";

const campaigns = [
  { tag: "YOUR AI CAREER TOOLKIT", title: "Your story. Your next opportunity.", text: "Build a professional profile from your real experience. Bring those facts into your resume and career tools.", action: "Build my profile", page: "Profile Builder", icon: UserRound, color: "blue" },
  { tag: "FROM EXPERIENCE TO RESUME", title: "Make your experience stand out.", text: "Turn saved profile information into an editable resume. Preview your PDF before you download or apply.", action: "Open Resume Studio", page: "Resume Studio", icon: FileText, color: "violet" },
  { tag: "YOUR PROFESSIONAL PRESENCE", title: "Tell a stronger career story.", text: "Use your connected model to draft LinkedIn content from approved facts. Review every suggestion before publishing.", action: "Optimize LinkedIn", page: "LinkedIn Optimizer", icon: Sparkles, color: "mint" },
];
export function CareerBanners({ navigate }: { navigate: (page: string) => void }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (paused || hover || focused || reduced.matches) return;
    const timer = window.setInterval(() => setActive(i => (i + 1) % campaigns.length), 8000);
    return () => window.clearInterval(timer);
  }, [paused, hover, focused]);
  const c = campaigns[active];
  const Icon = c.icon;
  return <section className="career-discover" aria-label="AI career inspiration" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <div className="discover-heading"><span><Sparkles size={18} /> Discover your next move</span><div className="banner-controls">
      <button aria-label="Previous career banner" onClick={() => setActive((active + 2) % 3)}><ArrowLeft size={16} /></button>
      <button aria-label={paused ? "Play career banners" : "Pause career banners"} onClick={() => setPaused(!paused)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
      <button aria-label="Next career banner" onClick={() => setActive((active + 1) % 3)}><ArrowRight size={16} /></button>
    </div></div>
    <div className={`career-promo promo-${c.color}`}>
      <div className="promo-copy" key={c.page}><small>{c.tag}</small><h2>{c.title}</h2><p>{c.text}</p><button onClick={() => navigate(c.page)}>{c.action}<ArrowRight size={17} /></button></div>
      <div className="promo-art" aria-hidden="true"><div className="promo-orbit" /><div className="promo-document"><span className="promo-icon"><Icon size={34} /></span><b>Your career, connected</b><i /><i /><i /><div className="promo-chips"><span>Profile</span><span>Resume</span><span>Growth</span></div></div><span className="promo-spark"><Sparkles size={23} /></span></div>
    </div>
    <div className="discover-categories">{campaigns.map((v,i) => <button key={v.page} aria-label={`Show ${v.page} banner`} aria-pressed={i === active} onClick={() => setActive(i)}><v.icon size={21}/><span>{v.page}</span><ArrowRight size={15}/></button>)}<button onClick={() => navigate("Job Search")}><Target size={21}/><span>Find opportunities</span><ArrowRight size={15}/></button></div>
  </section>;
}
