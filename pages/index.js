import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

function timeAgo(ts) { if (!ts) return "—"; const d=Date.now()-new Date(ts).getTime(),m=Math.floor(d/60000); if(m<1) return "ahora"; if(m<60) return `${m}m`; const h=Math.floor(m/60); return h<24?`${h}h`:`${Math.floor(h/24)}d`; }
function fUSD(v) { return "$"+(parseFloat(v)||0).toFixed(2); }

function Ring({value,max,color,size=52}) { const p=max>0?Math.min(value/max,1):0,r=(size-6)/2,c=2*Math.PI*r; return <div style={{position:"relative",width:size,height:size}}><svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#111827" strokeWidth="4"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={c} strokeDashoffset={c*(1-p)} strokeLinecap="round" style={{transition:"stroke-dashoffset 1s ease"}}/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#F1F5F9"}}>{value}</div></div>; }

function Spark({data,color,w=110,h=28}) { if(!data||data.length<2) return null; const mx=Math.max(...data,.01),mn=Math.min(...data,0),r=mx-mn||1,s=w/(data.length-1); const pts=data.map((v,i)=>`${(i*s).toFixed(1)},${(h-3-((v-mn)/r)*(h-6)).toFixed(1)}`).join(" "); const area=`${pts.split(" ").map((p,i)=>`${i===0?"M":"L"}${p}`).join(" ")} L${((data.length-1)*s).toFixed(1)},${h} L0,${h} Z`; return <svg width={w} height={h}><defs><linearGradient id={`sg${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".2"/><stop offset="100%" stopColor={color} stopOpacity=".02"/></linearGradient></defs><path d={area} fill={`url(#sg${color.slice(1)})`}/><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

function CntRing({s,t}) { const p=t>0?s/t:0,r=8,c=2*Math.PI*r; return <svg width={20} height={20} style={{transform:"rotate(-90deg)"}}><circle cx={10} cy={10} r={r} fill="none" stroke="#111827" strokeWidth="2"/><circle cx={10} cy={10} r={r} fill="none" stroke="#7C3AED" strokeWidth="2" strokeDasharray={c} strokeDashoffset={c*(1-p)} strokeLinecap="round" style={{transition:"stroke-dashoffset .3s"}}/></svg>; }

export default function Hub() {
  const [data,setData]=useState(null);
  const [activity,setActivity]=useState([]);
  const [pipeline,setPipeline]=useState(null);
  const [shopify,setShopify]=useState(null);
  const [analytics,setAnalytics]=useState(null);
  const [healthCheck,setHealthCheck]=useState(null);
  const [sec,setSec]=useState("office");
  const [loading,setLoading]=useState(true);
  const [actLoad,setActLoad]=useState(null);
  const [toast,setToast]=useState(null);
  const [detail,setDetail]=useState(null);
  const [logs,setLogs]=useState([]);
  const [clock,setClock]=useState("");
  const [cd,setCd]=useState(60);
  const [notifN,setNotifN]=useState(0);
  const [showNotif,setShowNotif]=useState(false);
  const [wfRunning,setWfRunning]=useState(false);
  const [wfResult,setWfResult]=useState(null);
  const [campaigns,setCampaigns]=useState([]);
  const [campLoading,setCampLoading]=useState(false);

  const show=(msg,type="ok")=>{setToast({msg,type});setLogs(p=>[{msg,type,time:new Date().toLocaleTimeString("es-CO")},...p].slice(0,50));setTimeout(()=>setToast(null),4000);};

  const load=useCallback(async()=>{
    setLoading(true);
    const [s,a,p,sh,an]=await Promise.all([
      fetch("/api/hub?action=status").then(r=>r.json()).catch(()=>null),
      fetch("/api/hub?action=activity").then(r=>r.json()).catch(()=>({activities:[]})),
      fetch("/api/hub?action=pipeline").then(r=>r.json()).catch(()=>null),
      fetch("/api/hub?action=shopify").then(r=>r.json()).catch(()=>null),
      fetch("/api/hub?action=analytics").then(r=>r.json()).catch(()=>null),
    ]);
    if(s){setData(s);if(s.leader?.issues?.length)setNotifN(c=>c+s.leader.issues.filter(i=>i.severity==="critical").length);}
    setActivity(a?.activities||[]);
    if(p)setPipeline(p.pipeline);
    if(sh?.ok)setShopify(sh);
    if(an)setAnalytics(an);
    setLoading(false);setCd(60);
  },[]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{const t=setInterval(()=>{setCd(c=>{if(c<=1){load();return 60;}return c-1;});},1000);return()=>clearInterval(t);},[load]);
  useEffect(()=>{const t=setInterval(()=>setClock(new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit",second:"2-digit"})),1000);return()=>clearInterval(t);},[]);

  async function runAction(action,label){setActLoad(action);show(`${label}...`);try{const r=await fetch(`/api/hub?action=${action}`,{method:"POST"}).then(r=>r.json());show(r.ok?`${label} — OK`:(r.error||"Error"),r.ok?"ok":"err");if(r.ok)setTimeout(load,3000);}catch{show(`${label} — error`,"err");}setActLoad(null);}

  async function runWorkflow(){setWfRunning(true);setWfResult(null);show("Ejecutando workflow completo...");try{const r=await fetch("/api/hub?action=workflow-launch",{method:"POST"}).then(r=>r.json());setWfResult(r);show(r.ok?"Workflow completado":"Workflow con errores",r.ok?"ok":"err");setTimeout(load,3000);}catch{show("Workflow fallo","err");}setWfRunning(false);}

  async function runHealthCheck(){show("Health check...");try{const r=await fetch("/api/hub?action=health-check").then(r=>r.json());setHealthCheck(r);show("Health check completado");}catch{show("Health check fallo","err");}}

  async function loadCampaigns(){setCampLoading(true);try{const r=await fetch("/api/hub?action=campaigns").then(r=>r.json());setCampaigns(r.campaigns||[]);}catch{}setCampLoading(false);}

  async function toggleCamp(id,activate){show(activate?"Activando...":"Pausando...");try{const r=await fetch("/api/hub?action=toggle-campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,activate})}).then(r=>r.json());show(r.ok?(activate?"Campana activada":"Campana pausada"):(r.error||"Error"),r.ok?"ok":"err");loadCampaigns();setTimeout(load,2000);}catch{show("Error","err");}}

  const agents=data?.agents?Object.values(data.agents):[];
  const leader=data?.leader||{};
  const ag=data?.agents||{};
  const hMap={operational:{c:"#10B981",l:"OPERATIVO"},degraded:{c:"#F59E0B",l:"DEGRADADO"},down:{c:"#EF4444",l:"CAIDO"}};
  const h=hMap[data?.systemHealth]||hMap.down;
  const sMap={idle:{l:"Standby",c:"#475569",p:false},working:{l:"Trabajando",c:"#3B82F6",p:true},alert:{l:"Alerta",c:"#F59E0B",p:true},offline:{l:"Offline",c:"#EF4444",p:false}};
  const pip=pipeline||{discovered:[],landing_created:[],campaign_active:[],converting:[]};

  function aScore(id){
    if(id==="dropshipping"){const p=ag.dropshipping?.metrics?.totalProducts||0;return Math.min(100,(ag.dropshipping?.online?30:0)+Math.min(p,70));}
    if(id==="landing"){const p=ag.landing?.metrics?.published||0;return Math.min(100,(ag.landing?.online?30:0)+Math.min(p*8,70));}
    if(id==="ads"){const a=ag.ads?.metrics?.active||0,r=parseFloat(ag.ads?.metrics?.weekRoas||0);return Math.min(100,(ag.ads?.online?20:0)+a*15+Math.round(r*20));}
    if(id==="leader")return Math.max(0,100-(leader.summary?.totalIssues||0)*25);
    return 0;
  }

  const navs=[{id:"office",i:"OFF",l:"Oficina"},{id:"command",i:"CMD",l:"Comando"},{id:"campaigns",i:"ADS",l:"Campanas"},{id:"pipeline",i:"PIP",l:"Pipeline"},{id:"shopify",i:"SHP",l:"Shopify"},{id:"analytics",i:"ANL",l:"Analytics"},{id:"leader",i:"LDR",l:"Leader"},{id:"logs",i:"LOG",l:"Logs"}];
  const dAgent=detail?agents.find(a=>a.id===detail):null;

  return (<>
    <Head><title>Oficina Virtual — Kily&apos;s Agents</title></Head>
    <style dangerouslySetInnerHTML={{__html:`
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{background:#030712;color:#CBD5E1;font-family:'Inter',-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}::selection{background:#7C3AED;color:#fff}
      @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(124,58,237,.2)}50%{box-shadow:0 0 40px rgba(124,58,237,.5)}}@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}@keyframes slideR{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}@keyframes slideL{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}@keyframes dotMove{0%{transform:translateX(0);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(60px);opacity:0}}@keyframes stepPulse{0%,100%{box-shadow:0 0 0 rgba(124,58,237,0)}50%{box-shadow:0 0 16px rgba(124,58,237,.4)}}
      .au{animation:fadeUp .5s ease both}.sr{animation:slideR .35s ease both}
      .card{background:rgba(15,23,42,.45);border-radius:14px;border:1px solid rgba(30,41,59,.35);transition:all .25s;backdrop-filter:blur(8px)}
      .card:hover{border-color:rgba(51,65,85,.4)}
      .btn{padding:7px 14px;border-radius:8px;border:1px solid #1E293B;background:transparent;color:#94A3B8;font-size:10px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
      .btn:hover{border-color:#7C3AED;color:#C4B5FD}.btn:disabled{opacity:.3;cursor:wait}
      .btn-glow{background:linear-gradient(135deg,#7C3AED,#9333EA);border:none;color:#fff;font-weight:700;box-shadow:0 4px 24px rgba(124,58,237,.3)}
      .btn-glow:hover{box-shadow:0 8px 40px rgba(124,58,237,.5);transform:translateY(-1px)}
      .glass{background:rgba(3,7,18,.88);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
      .mb{padding:10px;background:rgba(3,7,18,.5);border-radius:10px;border:1px solid rgba(30,41,59,.15)}
      ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1E293B;border-radius:2px}
    `}}/>

    {toast&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,padding:"10px 16px",borderRadius:10,background:toast.type==="err"?"rgba(127,29,29,.95)":"rgba(6,78,59,.95)",color:"#fff",fontSize:11,fontWeight:600,boxShadow:"0 20px 60px rgba(0,0,0,.6)",borderLeft:`3px solid ${toast.type==="err"?"#EF4444":"#10B981"}`,maxWidth:300}} className="sr">{toast.msg}</div>}

    {/* DETAIL PANEL */}
    {dAgent&&<div style={{position:"fixed",top:0,right:0,bottom:0,width:360,zIndex:200,borderLeft:"1px solid rgba(30,41,59,.3)",padding:"18px 20px",overflowY:"auto",animation:"slideL .3s ease"}} className="glass">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:36,height:36,borderRadius:10,background:`${dAgent.color}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:dAgent.color}}>{dAgent.avatar}</div>
          <div><div style={{fontSize:14,fontWeight:700,color:"#F1F5F9"}}>{dAgent.name}</div><div style={{fontSize:9,color:"#475569"}}>{dAgent.role}</div></div>
        </div>
        <button onClick={()=>setDetail(null)} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:16}}>x</button>
      </div>
      <div style={{textAlign:"center",marginBottom:14}}><Ring value={aScore(dAgent.id)} max={100} color={aScore(dAgent.id)>=80?"#10B981":aScore(dAgent.id)>=50?"#F59E0B":"#EF4444"} size={64}/><div style={{fontSize:8,color:"#475569",marginTop:4}}>Performance Score</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14}}>
        {Object.entries(dAgent.metrics||{}).map(([k,v])=><div key={k} className="mb"><div style={{fontSize:7,color:"#1E293B",fontWeight:600,textTransform:"uppercase"}}>{k.replace(/([A-Z])/g," $1")}</div><div style={{fontSize:14,fontWeight:800,color:dAgent.color,marginTop:2}}>{typeof v==="boolean"?(v?"Si":"No"):v}</div></div>)}
      </div>
      <div style={{fontSize:8,color:"#1E293B",fontWeight:600,marginBottom:4}}>ACTIVIDAD</div>
      {activity.filter(a=>a.agent===dAgent.id).slice(0,6).map((a,i)=><div key={i} style={{padding:6,background:"rgba(3,7,18,.3)",borderRadius:6,marginBottom:4,fontSize:9}}><span style={{color:"#E2E8F0",fontWeight:600}}>{a.title}</span><span style={{color:"#111827",marginLeft:6}}>{timeAgo(a.timestamp)}</span></div>)}
      {(leader.interactions||[]).filter(i=>i.to===dAgent.id).length>0&&<><div style={{fontSize:8,color:"#1E293B",fontWeight:600,marginTop:10,marginBottom:4}}>LEADER FEEDBACK</div>{leader.interactions.filter(i=>i.to===dAgent.id).map((int,i)=><div key={i} style={{padding:6,background:"rgba(245,158,11,.03)",borderRadius:6,borderLeft:"2px solid #F59E0B",marginBottom:4,fontSize:9,color:"#CBD5E1"}}>{int.message}</div>)}</>}
      {dAgent.url&&<a href={dAgent.url} target="_blank" rel="noopener noreferrer" className="btn-glow" style={{display:"block",textAlign:"center",marginTop:14,padding:10,borderRadius:8,textDecoration:"none",fontSize:11}}>Abrir Dashboard</a>}
    </div>}

    {/* NOTIF PANEL */}
    {showNotif&&<div style={{position:"fixed",top:48,right:detail?376:12,width:280,maxHeight:360,zIndex:150,borderRadius:10,padding:12,overflowY:"auto",border:"1px solid rgba(30,41,59,.3)"}} className="glass sr">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:11,fontWeight:700,color:"#F1F5F9"}}>Alertas</span><button onClick={()=>{setShowNotif(false);setNotifN(0);}} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:9}}>Cerrar</button></div>
      {(leader.issues||[]).map((issue,i)=>{const sc={critical:"#EF4444",high:"#F59E0B",medium:"#3B82F6"};return <div key={i} style={{padding:6,background:"rgba(3,7,18,.3)",borderRadius:6,borderLeft:`2px solid ${sc[issue.severity]}`,marginBottom:4,fontSize:9,color:"#CBD5E1"}}><span style={{fontSize:7,fontWeight:700,color:sc[issue.severity],textTransform:"uppercase"}}>{issue.severity}</span> {issue.message}</div>;})}
      {logs.slice(0,8).map((l,i)=><div key={`l${i}`} style={{padding:4,fontSize:8,color:"#334155",borderBottom:"1px solid rgba(30,41,59,.1)"}}><span style={{color:l.type==="err"?"#EF4444":"#10B981"}}>{l.type==="err"?"ERR":"OK"}</span> {l.msg}</div>)}
    </div>}

    <div style={{display:"flex",minHeight:"100vh"}}>
      {/* SIDEBAR */}
      <div className="glass" style={{width:64,borderRight:"1px solid rgba(30,41,59,.2)",display:"flex",flexDirection:"column",alignItems:"center",padding:"12px 0",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
        <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#7C3AED,#9333EA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#fff",marginBottom:16,animation:"glow 4s infinite",cursor:"pointer"}} onClick={()=>setSec("office")}>K</div>
        <div style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>
          {navs.map(n=><button key={n.id} onClick={()=>setSec(n.id)} title={n.l} style={{width:42,height:42,borderRadius:8,border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,transition:"all .2s",position:"relative",background:sec===n.id?"rgba(124,58,237,.12)":"transparent",color:sec===n.id?"#A855F7":"#1E293B"}}><span style={{fontSize:8,fontWeight:800}}>{n.i}</span><span style={{fontSize:6,fontWeight:600}}>{n.l}</span>{n.id==="leader"&&(leader.summary?.totalIssues||0)>0&&<div style={{position:"absolute",top:3,right:3,width:6,height:6,borderRadius:"50%",background:"#EF4444",animation:"pulse 1.5s infinite"}}/>}</button>)}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,marginTop:"auto"}}><CntRing s={cd} t={60}/><div style={{width:6,height:6,borderRadius:"50%",background:h.c,boxShadow:`0 0 8px ${h.c}40`}}/></div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,marginLeft:64,marginRight:detail?360:0,transition:"margin .3s",padding:"14px 20px"}}>
        {/* TOP */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div><h1 style={{fontSize:17,fontWeight:800,color:"#F1F5F9"}}>{navs.find(n=>n.id===sec)?.l||"Oficina"}</h1><p style={{fontSize:9,color:"#111827",marginTop:1}}>{agents.filter(a=>a.online).length}/{agents.length} agentes — refresh {cd}s</p></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontFamily:"monospace",fontSize:10,color:"#0F172A"}}>{clock}</span>
            <div style={{padding:"3px 8px",borderRadius:14,background:`${h.c}08`,fontSize:8,fontWeight:700,color:h.c,display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:h.c}}/>{h.l}</div>
            <button onClick={()=>setShowNotif(!showNotif)} style={{position:"relative",background:"none",border:"none",cursor:"pointer",padding:2}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={notifN>0?"#F59E0B":"#111827"} strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>{notifN>0&&<div style={{position:"absolute",top:-2,right:-2,width:8,height:8,borderRadius:"50%",background:"#EF4444",fontSize:5,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>{notifN}</div>}</button>
            <button className="btn" onClick={load} disabled={loading} style={{padding:"4px 8px",fontSize:9}}>{loading?"...":"Refresh"}</button>
          </div>
        </div>

        {/* ═══ OFFICE ═══ */}
        {sec==="office"&&<div className="au">
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
            {agents.map((a,i)=>{const st=sMap[a.state]||sMap.idle,sc=aScore(a.id),scC=sc>=80?"#10B981":sc>=50?"#F59E0B":"#EF4444";return <div key={a.id} className="card" onClick={()=>setDetail(detail===a.id?null:a.id)} style={{padding:0,overflow:"hidden",cursor:"pointer",borderColor:detail===a.id?`${a.color}30`:undefined,animation:`fadeUp .4s ease ${i*.06}s both`}}>
              <div style={{height:2,background:a.online?`linear-gradient(90deg,${a.color},transparent)`:"#111827"}}/>
              <div style={{padding:"12px 12px 10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{position:"relative"}}><div style={{width:36,height:36,borderRadius:9,background:a.online?`${a.color}0A`:"#080D17",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:a.online?a.color:"#111827",animation:st.p?"breathe 2s ease infinite":"none"}}>{a.avatar}</div><div style={{position:"absolute",bottom:-1,right:-1,width:9,height:9,borderRadius:"50%",border:"2px solid rgba(15,23,42,.5)",background:st.c,animation:st.p?"pulse 1.5s infinite":"none"}}/></div>
                  <div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,color:"#E2E8F0"}}>{a.name}</div><div style={{fontSize:7,color:"#334155"}}>{a.role}</div></div>
                  <div style={{width:30,height:30,borderRadius:8,background:`${scC}08`,border:`1.5px solid ${scC}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:scC}}>{sc}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                  {a.id==="dropshipping"&&<><div className="mb"><div style={{fontSize:6,color:"#111827",fontWeight:600}}>PRODUCTOS</div><div style={{fontSize:15,fontWeight:800,color:"#F1F5F9"}}>{a.metrics?.totalProducts||0}</div></div><div className="mb"><div style={{fontSize:6,color:"#111827",fontWeight:600}}>ULTIMA</div><div style={{fontSize:11,fontWeight:700,color:"#3B82F6"}}>{timeAgo(a.metrics?.lastRun)}</div></div></>}
                  {a.id==="landing"&&<><div className="mb"><div style={{fontSize:6,color:"#111827",fontWeight:600}}>PUBLICADAS</div><div style={{fontSize:15,fontWeight:800,color:"#F1F5F9"}}>{a.metrics?.published||0}</div></div><div className="mb"><div style={{fontSize:6,color:"#111827",fontWeight:600}}>HOY</div><div style={{fontSize:15,fontWeight:800,color:"#10B981"}}>{a.metrics?.last24h||0}</div></div></>}
                  {a.id==="ads"&&<><div className="mb"><div style={{fontSize:6,color:"#111827",fontWeight:600}}>ACTIVAS</div><div style={{fontSize:15,fontWeight:800,color:(a.metrics?.active||0)>0?"#10B981":"#EF4444"}}>{a.metrics?.active||0}</div></div><div className="mb"><div style={{fontSize:6,color:"#111827",fontWeight:600}}>ROAS</div><div style={{fontSize:15,fontWeight:800,color:"#7C3AED"}}>{a.metrics?.weekRoas||0}x</div></div></>}
                  {a.id==="leader"&&<><div className="mb"><div style={{fontSize:6,color:"#111827",fontWeight:600}}>ISSUES</div><div style={{fontSize:15,fontWeight:800,color:a.metrics?.critical>0?"#EF4444":"#F59E0B"}}>{a.metrics?.issues||0}</div></div><div className="mb"><div style={{fontSize:6,color:"#111827",fontWeight:600}}>MEJORAS</div><div style={{fontSize:15,fontWeight:800,color:"#10B981"}}>{a.metrics?.suggestions||0}</div></div></>}
                </div>
              </div>
            </div>;})}
          </div>

          {/* Flow */}
          <div className="card" style={{padding:14,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              {[{a:"D",c:"#3B82F6",v:ag.dropshipping?.metrics?.totalProducts||0,l:"productos",on:ag.dropshipping?.online},{a:"L",c:"#10B981",v:ag.landing?.metrics?.published||0,l:"landings",on:ag.landing?.online},{a:"A",c:"#7C3AED",v:ag.ads?.metrics?.total||0,l:"campanas",on:ag.ads?.online},{a:"$",c:"#F59E0B",v:ag.ads?.metrics?.weekConversions||0,l:"ventas",on:ag.ads?.online}].map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",flex:1}}>
                <div style={{flex:1,textAlign:"center"}}><div style={{width:32,height:32,borderRadius:8,background:s.on?`${s.c}0A`:"#111827",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:s.on?s.c:"#111827",margin:"0 auto 4px",border:`1px solid ${s.on?s.c+"20":"#111827"}`}}>{s.a}</div><div style={{fontSize:16,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:7,color:"#1E293B"}}>{s.l}</div></div>
                {i<3&&<div style={{width:40,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",height:16}}><div style={{width:30,height:1,background:"#111827"}}/>{s.on&&<div style={{position:"absolute",width:5,height:5,borderRadius:"50%",background:s.c,animation:`dotMove 2s ease infinite`,animationDelay:`${i*.4}s`}}/>}</div>}
              </div>)}
            </div>
          </div>

          {/* Two cols */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div className="card" style={{padding:14}}>
              <h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:8}}>Actividad reciente</h3>
              <div style={{maxHeight:240,overflowY:"auto"}}>{activity.length===0&&<div style={{padding:16,textAlign:"center",color:"#111827",fontSize:9}}>Sin actividad</div>}{activity.map((a,i)=><div key={i} style={{display:"flex",gap:6,padding:"6px 0",borderBottom:i<activity.length-1?"1px solid rgba(30,41,59,.1)":"none"}} className="sr"><div style={{width:22,height:22,borderRadius:6,background:`${a.color}08`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:a.color,flexShrink:0}}>{a.avatar}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:"#E2E8F0",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.title}</div>{a.subtitle&&<div style={{fontSize:8,color:"#334155",marginTop:1}}>{a.subtitle}</div>}</div><div style={{fontSize:7,color:"#111827",flexShrink:0}}>{timeAgo(a.timestamp)}</div></div>)}</div>
            </div>
            <div className="card" style={{padding:14,display:"flex",flexDirection:"column"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><div style={{width:20,height:20,borderRadius:5,background:"rgba(245,158,11,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#F59E0B"}}>K</div><h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",flex:1}}>Leader</h3></div>
              {leader.leaderMessage&&<div style={{padding:"6px 8px",background:"rgba(3,7,18,.3)",borderRadius:"3px 8px 8px 8px",marginBottom:6,borderLeft:"2px solid #F59E0B",fontSize:9,color:"#CBD5E1",lineHeight:1.4}}>{leader.leaderMessage}</div>}
              <div style={{flex:1,maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
                {(leader.interactions||[]).map((int,i)=>{const to=agents.find(a=>a.id===int.to);return <div key={i} className="sr" style={{animationDelay:`${i*.04}s`}}><div style={{fontSize:7,color:"#111827",marginBottom:1}}><span style={{color:"#F59E0B",fontWeight:700}}>Leader</span> → <span style={{color:to?.color,fontWeight:700}}>{to?.name}</span></div><div style={{padding:"5px 8px",background:"rgba(3,7,18,.3)",borderRadius:"3px 8px 8px 8px",fontSize:9,color:"#94A3B8",lineHeight:1.3}}>{int.message}</div></div>;})}
              </div>
              <div style={{display:"flex",gap:4,marginTop:8,paddingTop:8,borderTop:"1px solid rgba(30,41,59,.15)"}}>
                <button className="btn" onClick={()=>runAction("run-search","Buscar")} disabled={!!actLoad} style={{flex:1,fontSize:8,padding:"5px 3px",color:"#3B82F6",borderColor:"#3B82F615"}}>{actLoad==="run-search"?"...":"Buscar"}</button>
                <button className="btn" onClick={()=>runAction("run-landings","Landings")} disabled={!!actLoad} style={{flex:1,fontSize:8,padding:"5px 3px",color:"#10B981",borderColor:"#10B98115"}}>{actLoad==="run-landings"?"...":"Landings"}</button>
                <button className="btn" onClick={()=>runAction("run-monitor","Ads")} disabled={!!actLoad} style={{flex:1,fontSize:8,padding:"5px 3px",color:"#7C3AED",borderColor:"#7C3AED15"}}>{actLoad==="run-monitor"?"...":"Ads"}</button>
              </div>
            </div>
          </div>
        </div>}

        {/* ═══ COMMAND ═══ */}
        {sec==="command"&&<div className="au">
          {/* One-click workflow */}
          <div className="card" style={{padding:20,marginBottom:16,borderLeft:"3px solid #7C3AED"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><h3 style={{fontSize:14,fontWeight:800,color:"#F1F5F9"}}>Lanzar Producto (Workflow Completo)</h3><p style={{fontSize:10,color:"#475569",marginTop:2}}>Ejecuta los 3 agentes en cadena: Buscar → Landing → Ads</p></div>
              <button className="btn-glow" onClick={runWorkflow} disabled={wfRunning} style={{padding:"10px 24px",fontSize:12}}>{wfRunning?"Ejecutando...":"Lanzar"}</button>
            </div>
            {wfResult&&<div style={{marginTop:14,display:"flex",flexDirection:"column",gap:6}}>
              {wfResult.steps?.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:8,background:"rgba(3,7,18,.3)",borderRadius:8}}>
                <div style={{width:24,height:24,borderRadius:6,background:s.status==="done"?"rgba(16,185,129,.1)":s.status==="error"?"rgba(239,68,68,.1)":"rgba(124,58,237,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:s.status==="done"?"#10B981":s.status==="error"?"#EF4444":"#7C3AED"}}>{s.status==="done"?"OK":s.status==="error"?"X":"..."}</div>
                <div style={{flex:1}}><div style={{fontSize:10,fontWeight:600,color:"#E2E8F0"}}>{s.action}</div><div style={{fontSize:8,color:"#334155"}}>{s.result||""}</div></div>
              </div>)}
              <div style={{fontSize:10,color:wfResult.ok?"#10B981":"#EF4444",fontWeight:700}}>{wfResult.message}</div>
            </div>}
          </div>

          {/* Individual actions */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
            {[{id:"run-search",i:"D",c:"#3B82F6",t:"Buscar productos",d:"Scoring 8 criterios",tm:"~3min"},{id:"run-landings",i:"L",c:"#10B981",t:"Crear landings",d:"Gemini + Shopify",tm:"~45s"},{id:"run-monitor",i:"A",c:"#7C3AED",t:"Monitorear ads",d:"Pause/scale automatico",tm:"~30s"}].map((w,i)=><div key={w.id} className="card" style={{padding:16,animation:`fadeUp .4s ease ${i*.06}s both`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{width:32,height:32,borderRadius:8,background:`${w.c}0A`,border:`1px solid ${w.c}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:w.c}}>{w.i}</div><div><div style={{fontSize:12,fontWeight:700,color:"#E2E8F0"}}>{w.t}</div><div style={{fontSize:8,color:"#334155"}}>{w.tm}</div></div></div>
              <p style={{fontSize:9,color:"#475569",marginBottom:12}}>{w.d}</p>
              <button className="btn-glow" onClick={()=>runAction(w.id,w.t)} disabled={!!actLoad} style={{width:"100%",padding:8,fontSize:10,borderRadius:8}}>{actLoad===w.id?"...":"Ejecutar"}</button>
            </div>)}
          </div>

          {/* Health check */}
          <div className="card" style={{padding:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <h3 style={{fontSize:12,fontWeight:700,color:"#E2E8F0"}}>Health Check</h3>
              <button className="btn" onClick={runHealthCheck} style={{fontSize:9}}>Ejecutar</button>
            </div>
            {healthCheck&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {Object.entries(healthCheck.results||{}).map(([id,r])=>{const a=agents.find(x=>x.id===id);return <div key={id} className="mb" style={{textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:a?.color||"#94A3B8",marginBottom:4}}>{a?.name||id}</div>
                <div style={{fontSize:9,color:r.online?"#10B981":"#EF4444",fontWeight:700}}>{r.online?"ONLINE":"OFFLINE"}</div>
                <div style={{fontSize:8,color:"#334155",marginTop:2}}>Latencia: {r.latency}</div>
                <div style={{fontSize:8,color:r.latencyScore==="fast"?"#10B981":r.latencyScore==="normal"?"#F59E0B":"#EF4444"}}>{r.latencyScore}</div>
              </div>;})}
            </div>}
            {!healthCheck&&<div style={{padding:12,textAlign:"center",color:"#111827",fontSize:9}}>Click Ejecutar para medir latencia</div>}
          </div>
        </div>}

        {/* ═══ CAMPAIGNS ═══ */}
        {sec==="campaigns"&&<div className="au" ref={el=>{if(el&&campaigns.length===0&&!campLoading)loadCampaigns()}}>
          {campaigns.length===0&&!campLoading&&<div style={{textAlign:"center",marginBottom:14}}><button className="btn" onClick={loadCampaigns}>Cargar campanas</button></div>}
          {campLoading&&<div style={{textAlign:"center",padding:24,color:"#111827",fontSize:10}}>Cargando...</div>}

          {/* KPI strip */}
          {campaigns.length>0&&<div className="card" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",padding:0,marginBottom:14,overflow:"hidden"}}>
            {[{l:"Total",v:campaigns.length,c:"#7C3AED"},{l:"Activas",v:campaigns.filter(c=>c.status==="ACTIVE").length,c:"#10B981"},{l:"Pausadas",v:campaigns.filter(c=>c.status==="PAUSED").length,c:"#F59E0B"},{l:"Gasto/dia",v:fUSD(campaigns.reduce((s,c)=>s+(c.status==="ACTIVE"?c.budget_daily_usd:0),0)),c:"#EF4444"}].map((k,i)=><div key={i} style={{padding:"12px 8px",textAlign:"center",borderRight:i<3?"1px solid rgba(30,41,59,.2)":"none"}}><div style={{fontSize:7,color:"#334155",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>{k.l}</div><div style={{fontSize:18,fontWeight:800,color:k.c}}>{k.v}</div></div>)}
          </div>}

          {/* Campaign list */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {campaigns.map((c,i)=>{
              const statusC={ACTIVE:"#10B981",PAUSED:"#F59E0B",ARCHIVED:"#475569"};
              return <div key={c.id||i} className="card" style={{padding:14,borderLeft:`3px solid ${statusC[c.status]||"#334155"}`,animation:`fadeUp .3s ease ${i*.04}s both`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#F1F5F9"}}>{c.product_name}</span>
                      <span style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:`${statusC[c.status]}10`,color:statusC[c.status],fontWeight:700}}>{c.status}</span>
                    </div>
                    <div style={{display:"flex",gap:10,fontSize:9,color:"#334155"}}>
                      <span>{c.country_code}</span>
                      <span>{fUSD(c.budget_daily_usd)}/dia</span>
                      <span>{c.platform||"meta"}</span>
                      {c.ad_copy_used&&typeof c.ad_copy_used==="object"&&<span style={{color:"#7C3AED"}}>{c.ad_copy_used.angle||""}</span>}
                      <span>{timeAgo(c.created_at)}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn" onClick={()=>toggleCamp(c.id,c.status!=="ACTIVE")} style={{fontSize:9,padding:"5px 10px",color:c.status==="ACTIVE"?"#F59E0B":"#10B981",borderColor:c.status==="ACTIVE"?"#F59E0B20":"#10B98120"}}>
                      {c.status==="ACTIVE"?"Pausar":"Activar"}
                    </button>
                    <a href={`https://ads-agent-nine.vercel.app`} target="_blank" rel="noopener noreferrer" className="btn" style={{fontSize:9,padding:"5px 10px",textDecoration:"none"}}>Detalles</a>
                  </div>
                </div>
              </div>;
            })}
          </div>

          {campaigns.length===0&&!campLoading&&<div className="card" style={{padding:32,textAlign:"center"}}><div style={{fontSize:11,color:"#334155",marginBottom:10}}>Sin campanas. Usa el Autopilot del Ads Agent para crear.</div><a href="https://ads-agent-nine.vercel.app" target="_blank" rel="noopener noreferrer" className="btn-glow" style={{display:"inline-block",padding:"10px 20px",textDecoration:"none",fontSize:11}}>Ir al Ads Agent</a></div>}

          {/* Quick action */}
          {campaigns.length>0&&<div style={{display:"flex",gap:8,marginTop:14}}>
            <button className="btn" onClick={()=>runAction("run-monitor","Monitorear")} disabled={!!actLoad} style={{flex:1,color:"#7C3AED",borderColor:"#7C3AED15"}}>{actLoad==="run-monitor"?"...":"Ejecutar monitoreo (pause/scale automatico)"}</button>
          </div>}
        </div>}

        {/* ═══ PIPELINE ═══ */}
        {sec==="pipeline"&&<div className="au">
          <div style={{display:"flex",gap:14,marginBottom:18,justifyContent:"center"}}>{[{v:pip.discovered.length,l:"Descubiertos",c:"#3B82F6"},{v:pip.landing_created.length,l:"Con landing",c:"#10B981"},{v:pip.campaign_active.length,l:"Con campana",c:"#7C3AED"},{v:pip.converting.length,l:"Convirtiendo",c:"#F59E0B"}].map((r,i)=><div key={i} style={{textAlign:"center"}}><Ring value={r.v} max={Math.max(pip.discovered.length,1)} color={r.c}/><div style={{fontSize:7,color:"#334155",marginTop:3,fontWeight:600}}>{r.l}</div></div>)}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[{k:"discovered",l:"Descubiertos",c:"#3B82F6",i:"D"},{k:"landing_created",l:"Con Landing",c:"#10B981",i:"L"},{k:"campaign_active",l:"Con Campana",c:"#7C3AED",i:"A"},{k:"converting",l:"Convirtiendo",c:"#F59E0B",i:"$"}].map(col=><div key={col.k}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,padding:"7px 8px",background:`${col.c}04`,borderRadius:7,borderTop:`2px solid ${col.c}`}}><div style={{width:18,height:18,borderRadius:4,background:col.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#fff"}}>{col.i}</div><span style={{fontSize:9,fontWeight:700,color:"#E2E8F0"}}>{col.l}</span><span style={{marginLeft:"auto",fontSize:8,fontWeight:700,color:col.c}}>{(pip[col.k]||[]).length}</span></div>
              <div style={{display:"flex",flexDirection:"column",gap:4,minHeight:140}}>
                {(pip[col.k]||[]).map((item,i)=><div key={i} className="card" style={{padding:7,borderLeft:`2px solid ${col.c}`,animation:`fadeUp .3s ease ${i*.03}s both`}}><div style={{fontSize:9,fontWeight:700,color:"#E2E8F0",marginBottom:1}}>{item.name}</div><div style={{display:"flex",gap:4,fontSize:7,color:"#334155"}}>{item.score>0&&<span>Score: <b style={{color:item.score>=8?"#10B981":"#F59E0B"}}>{item.score}</b></span>}{item.status&&<span style={{color:item.status==="ACTIVE"?"#10B981":"#475569"}}>{item.status}</span>}</div></div>)}
                {(pip[col.k]||[]).length===0&&<div style={{padding:14,textAlign:"center",color:"#080D17",fontSize:8,border:"1px dashed #111827",borderRadius:6}}>Vacio</div>}
              </div>
            </div>)}
          </div>
        </div>}

        {/* ═══ SHOPIFY ═══ */}
        {sec==="shopify"&&<div className="au">
          {shopify?<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
              {[{l:"Productos",v:shopify.products?.total||0,c:"#3B82F6"},{l:"Activos",v:shopify.products?.active||0,c:"#10B981"},{l:"Ordenes",v:shopify.orders?.total||0,c:"#7C3AED"},{l:"Revenue 7d",v:`$${shopify.orders?.revenue7d||0}`,c:"#F59E0B"}].map((k,i)=><div key={i} className="card" style={{padding:16,textAlign:"center",borderTop:`2px solid ${k.c}`}}><div style={{fontSize:7,color:"#334155",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div style={{fontSize:22,fontWeight:800,color:k.c}}>{k.v}</div></div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div className="card" style={{padding:16}}>
                <h3 style={{fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:10}}>Productos Shopify</h3>
                {(shopify.products?.recent||[]).map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<(shopify.products?.recent?.length||1)-1?"1px solid rgba(30,41,59,.1)":"none"}}>
                  {p.image&&<img src={p.image} alt="" style={{width:28,height:28,borderRadius:6,objectFit:"cover"}}/>}
                  <div style={{flex:1}}><div style={{fontSize:10,fontWeight:600,color:"#E2E8F0"}}>{p.title}</div><div style={{fontSize:8,color:"#334155"}}>${p.price} — {p.status}</div></div>
                </div>)}
              </div>
              <div className="card" style={{padding:16}}>
                <h3 style={{fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:10}}>Ordenes recientes</h3>
                {(shopify.orders?.recent||[]).length===0&&<div style={{padding:16,textAlign:"center",color:"#111827",fontSize:9}}>Sin ordenes</div>}
                {(shopify.orders?.recent||[]).map((o,i)=><div key={i} style={{padding:6,background:"rgba(3,7,18,.3)",borderRadius:6,marginBottom:4}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,fontWeight:600,color:"#E2E8F0"}}>{o.name}</span><span style={{fontSize:10,fontWeight:700,color:"#10B981"}}>${o.total}</span></div>
                  <div style={{fontSize:8,color:"#334155",marginTop:1}}>{o.items}</div>
                  <div style={{display:"flex",gap:6,marginTop:2}}><span style={{fontSize:7,padding:"1px 4px",borderRadius:3,background:o.status==="paid"?"rgba(16,185,129,.08)":"rgba(245,158,11,.08)",color:o.status==="paid"?"#10B981":"#F59E0B",fontWeight:700}}>{o.status}</span><span style={{fontSize:7,color:"#111827"}}>{timeAgo(o.created)}</span></div>
                </div>)}
              </div>
            </div>
          </>:<div className="card" style={{padding:32,textAlign:"center"}}><div style={{color:"#111827",fontSize:11}}>Cargando datos de Shopify...</div></div>}
        </div>}

        {/* ═══ ANALYTICS ═══ */}
        {sec==="analytics"&&<div className="au">
          <div className="card" style={{padding:16,marginBottom:14}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:12}}>Performance</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {agents.map(a=>{const sc=aScore(a.id),c=sc>=80?"#10B981":sc>=50?"#F59E0B":"#EF4444";return <div key={a.id} style={{textAlign:"center",padding:12,background:"rgba(3,7,18,.3)",borderRadius:8}}><Ring value={sc} max={100} color={c} size={56}/><div style={{fontSize:10,fontWeight:700,color:"#E2E8F0",marginTop:6}}>{a.name}</div><div style={{fontSize:7,color:c,fontWeight:700}}>{sc>=80?"Excelente":sc>=50?"Regular":"Bajo"}</div></div>;})}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}}>
            {[{n:"Dropshipping",c:"#3B82F6",m:[{l:"Productos",v:ag.dropshipping?.metrics?.totalProducts||0},{l:"Por run",v:ag.dropshipping?.metrics?.productsLastRun||0},{l:"Ultima",v:timeAgo(ag.dropshipping?.metrics?.lastRun)},{l:"Activo",v:ag.dropshipping?.metrics?.isActive?"Si":"No"}]},{n:"Landing",c:"#10B981",m:[{l:"Total",v:ag.landing?.metrics?.total||0},{l:"Publicadas",v:ag.landing?.metrics?.published||0},{l:"Borradores",v:ag.landing?.metrics?.drafts||0},{l:"Hoy",v:ag.landing?.metrics?.last24h||0}]},{n:"Ads",c:"#7C3AED",m:[{l:"Campanas",v:ag.ads?.metrics?.total||0},{l:"Gasto 7d",v:fUSD(ag.ads?.metrics?.weekSpend)},{l:"Clics",v:ag.ads?.metrics?.weekClicks||0},{l:"ROAS",v:`${ag.ads?.metrics?.weekRoas||0}x`}]}].map((card,i)=><div key={i} className="card" style={{padding:14,borderTop:`2px solid ${card.c}`}}><div style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:8}}>{card.n}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{card.m.map((m,j)=><div key={j} className="mb"><div style={{fontSize:6,color:"#111827",fontWeight:600,textTransform:"uppercase"}}>{m.l}</div><div style={{fontSize:13,fontWeight:800,color:card.c,marginTop:1}}>{m.v}</div></div>)}</div></div>)}
          </div>
          {/* Funnel */}
          <div className="card" style={{padding:16}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:10}}>Embudo</h3>
            {[{l:"Productos",v:ag.dropshipping?.metrics?.totalProducts||0,c:"#3B82F6"},{l:"Landings",v:ag.landing?.metrics?.published||0,c:"#10B981"},{l:"Campanas",v:ag.ads?.metrics?.total||0,c:"#7C3AED"},{l:"Activas",v:ag.ads?.metrics?.active||0,c:"#F59E0B"},{l:"Conversiones",v:ag.ads?.metrics?.weekConversions||0,c:"#EF4444"}].map((f,i)=>{const mx=ag.dropshipping?.metrics?.totalProducts||1;const w=Math.max(5,(f.v/mx)*100);return <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><div style={{width:80,fontSize:8,color:"#475569",textAlign:"right",fontWeight:600}}>{f.l}</div><div style={{flex:1,height:20,background:"rgba(3,7,18,.3)",borderRadius:4,overflow:"hidden"}}><div style={{width:`${w}%`,height:"100%",background:`${f.c}12`,borderRadius:4,display:"flex",alignItems:"center",paddingLeft:6,transition:"width 1s"}}><span style={{fontSize:10,fontWeight:800,color:f.c}}>{f.v}</span></div></div><div style={{width:28,fontSize:8,color:"#1E293B",textAlign:"right"}}>{Math.round(f.v/mx*100)}%</div></div>;})}
          </div>
          {/* Charts if analytics data exists */}
          {analytics?.daily?.length>0&&<div className="card" style={{padding:16,marginTop:14}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:10}}>Tendencias 7 dias</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {[{l:"Gasto",v:fUSD(analytics.totals?.spend),d:analytics.daily.map(d=>d.spend),c:"#EF4444"},{l:"Clics",v:analytics.totals?.clicks||0,d:analytics.daily.map(d=>d.clicks),c:"#3B82F6"},{l:"Conv.",v:analytics.totals?.conversions||0,d:analytics.daily.map(d=>d.conversions),c:"#10B981"},{l:"CPC",v:fUSD(analytics.totals?.cpc),d:analytics.daily.map(d=>d.cpc),c:"#F59E0B"}].map((m,i)=><div key={i} className="mb"><div style={{fontSize:7,color:"#1E293B",fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{m.l}</div><div style={{fontSize:16,fontWeight:800,color:"#F1F5F9",marginBottom:6}}>{m.v}</div><Spark data={m.d} color={m.c}/></div>)}
            </div>
          </div>}
        </div>}

        {/* ═══ LEADER ═══ */}
        {sec==="leader"&&<div className="au">
          <div className="card" style={{padding:14,marginBottom:12,display:"flex",alignItems:"center",gap:12,borderLeft:"3px solid #F59E0B"}}>
            <div style={{width:44,height:44,borderRadius:12,background:"rgba(245,158,11,.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#F59E0B",animation:"breathe 3s ease infinite"}}>K</div>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:"#F1F5F9"}}>Leader Agent</div><div style={{fontSize:10,color:"#475569",marginTop:1}}>{leader.leaderMessage}</div></div>
            <div style={{display:"flex",gap:6}}><div style={{padding:"4px 10px",borderRadius:6,background:"rgba(239,68,68,.04)",textAlign:"center"}}><div style={{fontSize:6,color:"#475569",fontWeight:600}}>ISSUES</div><div style={{fontSize:14,fontWeight:800,color:leader.summary?.criticalIssues>0?"#EF4444":"#F59E0B"}}>{leader.summary?.totalIssues||0}</div></div><div style={{padding:"4px 10px",borderRadius:6,background:"rgba(16,185,129,.04)",textAlign:"center"}}><div style={{fontSize:6,color:"#475569",fontWeight:600}}>MEJORAS</div><div style={{fontSize:14,fontWeight:800,color:"#10B981"}}>{leader.summary?.totalSuggestions||0}</div></div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div className="card" style={{padding:14}}><h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:8}}>Problemas</h3>{(leader.issues||[]).length===0?<div style={{padding:16,textAlign:"center",color:"#10B981",fontSize:10}}>Sin problemas</div>:(leader.issues||[]).map((issue,i)=>{const sc={critical:"#EF4444",high:"#F59E0B",medium:"#3B82F6"};return <div key={i} style={{padding:8,background:"rgba(3,7,18,.3)",borderRadius:6,borderLeft:`2px solid ${sc[issue.severity]}`,marginBottom:4}} className="sr"><div style={{display:"flex",gap:4,marginBottom:2}}><span style={{fontSize:7,fontWeight:700,color:sc[issue.severity],textTransform:"uppercase",padding:"0 4px",borderRadius:3,background:`${sc[issue.severity]}08`}}>{issue.severity}</span><span style={{fontSize:7,color:"#334155"}}>{issue.agent}</span></div><div style={{fontSize:9,color:"#CBD5E1",lineHeight:1.3}}>{issue.message}</div></div>;})}</div>
            <div className="card" style={{padding:14}}><h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:8}}>Conversaciones</h3>{(leader.interactions||[]).map((int,i)=>{const to=agents.find(a=>a.id===int.to);return <div key={i} className="sr" style={{animationDelay:`${i*.05}s`,marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:3,marginBottom:1}}><span style={{fontSize:7,color:"#F59E0B",fontWeight:700}}>Leader</span><span style={{fontSize:7,color:"#111827"}}>→</span><span style={{fontSize:7,fontWeight:700,color:to?.color}}>{to?.name}</span></div><div style={{marginLeft:12,padding:"4px 8px",background:"rgba(3,7,18,.3)",borderRadius:"3px 6px 6px 6px",fontSize:9,color:"#94A3B8",lineHeight:1.3}}>{int.message}</div></div>;})}
              {(!leader.interactions||leader.interactions.length===0)&&<div style={{padding:12,textAlign:"center",color:"#0F172A",fontSize:8}}>Todo en orden</div>}
            </div>
          </div>
          {leader.suggestions?.length>0&&<div className="card" style={{padding:14,marginTop:12}}><h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:8}}>Mejoras propuestas</h3><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{leader.suggestions.map((s,i)=><div key={i} style={{padding:8,background:"rgba(3,7,18,.3)",borderRadius:6,display:"flex",gap:6}} className="sr"><div style={{width:18,height:18,borderRadius:4,background:"rgba(124,58,237,.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#A855F7",flexShrink:0}}>+</div><div><div style={{fontSize:9,color:"#E2E8F0",fontWeight:600,lineHeight:1.2}}>{s.action}</div><div style={{fontSize:7,color:"#334155",marginTop:1}}>→ {s.to} — {s.priority}</div></div></div>)}</div></div>}
        </div>}

        {/* ═══ LOGS ═══ */}
        {sec==="logs"&&<div className="au"><div className="card" style={{padding:14}}><h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:10}}>Historial de acciones</h3>{logs.length===0&&<div style={{padding:20,textAlign:"center",color:"#111827",fontSize:9}}>Sin acciones</div>}{logs.map((l,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:i<logs.length-1?"1px solid rgba(30,41,59,.1)":"none"}} className="sr"><div style={{width:5,height:5,borderRadius:"50%",background:l.type==="err"?"#EF4444":"#10B981",flexShrink:0}}/><div style={{flex:1,fontSize:10,color:"#CBD5E1"}}>{l.msg}</div><div style={{fontSize:8,color:"#111827",fontFamily:"monospace"}}>{l.time}</div></div>)}</div></div>}

        <div style={{marginTop:28,paddingTop:10,borderTop:"1px solid rgba(30,41,59,.1)",display:"flex",justifyContent:"space-between",fontSize:7,color:"#080D17"}}><span>Kily&apos;s Agents — Oficina Virtual v5</span><span>{agents.length} agentes — refresh {cd}s</span></div>
      </div>
    </div>
  </>);
}
