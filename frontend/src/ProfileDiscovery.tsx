import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, UserRound, Search, Mic, Layers, Sparkles, BriefcaseBusiness, Check } from "lucide-react";
const tools = [
  {page:"Profile Builder",label:"My profile",icon:UserRound},
  {page:"Resume Studio",label:"AI resumes",icon:FileText},
  {page:"Job Search",label:"Find jobs",icon:Search},
  {page:"Applications",label:"Applications",icon:BriefcaseBusiness},
  {page:"Interview Prep",label:"Interviews",icon:Mic},
  {page:"Skills & Training",label:"Learn skills",icon:Layers},
  {page:"LinkedIn Optimizer",label:"LinkedIn",icon:Sparkles},
];
const featured = [
  {page:"Profile Builder",tag:"YOUR PROFESSIONAL STORY",title:"Build a profile that feels like you.",description:"Start with your real experience, skills and goals.",action:"Fill in my details",tone:"coral",icon:UserRound,labels:["Your facts","Your goals"]},
  {page:"Resume Studio",tag:"PROFILE → RESUME",title:"Your next chapter starts here.",description:"Create, edit and download a resume from your saved information.",action:"Create my resume",tone:"ocean",icon:FileText,labels:["PDF preview","Saved versions"]},
  {page:"LinkedIn Optimizer",tag:"AI PROFILE MARKETING",title:"Make your professional story stand out.",description:"Draft a headline, about section and experience with your connected model.",action:"Improve my LinkedIn",tone:"indigo",icon:Sparkles,labels:["AI assisted","Review first"]},
  {page:"Interview Prep",tag:"PREPARE YOUR NEXT MOVE",title:"Bring your experience to the conversation.",description:"Practice interview answers and get feedback using your connected model.",action:"Practice an interview",tone:"rose",icon:Mic,labels:["Practice","Personal feedback"]},
];
export function ProfileDiscovery({navigate}:{navigate:(page:string)=>void}) {
  const track=useRef<HTMLDivElement>(null);
  const [edges,setEdges]=useState({start:true,end:true});
  useEffect(()=>{
    const el=track.current;if(!el)return;
    const update=()=>setEdges({start:el.scrollLeft<=1,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2});
    const observer=new ResizeObserver(update);observer.observe(el);el.addEventListener('scroll',update);update();
    return ()=>{observer.disconnect();el.removeEventListener('scroll',update);};
  },[]);
  function move(direction:number) { const el=track.current;if(el) el.scrollBy({left:direction*el.clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }
  return <section className="profile-discovery" aria-label="Profile career toolkit">
    <header className="profile-discovery-intro"><small>YOUR CAREER, CONNECTED</small><h2>Unlock your <span>career story.</span></h2><p>One profile. A stronger resume. Your next opportunity.</p></header>
    <nav className="profile-tool-tiles" aria-label="Career tools">{tools.map(t=><button key={t.page} onClick={()=>navigate(t.page)}><span>{t.label}</span><span className="tool-tile-art" aria-hidden="true"><t.icon size={33}/></span></button>)}</nav>
    <div className="featured-heading"><h3>Featured for your career</h3><div className="banner-controls"><button aria-label="Previous featured tools" disabled={edges.start} onClick={()=>move(-1)}><ArrowLeft size={17}/></button><button aria-label="Next featured tools" disabled={edges.end} onClick={()=>move(1)}><ArrowRight size={17}/></button></div></div>
    <div className="profile-featured-track" ref={track} tabIndex={0} aria-label="Featured career tools">{featured.map(c=><article className="profile-featured-card" key={c.page}><button className={`profile-poster poster-${c.tone}`} onClick={()=>navigate(c.page)} aria-label={c.action}><small>{c.tag}</small><h4>{c.title}</h4><div className="poster-art" aria-hidden="true"><div className="poster-sheet"><c.icon size={45}/><i/><i/><i/><span><Check size={12}/> Your professional story</span></div><span className="poster-orb"/><Sparkles className="poster-spark" size={25}/></div><span className="poster-action">{c.action}<ArrowRight size={15}/></span></button><div className="poster-labels">{c.labels.map(l=><span key={l}>{l}</span>)}</div><h4>{c.description}</h4></article>)}</div>
    <div className="profile-editor-divider"><span>YOUR PROFILE DETAILS</span><p>Complete the fields below to power your resume and career tools.</p></div>
  </section>;
}
