import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Code, BriefcaseBusiness, MessageCircle, Sparkles, Check } from "lucide-react";
import { call } from "./Workflows";

export type Recommendation = {id:string;title:string;description:string;category:string;tags:string[];activity?:string;url?:string;resource?:string};
const roles:Recommendation[] = [
  {id:'software',title:'Software Developer',description:'Practice explaining implementation choices, debugging and collaboration.',category:'Tech',tags:['software','python','javascript','git']},
  {id:'frontend',title:'Frontend Developer',description:'Discuss accessible interfaces, component design and browser performance.',category:'Tech',tags:['react','typescript','javascript','html','css']},
  {id:'data',title:'Data Analyst',description:'Practice data interpretation, SQL queries and communicating findings.',category:'Tech',tags:['sql','python','excel','analytics']},
  {id:'ai',title:'AI Engineer',description:'Explain evaluation, data quality and responsible model deployment.',category:'Tech',tags:['ai','machine learning','python']},
  {id:'android',title:'Android App Developer',description:'Discuss mobile interfaces, application lifecycle and testing.',category:'Tech',tags:['android','kotlin','java']},
  {id:'project',title:'Project Manager',description:'Practice planning, stakeholder communication and delivery tradeoffs.',category:'Management',tags:['project','planning','leadership','agile']},
  {id:'hr',title:'HR Manager',description:'Practice employee relations, hiring processes and policy decisions.',category:'Management',tags:['hr','recruitment','human resources']},
  {id:'logistics',title:'Logistics Manager',description:'Discuss supply chains, inventory decisions and operational efficiency.',category:'Management',tags:['logistics','operations','inventory']},
  {id:'behavioral',title:'Behavioral Interview',description:'Structure real examples of teamwork, feedback and problem solving.',category:'General',tags:['teamwork','communication','leadership']},
  {id:'graduate',title:'Graduate Interview',description:'Discuss your education, portfolio and motivation for a first role.',category:'General',tags:['graduate','student','education']},
];
const courses:Recommendation[] = [
  {id:'python',title:'Python practice',description:'Strengthen functions, data structures and small programs.',category:'Tech',tags:['python','software','data'],activity:'Read the Python tutorial, then build a small command-line tool and document its tests.',url:'https://docs.python.org/3/tutorial/',resource:'Official Python tutorial'},
  {id:'react',title:'React interfaces',description:'Practice components, state and accessible user interfaces.',category:'Tech',tags:['react','frontend','javascript'],activity:'Follow the React learning guide and build an accessible task list with persistent state.',url:'https://react.dev/learn',resource:'React learning guide'},
  {id:'sql',title:'SQL analysis',description:'Practice joins, aggregation and explaining query results.',category:'Tech',tags:['sql','data','analytics'],activity:'Work through the PostgreSQL tutorial and write joins and aggregate queries against a small practice dataset.',url:'https://www.postgresql.org/docs/current/tutorial-sql.html',resource:'PostgreSQL tutorial'},
  {id:'typescript',title:'TypeScript foundations',description:'Model data safely with interfaces, unions and type narrowing.',category:'Tech',tags:['typescript','frontend','javascript'],activity:'Study the TypeScript handbook and add typed data validation to a small application.',url:'https://www.typescriptlang.org/docs/handbook/intro.html',resource:'TypeScript handbook'},
  {id:'git',title:'Git collaboration',description:'Practice branches, reviews and resolving merge conflicts.',category:'Tech',tags:['git','software','developer'],activity:'Read the Git book branching chapters; create two branches and resolve a controlled merge conflict.',url:'https://git-scm.com/book/en/v2',resource:'Git book'},
  {id:'planning',title:'Project planning practice',description:'Turn a real goal into milestones, risks and delivery evidence.',category:'Management',tags:['project','planning','agile','leadership'],activity:'Choose a portfolio project; write scope, milestones, stakeholder updates and a risk register. Record evidence as you complete each milestone.'},
  {id:'communication',title:'Clear communication',description:'Explain an achievement with a concise, evidence-based story.',category:'General',tags:['communication','teamwork','leadership'],activity:'Write and rehearse a two-minute explanation of a real project: context, your actions, result and lessons. Ask for feedback and record revisions.'},
  {id:'portfolio',title:'Portfolio evidence',description:'Document a real project so another person can review your work.',category:'General',tags:['portfolio','graduate','student','projects'],activity:'Select a completed project and document the problem, your contribution, setup steps, results and limitations. Link actual work samples.'},
];
export function CareerRecommendations({kind,context,onChoose,savedIds=[],busy=false}:{kind:'interview'|'learning';context:string;onChoose:(r:Recommendation)=>void;savedIds?:string[];busy?:boolean}) {
  const [profile,setProfile]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [category,setCategory]=useState('All'),[search,setSearch]=useState(''),[expanded,setExpanded]=useState(false);
  async function load(){setLoading(true);setError('');try{setProfile((await call('career-workspace/profile')).fields);}catch(e){setError(String(e));}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  const items=useMemo(()=>{
    const target=(profile.target_role||'').trim().slice(0,200);
    const source=kind==='interview'?[...roles]:[...courses];
    if(kind==='interview' && target && !roles.some(r=>r.title.toLowerCase()===target.toLowerCase())) source.unshift({id:'profile-target',title:target,description:'Prepare role-specific questions using your selected resume and this saved target role.',category:'Your profile',tags:[]});
    const text=[profile.target_role,profile.skills,profile.headline,context].filter(Boolean).join(' ').toLowerCase();
    return source.map((r,index)=>{const found=r.tags.filter(t=>new RegExp('(^|[^a-z0-9])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z0-9]|$)','i').test(text));const exact=kind==='interview'&&target.toLowerCase()===r.title.toLowerCase();return {...r,index,score:found.length+(exact?10:0),reason:exact?'Your saved target role':found.length?'Related to your profile / selected resume: '+found.join(', '):'Explore a general practice option'};}).sort((a,b)=>b.score-a.score||a.index-b.index).filter(r=>(category==='All'||r.category===category)&&(!search.trim()||[r.title,r.description,...r.tags].join(' ').toLowerCase().includes(search.trim().toLowerCase())));
  },[kind,profile,context,category,search]);
  return <section className="career-recommendations" aria-label={kind==='interview'?'Interview recommendations':'Learning recommendations'}>
    <div className="recommendation-heading"><div><h2>{kind==='interview'?'Role-based mock interviews':'Recommended learning paths'}</h2><p>{kind==='interview'?'Choose a role, then review your resume and practice settings.':'Choose a practice plan and track your own progress.'}</p></div><button onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded?'Show fewer':'View all'}<ArrowRight size={16}/></button></div>
    <p className="recommendation-method">Local keyword suggestions from saved target role, skills and the selected resume. These are practice templates, not vacancies, certifications or employer endorsements.</p>
    {loading && <p role="status">Loading profile recommendations…</p>}{error && <p role="alert">Profile recommendations unavailable. Showing general templates. <button onClick={()=>void load()}>Retry recommendations</button></p>}
    <div className="recommendation-filters"><div aria-label="Recommendation categories">{['All','Tech','Management','General',...(kind==='interview'&&profile.target_role?['Your profile']:[])].filter(c=>c!=='Your profile'||!roles.some(r=>r.title.toLowerCase()===(profile.target_role||'').toLowerCase())).map(c=><button key={c} aria-pressed={c===category} onClick={()=>{setCategory(c);setExpanded(false);}}>{c}</button>)}</div><input aria-label={kind==='interview'?'Search interview roles':'Search learning paths'} placeholder={kind==='interview'?'Search for roles…':'Search skills…'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="recommendation-grid">{(expanded?items:items.slice(0,4)).map(r=><article key={r.id} className="recommendation-card"><div className="recommendation-card-body"><span className="recommendation-symbol" aria-hidden="true">{r.category==='Tech'?<Code size={24}/>:r.category==='Management'?<BriefcaseBusiness size={24}/>:<MessageCircle size={24}/>}</span><h3>{r.title}</h3><p>{r.description}</p><div className="recommendation-tags">{r.tags.slice(0,4).map(t=><span key={t}>{t}</span>)}</div></div><p className="recommendation-reason"><Sparkles size={14}/>{r.reason}</p><div className="recommendation-card-action"><span>{kind==='interview'?'Review setup before starting':r.resource?'Official documentation + practice':'Self-directed practice'}</span><button disabled={busy} onClick={()=>onChoose(r)}>{kind==='interview'?'Prepare practice':savedIds.includes(r.id)?'View plan':'Add learning plan'}{savedIds.includes(r.id)?<Check size={15}/>:<ArrowRight size={15}/>}</button></div></article>)}</div>
    {!items.length&&<p>No templates match these filters. Try another category or search term.</p>}
    {kind==='learning'&&<p className="recommendation-method">Adding a plan saves it locally. Official resource links in the saved plan open external websites only when you select them.</p>}
  </section>;
}
export function CareerPageFooter({navigate}:{navigate:(page:string)=>void}) {
  return <footer role="contentinfo" className="career-page-footer" aria-label="Career workspace links"><div><h3>Zynvixs AI</h3><p>Your experience, your next move.</p><p>Career work is stored in this workspace. Selected tools can contact configured external services.</p></div>{[
    {title:'Build your story',links:['Profile Builder','Resume Studio','LinkedIn Optimizer']},
    {title:'Prepare & grow',links:['Interview Prep','Skills & Training','Projects']},
    {title:'Your workspace',links:['Career Dashboard','Applications','Settings']},
  ].map(g=><div key={g.title}><h4>{g.title}</h4>{g.links.map(p=><button key={p} onClick={()=>navigate(p)}>{p}</button>)}</div>)}</footer>;
}
