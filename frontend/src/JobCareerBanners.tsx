import { ArrowRight, FileText, Mic, Layers, UserRound, BriefcaseBusiness, Sparkles } from "lucide-react";
const spotlights = [
  { page: "Resume Studio", title: "Give your experience a stronger introduction.", tag: "YOUR NEXT CHAPTER", text: "Build, edit and download a resume using your own information.", action: "Explore Resume Studio", tone: "resume", icon: FileText },
  { page: "Interview Prep", title: "Walk into your next interview prepared.", tag: "PRACTICE WITH PURPOSE", text: "Practice with your resume. AI questions and feedback need a connected model.", action: "Explore Interview Prep", tone: "interview", icon: Mic },
];
function BannerArt({ variant }: { variant: string }) {
  return <svg className="job-banner-art" viewBox="0 0 230 190" fill="none" aria-hidden="true">
    <circle cx="125" cy="96" r="76" fill="currentColor" opacity=".10" />
    <circle cx="127" cy="95" r="62" stroke="currentColor" strokeDasharray="4 6" opacity=".3" />
    <g className="job-banner-paper" transform="rotate(-12 111 100)">
      <rect x="54" y="28" width="113" height="143" rx="13" fill="white" opacity=".98" />
      <rect x="68" y="43" width="30" height="30" rx="9" fill="currentColor" opacity=".15" />
      {variant === 'interview' ? <><rect x="78" y="48" width="10" height="15" rx="5" stroke="currentColor" strokeWidth="2.5"/><path d="M74 59v2a9 9 0 0018 0v-2M83 70v5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></> : <><circle cx="83" cy="52" r="5" stroke="currentColor" strokeWidth="2"/><path d="M74 67c0-10 18-10 18 0" stroke="currentColor" strokeWidth="2"/></>}
      {[86,99,112,125].map((y,i)=><rect key={y} x="68" y={y} width={i%2?65:82} height="5" rx="2.5" fill="currentColor" opacity=".17"/>)}
      <rect x="68" y="140" width="59" height="15" rx="7.5" fill="currentColor" opacity=".12"/>
    </g>
    <g transform="rotate(12 170 135)"><rect x="142" y="120" width="56" height="43" rx="11" fill="currentColor"/><path d="m155 141 9 8 19-20" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></g>
    <path d="m182 32 3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9Z" fill="currentColor" opacity=".7"/>
    <circle cx="35" cy="120" r="5" fill="currentColor" opacity=".35"/>
  </svg>;
}
export function JobCareerBanners({ navigate }: { navigate:(page:string)=>void }) {
  return <section className="job-career-banners" aria-label="Career spotlight banners">
    <div className="job-spotlight-heading"><h3>Career spotlight</h3><span>Zynvixs tools · separate from job listings</span></div>
    <div className="job-profile-gap-banner">
      <div><small>YOUR PROFILE. YOUR POSSIBILITIES.</small><h3>Make your next introduction count.</h3><p>Bring your real experience into a professional profile, a stronger resume and your LinkedIn story.</p><div className="job-profile-banner-actions"><button onClick={()=>navigate('Profile Builder')}>Build my career profile<ArrowRight size={16}/></button><button onClick={()=>navigate('LinkedIn Optimizer')}>Explore LinkedIn tools<ArrowRight size={16}/></button></div></div>
      <div className="job-profile-gap-art"><BannerArt variant="resume"/></div>
    </div>
    <div className="job-poster-grid">{spotlights.map(b=><div key={b.page} className={`job-career-poster job-poster-${b.tone}`}><small>{b.tag}</small><h3>{b.title}</h3><BannerArt variant={b.tone}/><p>{b.text}</p><button onClick={()=>navigate(b.page)}>{b.action}<ArrowRight size={16}/></button></div>)}</div>
    <div className="job-growth-banner"><span className="job-growth-symbol" aria-hidden="true"><Layers size={34}/><Sparkles size={20}/></span><div><small>KEEP YOUR NEXT MOVE MOVING</small><h3>Build skills. Show your progress.</h3><p>Turn a learning goal into saved practice and evidence.</p></div><button onClick={()=>navigate('Skills & Training')}>Explore training<ArrowRight size={16}/></button></div>
  </section>;
}
export function JobFeaturedBanners({ navigate }: { navigate:(page:string)=>void }) {
  const items=[
    {page:'Resume Studio',title:'Your next resume starts here',text:'Create · edit · download',icon:FileText,tone:'resume'},
    {page:'Profile Builder',title:'Tell your professional story',text:'Your facts, ready to use',icon:UserRound,tone:'profile'},
    {page:'Interview Prep',title:'Prepare for the conversation',text:'Resume-based practice',icon:Mic,tone:'interview'},
    {page:'Skills & Training',title:'Make room for your next skill',text:'Save a learning plan',icon:Layers,tone:'skills'},
    {page:'Applications',title:'Keep every application in view',text:'Track drafts and follow-ups',icon:BriefcaseBusiness,tone:'applications'},
  ];
  return <section className="job-featured-banners" aria-label="Featured career banners"><h3>Featured</h3><div className="job-featured-list">{items.map(b=><button key={b.page} onClick={()=>navigate(b.page)}><span className={`job-featured-thumb job-thumb-${b.tone}`} aria-hidden="true"><b.icon size={25}/><span>Z</span></span><span><strong>{b.title}</strong><small>{b.text}</small></span></button>)}</div><p>Explore your career workspace</p></section>;
}
