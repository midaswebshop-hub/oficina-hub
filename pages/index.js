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
  // New modules state
  const [auditData,setAuditData]=useState(null);
  const [auditLoading,setAuditLoading]=useState(false);
  const [contentResult,setContentResult]=useState(null);
  const [contentLoading,setContentLoading]=useState(false);
  const [contentType,setContentType]=useState("fb-posts");
  const [codPending,setCodPending]=useState(null);
  const [codLoading,setCodLoading]=useState(false);

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

  // ─── POLICY GUARDIAN ─────────────────────────────
  async function runAudit(){setAuditLoading(true);try{const r=await fetch("https://ads-agent-nine.vercel.app/api/ads?action=audit").then(r=>r.json());setAuditData(r);show(r.ok?"Auditoría completada":"Error en auditoría",r.ok?"ok":"err");}catch(e){show("Error: "+e.message,"err");}setAuditLoading(false);}
  async function runWeeklyAudit(){setAuditLoading(true);try{const r=await fetch("https://ads-agent-nine.vercel.app/api/ads?action=weekly-audit",{method:"POST"}).then(r=>r.json());setAuditData(r.health||r);show("Auditoría semanal enviada a Telegram");}catch(e){show("Error: "+e.message,"err");}setAuditLoading(false);}
  async function pauseAll(){if(!confirm("¿PAUSAR TODAS las campañas? Esto es una acción de emergencia."))return;try{const r=await fetch("https://ads-agent-nine.vercel.app/api/ads?action=pause-all",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:"Pausa manual desde Hub"})}).then(r=>r.json());show(r.ok?`${r.paused} campañas pausadas`:"Error",r.ok?"ok":"err");}catch(e){show("Error: "+e.message,"err");}}

  // ─── CONTENT GENERATOR ─────────────────────────────
  async function generateContent(type){setContentLoading(true);setContentResult(null);const productInfo={name:"Cargador 5 en 1 Para Carro",description:"Cargador magnético retráctil con 5 conectores (USB-C, Lightning, Micro USB, inalámbrico, USB-A). Carga rápida 66W. Compatible con todos los celulares.",price:"18,000",currency:"CRC",countryName:"Costa Rica",countryCode:"CR",hasCOD:true,shopifyUrl:"https://hy1jn3-vn.myshopify.com/products/cargador-5-en-1-para-carro",whatsappNumber:"",images:[],keyFeatures:["5 conectores","Carga rápida 66W","Magnético retráctil","Compatible universal"]};try{const r=await fetch(`https://ads-agent-nine.vercel.app/api/ads?action=${type}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(productInfo)}).then(r=>r.json());setContentResult({type,...r});show(r.ok?`Contenido generado (${type})`:"Error generando",r.ok?"ok":"err");}catch(e){show("Error: "+e.message,"err");}setContentLoading(false);}

  // ─── COD CONFIRMER ─────────────────────────────────
  async function loadCodPending(){setCodLoading(true);try{const r=await fetch("/api/hub?action=cod-pending").then(r=>r.json());setCodPending(r);show(r.ok?`${r.pending?.length||0} pendientes`:"Error",r.ok?"ok":"err");}catch(e){show("Error: "+e.message,"err");}setCodLoading(false);}
  async function codAction(orderNumber,action){try{const r=await fetch(`/api/hub?action=cod-${action}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderNumber})}).then(r=>r.json());show(r.ok?`Pedido #${orderNumber} ${action==="confirm"?"confirmado":"cancelado"}`:"Error",r.ok?"ok":"err");loadCodPending();}catch(e){show("Error: "+e.message,"err");}}

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

  const navs=[{id:"office",i:"OFF",l:"Oficina"},{id:"command",i:"CMD",l:"Comando"},{id:"campaigns",i:"ADS",l:"Campanas"},{id:"guardian",i:"POL",l:"Guardian"},{id:"content",i:"ORG",l:"Contenido"},{id:"cod",i:"COD",l:"Pedidos"},{id:"pipeline",i:"PIP",l:"Pipeline"},{id:"shopify",i:"SHP",l:"Shopify"},{id:"analytics",i:"ANL",l:"Analytics"},{id:"leader",i:"LDR",l:"Leader"},{id:"logs",i:"LOG",l:"Logs"}];
  const dAgent=detail?agents.find(a=>a.id===detail):null;

  /* Agent character configs for office view */
  const charCfg = {
    dropshipping: { icon:"D", color:"#3B82F6", hat:"detective", tool:"magnify", skinTone:"#FBBF7D", label:"Hunter" },
    landing: { icon:"L", color:"#10B981", hat:"hardhat", tool:"blueprint", skinTone:"#F0C9A0", label:"Builder" },
    ads: { icon:"A", color:"#7C3AED", hat:"headset", tool:"megaphone", skinTone:"#DEB887", label:"Marketer" },
    leader: { icon:"K", color:"#F59E0B", hat:"crown", tool:"clipboard", skinTone:"#F5CBA7", label:"Boss" },
  };

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

      /* ======= VIRTUAL OFFICE CHARACTERS ======= */
      @keyframes blink{0%,42%,58%,100%{transform:scaleY(1)}50%{transform:scaleY(0.08)}}
      @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes floatWorking{0%,100%{transform:translateY(0) rotate(-2deg)}25%{transform:translateY(-4px) rotate(1deg)}50%{transform:translateY(-8px) rotate(-1deg)}75%{transform:translateY(-3px) rotate(2deg)}}
      @keyframes typing{0%,100%{opacity:.3}50%{opacity:1}}
      @keyframes screenGlow{0%,100%{box-shadow:0 0 8px var(--ag-c,#3B82F6)20}50%{box-shadow:0 0 20px var(--ag-c,#3B82F6)40}}
      @keyframes deskPulse{0%,100%{box-shadow:0 2px 12px rgba(0,0,0,.3)}50%{box-shadow:0 2px 20px var(--ag-c,#3B82F6)15}}
      @keyframes waveHand{0%,100%{transform:rotate(0deg)}25%{transform:rotate(14deg)}75%{transform:rotate(-8deg)}}
      @keyframes flowDot{0%{offset-distance:0%;opacity:0}10%{opacity:1}90%{opacity:1}100%{offset-distance:100%;opacity:0}}
      @keyframes statusPing{0%{transform:scale(1);opacity:1}100%{transform:scale(2.5);opacity:0}}
      @keyframes appear{from{opacity:0;transform:scale(.7) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes hatBob{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-2px) rotate(3deg)}}
      @keyframes toolSwing{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
      @keyframes mouthTalk{0%,60%,100%{transform:scaleY(1)}30%{transform:scaleY(1.8)}}
      @keyframes chairSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
      @keyframes coffeeSmoke{0%{opacity:0;transform:translateY(0) scale(.5)}50%{opacity:.4;transform:translateY(-8px) scale(1)}100%{opacity:0;transform:translateY(-16px) scale(.6)}}

      .office-floor{
        background:
          radial-gradient(circle at 50% 120%, rgba(124,58,237,.04) 0%, transparent 60%),
          repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(30,41,59,.08) 39px, rgba(30,41,59,.08) 40px),
          repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(30,41,59,.08) 39px, rgba(30,41,59,.08) 40px);
        border-radius:16px;
        position:relative;
        overflow:hidden;
      }
      .office-floor::before{
        content:'';position:absolute;inset:0;
        background:radial-gradient(ellipse at 50% 100%, rgba(124,58,237,.06) 0%, transparent 70%);
        pointer-events:none;
      }

      .agent-workspace{
        display:flex;flex-direction:column;align-items:center;cursor:pointer;
        transition:transform .3s ease;position:relative;
      }
      .agent-workspace:hover{transform:scale(1.05)}
      .agent-workspace:hover .agent-nameplate{background:rgba(255,255,255,.08)}

      .agent-char{position:relative;width:90px;text-align:center;}
      .agent-float{animation:float 3s ease-in-out infinite}
      .agent-float-working{animation:floatWorking 1.5s ease-in-out infinite}

      .agent-head{
        width:48px;height:48px;border-radius:50%;margin:0 auto;position:relative;
        background:var(--skin,#FBBF7D);
        box-shadow:inset -3px -3px 6px rgba(0,0,0,.15), inset 2px 2px 4px rgba(255,255,255,.2);
      }
      .agent-eyes{position:absolute;top:42%;display:flex;gap:10px;justify-content:center;width:100%;}
      .agent-eye{
        width:6px;height:7px;background:#1E293B;border-radius:50%;
        animation:blink 3.5s ease-in-out infinite;
        box-shadow:inset 1px 1px 1px rgba(255,255,255,.3);
      }
      .agent-eye.right{animation-delay:.1s}
      .agent-pupil{
        position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;
        top:1px;right:1px;
      }
      .agent-mouth{
        position:absolute;bottom:28%;left:50%;transform:translateX(-50%);
        width:10px;height:5px;border-bottom:2.5px solid #94532A;border-radius:0 0 50% 50%;
      }
      .agent-mouth.talking{animation:mouthTalk .4s ease infinite}
      .agent-cheek{
        position:absolute;bottom:32%;width:7px;height:4px;border-radius:50%;
        background:rgba(255,120,100,.25);
      }
      .agent-cheek.left{left:15%}
      .agent-cheek.right{right:15%}

      .agent-body{
        width:38px;height:24px;margin:-3px auto 0;border-radius:16px 16px 4px 4px;
        position:relative;
        box-shadow:inset -2px -2px 4px rgba(0,0,0,.2), inset 1px 1px 3px rgba(255,255,255,.1);
      }
      .agent-arm{
        position:absolute;top:4px;width:10px;height:16px;border-radius:5px;
        opacity:.85;
      }
      .agent-arm.left{left:-7px;transform:rotate(8deg);animation:waveHand 4s ease-in-out infinite}
      .agent-arm.right{right:-7px;transform:rotate(-8deg);animation:waveHand 4s ease-in-out infinite reverse}

      /* Hats/accessories */
      .agent-hat{position:absolute;top:-8px;left:50%;transform:translateX(-50%);animation:hatBob 4s ease-in-out infinite}
      .hat-detective{
        width:32px;height:14px;background:#5B4A3F;border-radius:12px 12px 2px 2px;
        box-shadow:0 -2px 0 #4A3C33;
      }
      .hat-detective::after{
        content:'';position:absolute;bottom:-3px;left:-4px;right:-4px;height:4px;
        background:#4A3C33;border-radius:2px;
      }
      .hat-hardhat{
        width:30px;height:16px;background:#F59E0B;border-radius:14px 14px 2px 2px;
        border-bottom:3px solid #D97706;
      }
      .hat-headset{
        width:36px;height:18px;border:2px solid #7C3AED;border-bottom:none;border-radius:18px 18px 0 0;
      }
      .hat-headset::after{
        content:'';position:absolute;bottom:-2px;left:-3px;width:8px;height:8px;
        background:#7C3AED;border-radius:50%;
      }
      .hat-crown{
        width:28px;height:14px;position:relative;
      }
      .hat-crown::before{
        content:'';position:absolute;bottom:0;left:0;right:0;height:6px;
        background:#F59E0B;border-radius:0 0 2px 2px;
      }
      .hat-crown::after{
        content:'';position:absolute;top:0;left:2px;right:2px;height:10px;
        background:#F59E0B;
        clip-path:polygon(0% 100%, 15% 0%, 30% 60%, 50% 0%, 70% 60%, 85% 0%, 100% 100%);
      }

      /* Tool accessories */
      .agent-tool{position:absolute;animation:toolSwing 3s ease-in-out infinite}
      .tool-magnify{
        right:-16px;top:12px;width:16px;height:16px;
        border:2.5px solid #3B82F6;border-radius:50%;
      }
      .tool-magnify::after{
        content:'';position:absolute;bottom:-6px;right:-2px;width:2.5px;height:8px;
        background:#3B82F6;transform:rotate(-45deg);border-radius:1px;
      }
      .tool-blueprint{
        left:-18px;top:16px;width:14px;height:10px;
        background:#10B98130;border:1.5px solid #10B981;border-radius:1px;
      }
      .tool-blueprint::before{
        content:'';position:absolute;top:2px;left:2px;right:2px;bottom:2px;
        border:1px dashed #10B98150;
      }
      .tool-megaphone{
        right:-18px;top:10px;width:0;height:0;
        border-top:5px solid transparent;border-bottom:5px solid transparent;
        border-left:12px solid #7C3AED;border-radius:0 0 2px 0;
      }
      .tool-megaphone::before{
        content:'';position:absolute;left:-14px;top:-3px;width:4px;height:6px;
        background:#9333EA;border-radius:1px;
      }
      .tool-clipboard{
        left:-14px;top:14px;width:11px;height:14px;
        background:#F59E0B20;border:1.5px solid #F59E0B;border-radius:1.5px;
      }
      .tool-clipboard::before{
        content:'';position:absolute;top:-3px;left:50%;transform:translateX(-50%);
        width:6px;height:3px;background:#F59E0B;border-radius:1px;
      }

      /* Desk */
      .agent-desk{
        width:110px;height:14px;margin-top:4px;
        background:linear-gradient(180deg, #1E293B 0%, #0F172A 100%);
        border-radius:4px;border:1px solid rgba(255,255,255,.04);
        position:relative;
        animation:deskPulse 4s ease infinite;
      }
      .agent-desk::before{
        content:'';position:absolute;left:8px;right:8px;top:-22px;height:16px;
        background:rgba(0,0,0,.6);border-radius:2px 2px 0 0;border:1px solid rgba(255,255,255,.05);
        border-bottom:none;
      }
      .desk-screen{
        position:absolute;left:12px;right:12px;top:-20px;height:12px;
        background:rgba(0,0,0,.8);border-radius:1px;overflow:hidden;
        display:flex;align-items:center;justify-content:center;
      }
      .desk-screen-content{
        display:flex;gap:2px;align-items:center;
      }
      .desk-screen-bar{
        width:3px;border-radius:1px;animation:typing .8s ease infinite;
      }
      .desk-legs{
        position:absolute;bottom:-8px;left:15px;right:15px;height:8px;
        display:flex;justify-content:space-between;
      }
      .desk-leg{
        width:2px;height:8px;background:#0F172A;border-radius:0 0 1px 1px;
      }

      /* Chair */
      .agent-chair{
        position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
        width:20px;height:6px;background:#1E293B;border-radius:3px;
        border:1px solid rgba(255,255,255,.03);
      }

      /* Status */
      .agent-status{
        width:10px;height:10px;border-radius:50%;
        position:absolute;top:0;right:10px;
        border:2px solid #0F172A;z-index:2;
      }
      .agent-status.online{background:#10B981}
      .agent-status.offline{background:#EF4444}
      .agent-status-ping{
        position:absolute;top:0;right:10px;width:10px;height:10px;border-radius:50%;
        z-index:1;
      }
      .agent-status-ping.online{background:#10B981;animation:statusPing 2s ease infinite}

      .agent-nameplate{
        margin-top:14px;padding:3px 10px;border-radius:6px;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);
        transition:all .3s;
      }
      .agent-nameplate-name{font-size:10px;font-weight:700;color:#E2E8F0;text-align:center}
      .agent-nameplate-role{font-size:7px;color:#475569;text-align:center;margin-top:1px}

      /* Metrics mini */
      .agent-mini-metrics{
        margin-top:6px;display:flex;gap:4px;justify-content:center;
      }
      .agent-mini-stat{
        padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.3);
        font-size:8px;font-weight:700;
      }

      /* Flow paths */
      .flow-container{position:relative;height:30px;margin:0 20px}
      .flow-path{
        position:absolute;top:50%;left:0;right:0;height:2px;
        background:linear-gradient(90deg, var(--from-c), var(--to-c));
        opacity:.15;border-radius:1px;
      }
      .flow-dot{
        position:absolute;top:50%;transform:translateY(-50%);
        width:6px;height:6px;border-radius:50%;
      }

      /* Office title */
      .office-title{
        font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;
        letter-spacing:3px;text-align:center;margin-bottom:4px;
      }
      .office-subtitle{
        font-size:8px;color:#1E293B;text-align:center;margin-bottom:16px;
      }

      /* Coffee mug */
      .coffee-mug{
        position:absolute;right:4px;top:-8px;width:8px;height:7px;
        background:#8B7355;border-radius:0 0 2px 2px;border:1px solid #6B5B45;
      }
      .coffee-mug::after{
        content:'';position:absolute;right:-4px;top:1px;width:3px;height:4px;
        border:1px solid #6B5B45;border-left:none;border-radius:0 3px 3px 0;
      }
      .coffee-smoke{
        position:absolute;right:6px;top:-16px;width:4px;height:10px;
      }
      .coffee-smoke span{
        position:absolute;bottom:0;width:3px;height:3px;
        border-radius:50%;background:rgba(148,163,184,.15);
        animation:coffeeSmoke 2s ease infinite;
      }
      .coffee-smoke span:nth-child(2){left:2px;animation-delay:.7s}

      /* Score badge on character */
      .char-score{
        position:absolute;top:-4px;left:4px;
        width:22px;height:22px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:8px;font-weight:900;color:#fff;
        border:2px solid #0F172A;z-index:3;
      }
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
          {/* Virtual Office */}
          <div className="office-floor" style={{padding:"24px 16px 20px",marginBottom:14}}>
            <div className="office-title">Kily&apos;s Virtual Office</div>
            <div className="office-subtitle">{agents.filter(a=>a.online).length} agentes activos trabajando</div>

            {/* Agent Characters Row */}
            <div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-end",paddingBottom:16,position:"relative"}}>
              {agents.map((a,i)=>{
                const cfg = charCfg[a.id] || { icon:"?", color:"#475569", hat:"detective", tool:"magnify", skinTone:"#FBBF7D", label:"Agent" };
                const st = sMap[a.state] || sMap.idle;
                const sc = aScore(a.id);
                const scC = sc>=80?"#10B981":sc>=50?"#F59E0B":"#EF4444";
                const isWorking = a.state === "working";
                const isOnline = a.online;

                return <div key={a.id} className="agent-workspace" onClick={()=>setDetail(detail===a.id?null:a.id)}
                  style={{animation:`appear .5s ease ${i*0.1}s both`, "--ag-c": cfg.color, opacity: isOnline ? 1 : 0.4}}>

                  {/* Score badge */}
                  <div className="char-score" style={{background:scC}}>{sc}</div>

                  {/* Status indicator */}
                  {isOnline && <div className="agent-status-ping online"/>}
                  <div className={`agent-status ${isOnline?"online":"offline"}`}/>

                  {/* Character */}
                  <div className="agent-char">
                    <div className={isWorking?"agent-float-working":"agent-float"} style={{animationDelay:`${i*0.4}s`}}>

                      {/* Hat */}
                      <div className="agent-hat" style={{animationDelay:`${i*0.5}s`}}>
                        <div className={`hat-${cfg.hat}`}/>
                      </div>

                      {/* Head */}
                      <div className="agent-head" style={{"--skin": cfg.skinTone}}>
                        <div className="agent-eyes">
                          <div className="agent-eye" style={{animationDelay:`${i*0.7}s`}}>
                            <div className="agent-pupil"/>
                          </div>
                          <div className="agent-eye right" style={{animationDelay:`${i*0.7+0.1}s`}}>
                            <div className="agent-pupil"/>
                          </div>
                        </div>
                        <div className={`agent-mouth${isWorking?" talking":""}`}/>
                        <div className="agent-cheek left"/>
                        <div className="agent-cheek right"/>
                      </div>

                      {/* Body */}
                      <div className="agent-body" style={{background:cfg.color}}>
                        <div className="agent-arm left" style={{background:cfg.color}}/>
                        <div className="agent-arm right" style={{background:cfg.color}}/>
                      </div>

                      {/* Tool */}
                      <div className={`agent-tool tool-${cfg.tool}`} style={{animationDelay:`${i*0.3}s`}}/>
                    </div>
                  </div>

                  {/* Desk area */}
                  <div style={{position:"relative",marginTop:6}}>
                    <div className="agent-desk" style={{"--ag-c": cfg.color}}>
                      <div className="desk-screen">
                        <div className="desk-screen-content">
                          {[...Array(4)].map((_,j)=><div key={j} className="desk-screen-bar" style={{
                            height: `${3 + Math.random()*5}px`,
                            background: cfg.color,
                            opacity: isWorking ? 1 : 0.3,
                            animationDelay: `${j*0.15}s`
                          }}/>)}
                        </div>
                      </div>
                      <div className="desk-legs"><div className="desk-leg"/><div className="desk-leg"/></div>
                      {/* Coffee mug on desk (only for leader) */}
                      {a.id==="leader"&&<>
                        <div className="coffee-mug"/>
                        <div className="coffee-smoke"><span/><span/></div>
                      </>}
                    </div>
                  </div>

                  {/* Nameplate */}
                  <div className="agent-nameplate">
                    <div className="agent-nameplate-name" style={{color:cfg.color}}>{a.name}</div>
                    <div className="agent-nameplate-role">{cfg.label} {st.l !== "Standby" && <span style={{color:st.c}}>({st.l})</span>}</div>
                  </div>

                  {/* Mini metrics */}
                  <div className="agent-mini-metrics">
                    {a.id==="dropshipping"&&<>
                      <span className="agent-mini-stat" style={{color:"#3B82F6"}}>{a.metrics?.totalProducts||0} prod</span>
                    </>}
                    {a.id==="landing"&&<>
                      <span className="agent-mini-stat" style={{color:"#10B981"}}>{a.metrics?.published||0} pub</span>
                    </>}
                    {a.id==="ads"&&<>
                      <span className="agent-mini-stat" style={{color:"#7C3AED"}}>{a.metrics?.active||0} act</span>
                      <span className="agent-mini-stat" style={{color:"#A855F7"}}>{a.metrics?.weekRoas||0}x</span>
                    </>}
                    {a.id==="leader"&&<>
                      <span className="agent-mini-stat" style={{color:a.metrics?.critical>0?"#EF4444":"#F59E0B"}}>{a.metrics?.issues||0} iss</span>
                    </>}
                  </div>
                </div>;
              })}

              {/* Flow connections between agents (SVG arrows on the floor) */}
              {agents.length>=3 && <svg style={{position:"absolute",bottom:60,left:0,right:0,height:30,pointerEvents:"none"}} viewBox="0 0 800 30" preserveAspectRatio="none">
                {/* Path lines */}
                <line x1="140" y1="15" x2="300" y2="15" stroke="#3B82F6" strokeWidth="1" opacity=".15" strokeDasharray="4 3"/>
                <line x1="340" y1="15" x2="500" y2="15" stroke="#10B981" strokeWidth="1" opacity=".15" strokeDasharray="4 3"/>
                <line x1="540" y1="15" x2="680" y2="15" stroke="#7C3AED" strokeWidth="1" opacity=".15" strokeDasharray="4 3"/>

                {/* Animated dots */}
                {ag.dropshipping?.online&&<circle r="3" fill="#3B82F6" opacity=".8">
                  <animateMotion dur="2.5s" repeatCount="indefinite" path="M140,15 L300,15"/>
                  <animate attributeName="opacity" values="0;1;1;0" dur="2.5s" repeatCount="indefinite"/>
                </circle>}
                {ag.landing?.online&&<circle r="3" fill="#10B981" opacity=".8">
                  <animateMotion dur="2.5s" repeatCount="indefinite" path="M340,15 L500,15" begin="0.8s"/>
                  <animate attributeName="opacity" values="0;1;1;0" dur="2.5s" repeatCount="indefinite" begin="0.8s"/>
                </circle>}
                {ag.ads?.online&&<circle r="3" fill="#7C3AED" opacity=".8">
                  <animateMotion dur="2.5s" repeatCount="indefinite" path="M540,15 L680,15" begin="1.6s"/>
                  <animate attributeName="opacity" values="0;1;1;0" dur="2.5s" repeatCount="indefinite" begin="1.6s"/>
                </circle>}
              </svg>}
            </div>
          </div>

          {/* Flow Pipeline Strip */}
          <div className="card" style={{padding:14,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              {[{a:"D",c:"#3B82F6",v:ag.dropshipping?.metrics?.totalProducts||0,l:"productos",on:ag.dropshipping?.online},{a:"L",c:"#10B981",v:ag.landing?.metrics?.published||0,l:"landings",on:ag.landing?.online},{a:"A",c:"#7C3AED",v:ag.ads?.metrics?.total||0,l:"campanas",on:ag.ads?.online},{a:"$",c:"#F59E0B",v:ag.ads?.metrics?.weekConversions||0,l:"ventas",on:ag.ads?.online}].map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",flex:1}}>
                <div style={{flex:1,textAlign:"center"}}><div style={{width:32,height:32,borderRadius:8,background:s.on?`${s.c}0A`:"#111827",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:s.on?s.c:"#111827",margin:"0 auto 4px",border:`1px solid ${s.on?s.c+"20":"#111827"}`}}>{s.a}</div><div style={{fontSize:16,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:7,color:"#1E293B"}}>{s.l}</div></div>
                {i<3&&<div style={{width:40,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",height:16}}><div style={{width:30,height:1,background:"#111827"}}/>{s.on&&<div style={{position:"absolute",width:5,height:5,borderRadius:"50%",background:s.c,animation:`dotMove 2s ease infinite`,animationDelay:`${i*.4}s`}}/>}</div>}
              </div>)}
            </div>
          </div>

          {/* Two cols — Activity + Leader Chat */}
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

        {/* ═══ POLICY GUARDIAN ═══ */}
        {sec==="guardian"&&<div className="au">
          {/* Header */}
          <div className="card" style={{padding:16,marginBottom:14,borderLeft:"3px solid #EF4444"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><h3 style={{fontSize:14,fontWeight:800,color:"#F1F5F9"}}>Policy Guardian</h3><p style={{fontSize:10,color:"#475569",marginTop:2}}>Protege tu Business Manager de Meta contra bans</p></div>
              <div style={{display:"flex",gap:6}}>
                <button className="btn" onClick={runAudit} disabled={auditLoading} style={{color:"#3B82F6",borderColor:"#3B82F620"}}>{auditLoading?"...":"Auditar cuenta"}</button>
                <button className="btn" onClick={runWeeklyAudit} disabled={auditLoading} style={{color:"#F59E0B",borderColor:"#F59E0B20"}}>{auditLoading?"...":"Auditoría + Telegram"}</button>
                <button className="btn" onClick={pauseAll} style={{color:"#EF4444",borderColor:"#EF444420"}}>PAUSAR TODO</button>
              </div>
            </div>
          </div>

          {/* Audit results */}
          {auditData&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
            {[
              {l:"Estado",v:auditData.status_name||"—",c:auditData.healthy?"#10B981":"#EF4444"},
              {l:"Campañas",v:auditData.campaigns?.length||0,c:"#7C3AED"},
              {l:"Gastado total",v:`$${((auditData.amount_spent||0)/100).toFixed(2)}`,c:"#F59E0B"},
              {l:"Problemas",v:auditData.issues?.length||0,c:auditData.issues?.length>0?"#EF4444":"#10B981"},
            ].map((k,i)=><div key={i} className="card" style={{padding:14,textAlign:"center",borderTop:`2px solid ${k.c}`}}><div style={{fontSize:7,color:"#334155",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div style={{fontSize:20,fontWeight:800,color:k.c}}>{k.v}</div></div>)}
          </div>}

          {auditData&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {/* Issues */}
            <div className="card" style={{padding:14}}>
              <h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:8}}>Problemas detectados</h3>
              {(!auditData.issues||auditData.issues.length===0)&&<div style={{padding:20,textAlign:"center",color:"#10B981",fontSize:11,fontWeight:600}}>Sin problemas — cuenta sana</div>}
              {(auditData.issues||[]).map((issue,i)=><div key={i} style={{padding:8,background:"rgba(239,68,68,.04)",borderRadius:6,borderLeft:"2px solid #EF4444",marginBottom:4,fontSize:10,color:"#CBD5E1"}}>{issue}</div>)}
            </div>
            {/* Campaigns */}
            <div className="card" style={{padding:14}}>
              <h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:8}}>Campañas</h3>
              {(auditData.campaigns||[]).length===0&&<div style={{padding:16,textAlign:"center",color:"#334155",fontSize:10}}>Sin campañas</div>}
              {(auditData.campaigns||[]).map((c,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:6,borderBottom:"1px solid rgba(30,41,59,.1)"}}>
                <span style={{fontSize:10,color:"#E2E8F0",fontWeight:600}}>{c.name}</span>
                <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:c.status==="ACTIVE"?"rgba(16,185,129,.08)":"rgba(245,158,11,.08)",color:c.status==="ACTIVE"?"#10B981":"#F59E0B",fontWeight:700}}>{c.status}</span>
              </div>)}
            </div>
          </div>}

          {/* Problem ads */}
          {auditData?.problem_ads?.length>0&&<div className="card" style={{padding:14,marginTop:12,borderLeft:"3px solid #EF4444"}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#EF4444",marginBottom:8}}>Ads con problemas</h3>
            {auditData.problem_ads.map((ad,i)=><div key={i} style={{padding:8,background:"rgba(239,68,68,.04)",borderRadius:6,marginBottom:4}}>
              <div style={{fontSize:10,fontWeight:700,color:"#E2E8F0"}}>{ad.name}</div>
              <div style={{fontSize:9,color:"#EF4444",fontWeight:600}}>{ad.status}</div>
              {ad.feedback&&<div style={{fontSize:8,color:"#475569",marginTop:2}}>{JSON.stringify(ad.feedback)}</div>}
            </div>)}
          </div>}

          {!auditData&&<div className="card" style={{padding:40,textAlign:"center"}}><div style={{fontSize:11,color:"#334155",marginBottom:8}}>Click &quot;Auditar cuenta&quot; para verificar el estado de tu Business Manager</div><div style={{fontSize:9,color:"#1E293B"}}>El Policy Guardian escanea automáticamente cada creativo antes de publicar</div></div>}
        </div>}

        {/* ═══ CONTENT GENERATOR ═══ */}
        {sec==="content"&&<div className="au">
          <div className="card" style={{padding:16,marginBottom:14,borderLeft:"3px solid #10B981"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><h3 style={{fontSize:14,fontWeight:800,color:"#F1F5F9"}}>Content Generator</h3><p style={{fontSize:10,color:"#475569",marginTop:2}}>Genera contenido orgánico para vender sin ads — Cargador 5en1 CR</p></div>
            </div>
            <div style={{display:"flex",gap:6,marginTop:12}}>
              {[{id:"fb-posts",l:"Posts Facebook",c:"#3B82F6",d:"5 posts para grupos"},{id:"reel-scripts",l:"Guiones Reels",c:"#EF4444",d:"3 guiones 30-60s"},{id:"whatsapp-content",l:"WhatsApp",c:"#10B981",d:"Estados + broadcast"}].map(t=>
                <button key={t.id} onClick={()=>{setContentType(t.id);generateContent(t.id);}} disabled={contentLoading} className={contentType===t.id&&contentResult?"btn-glow":"btn"} style={{flex:1,padding:"10px 8px",fontSize:10,borderColor:`${t.c}20`,color:contentType===t.id?undefined:t.c}}>
                  <div style={{fontWeight:700}}>{contentLoading&&contentType===t.id?"Generando...":t.l}</div>
                  <div style={{fontSize:7,marginTop:2,opacity:.7}}>{t.d}</div>
                </button>
              )}
            </div>
          </div>

          {/* FB Posts result */}
          {contentResult?.type==="fb-posts"&&contentResult.ok&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
            {contentResult.general_tips&&<div className="card" style={{padding:12,borderLeft:"2px solid #F59E0B"}}><div style={{fontSize:9,fontWeight:700,color:"#F59E0B",marginBottom:4}}>TIPS PARA PUBLICAR</div><div style={{fontSize:10,color:"#CBD5E1",lineHeight:1.5}}>{contentResult.general_tips}</div></div>}
            {(contentResult.posts||[]).map((post,i)=><div key={i} className="card" style={{padding:14,animation:`fadeUp .3s ease ${i*.06}s both`}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{fontSize:8,padding:"3px 8px",borderRadius:4,background:"rgba(59,130,246,.08)",color:"#3B82F6",fontWeight:700,textTransform:"uppercase"}}>{post.style}</span>
                <span style={{fontSize:8,color:"#475569"}}>{post.best_time}</span>
                <span style={{fontSize:8,color:"#334155",marginLeft:"auto"}}>{post.best_groups}</span>
              </div>
              <div style={{padding:12,background:"rgba(3,7,18,.4)",borderRadius:8,fontSize:11,color:"#E2E8F0",lineHeight:1.6,whiteSpace:"pre-wrap",fontFamily:"system-ui"}}>{post.text}</div>
              <button className="btn" onClick={()=>{navigator.clipboard.writeText(post.text);show("Post copiado al portapapeles");}} style={{marginTop:8,fontSize:9,color:"#10B981",borderColor:"#10B98120"}}>Copiar texto</button>
            </div>)}
          </div>}

          {/* Reel Scripts result */}
          {contentResult?.type==="reel-scripts"&&contentResult.ok&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
            {contentResult.filming_tips&&<div className="card" style={{padding:12,borderLeft:"2px solid #F59E0B"}}><div style={{fontSize:9,fontWeight:700,color:"#F59E0B",marginBottom:4}}>TIPS DE GRABACIÓN</div><div style={{fontSize:10,color:"#CBD5E1",lineHeight:1.5}}>{contentResult.filming_tips}</div></div>}
            {(contentResult.scripts||[]).map((script,i)=><div key={i} className="card" style={{padding:14,animation:`fadeUp .3s ease ${i*.06}s both`}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{fontSize:8,padding:"3px 8px",borderRadius:4,background:"rgba(239,68,68,.08)",color:"#EF4444",fontWeight:700,textTransform:"uppercase"}}>{script.style}</span>
                <span style={{fontSize:9,color:"#475569"}}>{script.duration}</span>
                <span style={{fontSize:8,color:"#334155",marginLeft:"auto"}}>{script.music_style}</span>
              </div>
              <div style={{padding:8,background:"rgba(239,68,68,.04)",borderRadius:6,marginBottom:8}}>
                <div style={{fontSize:8,fontWeight:700,color:"#EF4444",marginBottom:2}}>HOOK (3 primeros segundos)</div>
                <div style={{fontSize:11,color:"#F1F5F9",fontWeight:600}}>{script.hook}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {(script.scenes||[]).map((scene,j)=><div key={j} style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr 1fr",gap:6,padding:6,background:"rgba(3,7,18,.3)",borderRadius:4,fontSize:9}}>
                  <span style={{color:"#7C3AED",fontWeight:700}}>{scene.time}</span>
                  <span style={{color:"#CBD5E1"}}>{scene.visual}</span>
                  <span style={{color:"#94A3B8"}}>{scene.audio}</span>
                  <span style={{color:"#F59E0B",fontWeight:600}}>{scene.text_overlay}</span>
                </div>)}
              </div>
              {script.caption&&<div style={{marginTop:8,padding:8,background:"rgba(3,7,18,.3)",borderRadius:6}}><div style={{fontSize:8,color:"#475569",fontWeight:600,marginBottom:2}}>CAPTION</div><div style={{fontSize:10,color:"#CBD5E1"}}>{script.caption}</div></div>}
            </div>)}
          </div>}

          {/* WhatsApp result */}
          {contentResult?.type==="whatsapp-content"&&contentResult.ok&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:8}}>Estados WhatsApp</h3>
              {(contentResult.status_messages||[]).map((msg,i)=><div key={i} className="card" style={{padding:12,marginBottom:8}}>
                <div style={{padding:10,background:"rgba(16,185,129,.04)",borderRadius:8,fontSize:11,color:"#E2E8F0",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{msg.text}</div>
                {msg.image_suggestion&&<div style={{fontSize:8,color:"#475569",marginTop:4}}>Imagen: {msg.image_suggestion}</div>}
                <button className="btn" onClick={()=>{navigator.clipboard.writeText(msg.text);show("Copiado");}} style={{marginTop:6,fontSize:8,color:"#10B981",borderColor:"#10B98120"}}>Copiar</button>
              </div>)}
            </div>
            <div>
              <h3 style={{fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:8}}>Broadcast</h3>
              {(contentResult.broadcast_messages||[]).map((msg,i)=><div key={i} className="card" style={{padding:12,marginBottom:8}}>
                <div style={{fontSize:8,color:"#F59E0B",fontWeight:600,marginBottom:4}}>Mejor hora: {msg.send_time}</div>
                <div style={{padding:10,background:"rgba(16,185,129,.04)",borderRadius:8,fontSize:11,color:"#E2E8F0",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{msg.text}</div>
                <button className="btn" onClick={()=>{navigator.clipboard.writeText(msg.text);show("Copiado");}} style={{marginTop:6,fontSize:8,color:"#10B981",borderColor:"#10B98120"}}>Copiar</button>
              </div>)}
              {contentResult.tips&&<div className="card" style={{padding:10,borderLeft:"2px solid #F59E0B"}}><div style={{fontSize:8,fontWeight:700,color:"#F59E0B",marginBottom:2}}>TIPS</div><div style={{fontSize:9,color:"#CBD5E1"}}>{contentResult.tips}</div></div>}
            </div>
          </div>}

          {/* Error state */}
          {contentResult&&!contentResult.ok&&<div className="card" style={{padding:20,textAlign:"center",borderLeft:"3px solid #EF4444"}}><div style={{fontSize:11,color:"#EF4444",fontWeight:700}}>Error generando contenido</div><div style={{fontSize:9,color:"#475569",marginTop:4}}>{contentResult.error}</div></div>}

          {!contentResult&&!contentLoading&&<div className="card" style={{padding:40,textAlign:"center"}}><div style={{fontSize:11,color:"#334155",marginBottom:8}}>Selecciona un tipo de contenido para generar</div><div style={{fontSize:9,color:"#1E293B"}}>El contenido se genera con IA para el Cargador 5en1 en Costa Rica</div></div>}
          {contentLoading&&<div className="card" style={{padding:40,textAlign:"center"}}><div style={{fontSize:12,color:"#7C3AED",fontWeight:700,animation:"pulse 1.5s infinite"}}>Generando contenido con Gemini...</div><div style={{fontSize:9,color:"#475569",marginTop:4}}>Esto puede tomar 10-20 segundos</div></div>}
        </div>}

        {/* ═══ COD CONFIRMER ═══ */}
        {sec==="cod"&&<div className="au">
          <div className="card" style={{padding:16,marginBottom:14,borderLeft:"3px solid #F59E0B"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><h3 style={{fontSize:14,fontWeight:800,color:"#F1F5F9"}}>COD Confirmer</h3><p style={{fontSize:10,color:"#475569",marginTop:2}}>Confirma pedidos contra entrega para bajar RTS de 15% a ~8%</p></div>
              <button className="btn" onClick={loadCodPending} disabled={codLoading} style={{color:"#F59E0B",borderColor:"#F59E0B20"}}>{codLoading?"...":"Cargar pendientes"}</button>
            </div>
          </div>

          {/* Stats */}
          {codPending&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
            <div className="card" style={{padding:14,textAlign:"center",borderTop:"2px solid #F59E0B"}}><div style={{fontSize:7,color:"#334155",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Pendientes</div><div style={{fontSize:24,fontWeight:800,color:"#F59E0B"}}>{codPending.pending?.length||0}</div></div>
            <div className="card" style={{padding:14,textAlign:"center",borderTop:"2px solid #EF4444"}}><div style={{fontSize:7,color:"#334155",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Auto-cancelados (48h)</div><div style={{fontSize:24,fontWeight:800,color:"#EF4444"}}>{codPending.auto_cancelled||0}</div></div>
            <div className="card" style={{padding:14,textAlign:"center",borderTop:"2px solid #7C3AED"}}><div style={{fontSize:7,color:"#334155",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Total procesados</div><div style={{fontSize:24,fontWeight:800,color:"#7C3AED"}}>{codPending.total||0}</div></div>
          </div>}

          {/* Pending list */}
          {codPending?.pending?.length>0&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {codPending.pending.map((req,i)=><div key={i} className="card" style={{padding:14,borderLeft:"3px solid #F59E0B",animation:`fadeUp .3s ease ${i*.06}s both`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div>
                  <span style={{fontSize:13,fontWeight:700,color:"#F1F5F9"}}>Pedido #{req.order_id}</span>
                  <span style={{fontSize:9,color:"#475569",marginLeft:8}}>{req.customer_name}</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn-glow" onClick={()=>codAction(req.order_id,"confirm")} style={{padding:"6px 14px",fontSize:10}}>Confirmar</button>
                  <button className="btn" onClick={()=>codAction(req.order_id,"cancel")} style={{color:"#EF4444",borderColor:"#EF444420",fontSize:10}}>Cancelar</button>
                </div>
              </div>
              <div style={{display:"flex",gap:12,fontSize:9,color:"#475569"}}>
                <span>Tel: {req.customer_phone}</span>
                <span>País: {req.country}</span>
                <span>Creado: {timeAgo(req.created_at)}</span>
                <span>Expira: {timeAgo(req.expires_at)}</span>
              </div>
              {req.message_sent&&<div style={{marginTop:8,padding:10,background:"rgba(3,7,18,.4)",borderRadius:8}}>
                <div style={{fontSize:8,color:"#10B981",fontWeight:700,marginBottom:4}}>Mensaje para WhatsApp:</div>
                <div style={{fontSize:10,color:"#CBD5E1",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{req.message_sent}</div>
                <button className="btn" onClick={()=>{navigator.clipboard.writeText(req.message_sent);show("Mensaje copiado");}} style={{marginTop:6,fontSize:8,color:"#10B981",borderColor:"#10B98120"}}>Copiar mensaje</button>
              </div>}
            </div>)}
          </div>}

          {codPending&&codPending.pending?.length===0&&<div className="card" style={{padding:40,textAlign:"center"}}><div style={{fontSize:24,marginBottom:8}}>✓</div><div style={{fontSize:12,color:"#10B981",fontWeight:700}}>Sin pedidos pendientes</div><div style={{fontSize:9,color:"#475569",marginTop:4}}>Cuando llegue un pedido COD, aparecerá aquí con el mensaje de WhatsApp listo para copiar</div></div>}

          {!codPending&&<div className="card" style={{padding:40,textAlign:"center"}}><div style={{fontSize:11,color:"#334155",marginBottom:8}}>Click &quot;Cargar pendientes&quot; para ver pedidos por confirmar</div><div style={{fontSize:9,color:"#1E293B"}}>Cada pedido COD se confirma por WhatsApp antes de enviar a Dropi</div><div style={{fontSize:9,color:"#1E293B",marginTop:4}}>Si no responden en 48h, se cancela automáticamente</div></div>}
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

        <div style={{marginTop:28,paddingTop:10,borderTop:"1px solid rgba(30,41,59,.1)",display:"flex",justifyContent:"space-between",fontSize:7,color:"#080D17"}}><span>Kily&apos;s Agents — Oficina Virtual v6</span><span>{agents.length} agentes — refresh {cd}s</span></div>
      </div>
    </div>
  </>);
}
