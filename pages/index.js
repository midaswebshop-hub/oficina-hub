import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";

function timeAgo(ts) {
  if (!ts) return "—";
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function fmtUSD(v) { return "$" + (parseFloat(v) || 0).toFixed(2); }

// ─── SPARKLINE ──────────────────────────────────────────────
function Spark({ data, color, w = 100, h = 28 }) {
  if (!data || data.length < 2) return null;
  const mx = Math.max(...data, 0.01), mn = Math.min(...data, 0);
  const r = mx - mn || 1, s = w / (data.length - 1);
  const pts = data.map((v, i) => `${(i * s).toFixed(1)},${(h - 3 - ((v - mn) / r) * (h - 6)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".7" /></svg>;
}

// ─── PROGRESS RING ──────────────────────────────────────────
function Ring({ value, max, color, size = 48, label }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E293B" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#F1F5F9" }}>{value}</div>
        {label && <div style={{ fontSize: 7, color: "#475569", marginTop: -1 }}>{label}</div>}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
export default function Hub() {
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [section, setSection] = useState("office");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [clock, setClock] = useState("");
  const intervalRef = useRef(null);

  const show = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 5000); };

  const load = useCallback(async () => {
    setLoading(true);
    const [s, a, p] = await Promise.all([
      fetch("/api/hub?action=status").then(r => r.json()).catch(() => null),
      fetch("/api/hub?action=activity").then(r => r.json()).catch(() => ({ activities: [] })),
      fetch("/api/hub?action=pipeline").then(r => r.json()).catch(() => null),
    ]);
    if (s) setData(s);
    setActivity(a?.activities || []);
    if (p) setPipeline(p.pipeline);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  async function runAction(action, label) {
    setActionLoading(action);
    try {
      const r = await fetch(`/api/hub?action=${action}`, { method: "POST" }).then(r => r.json());
      show(r.ok ? `${label} ejecutado correctamente` : (r.error || "Error"), r.ok ? "ok" : "err");
      if (r.ok) setTimeout(load, 3000);
    } catch { show("Error de red", "err"); }
    setActionLoading(null);
  }

  const agents = data?.agents ? Object.values(data.agents) : [];
  const leader = data?.leader || {};
  const ag = data?.agents || {};
  const healthMap = { operational: { color: "#10B981", label: "OPERATIVO", bg: "rgba(16,185,129,.08)" }, degraded: { color: "#F59E0B", label: "DEGRADADO", bg: "rgba(245,158,11,.08)" }, down: { color: "#EF4444", label: "CAIDO", bg: "rgba(239,68,68,.08)" } };
  const health = healthMap[data?.systemHealth] || healthMap.down;

  const stateMap = {
    idle: { label: "Standby", color: "#64748B", anim: "" },
    working: { label: "Trabajando", color: "#3B82F6", anim: "pulse 2s infinite" },
    alert: { label: "Alerta", color: "#F59E0B", anim: "pulse 1.5s infinite" },
    offline: { label: "Offline", color: "#EF4444", anim: "" },
    error: { label: "Error", color: "#EF4444", anim: "pulse 1s infinite" },
  };

  // Pipeline counts
  const pip = pipeline || { discovered: [], landing_created: [], campaign_active: [], converting: [] };
  const pipTotal = pip.discovered.length + pip.landing_created.length + pip.campaign_active.length + pip.converting.length;

  const navItems = [
    { id: "office", icon: "OFF", label: "Oficina" },
    { id: "command", icon: "CMD", label: "Comando" },
    { id: "pipeline", icon: "PIP", label: "Pipeline" },
    { id: "analytics", icon: "ANL", label: "Analytics" },
    { id: "leader", icon: "LDR", label: "Leader" },
  ];

  return (
    <>
      <Head><title>Oficina Virtual — Kily&apos;s Agents</title></Head>
      <style dangerouslySetInnerHTML={{ __html: `
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#04060C;color:#CBD5E1;font-family:'Inter',-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
        ::selection{background:#7C3AED;color:#fff}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes glow{0%,100%{box-shadow:0 0 16px rgba(124,58,237,.25)}50%{box-shadow:0 0 32px rgba(124,58,237,.6)}}
        @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes slideR{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
        @keyframes orbit{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        .au{animation:fadeUp .5s ease both}
        .fi{animation:fadeIn .4s ease both}
        .sr{animation:slideR .3s ease both}
        .card{background:#0C1222;border-radius:14px;border:1px solid #151F32;transition:all .25s}
        .card:hover{border-color:#1E2D4A;background:#0E1528}
        .btn{padding:8px 16px;border-radius:8px;border:1px solid #1E293B;background:transparent;color:#94A3B8;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
        .btn:hover{border-color:#7C3AED;color:#C4B5FD;background:rgba(124,58,237,.06)}
        .btn:disabled{opacity:.3;cursor:wait}
        .btn-glow{background:linear-gradient(135deg,#7C3AED,#9333EA);border:none;color:#fff;box-shadow:0 4px 24px rgba(124,58,237,.3)}
        .btn-glow:hover{box-shadow:0 6px 32px rgba(124,58,237,.5);transform:translateY(-1px)}
        .glass{background:rgba(15,23,42,.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1E293B;border-radius:2px}
      `}} />

      {/* Toast */}
      {toast && <div style={{ position:"fixed",top:20,right:20,zIndex:9999,padding:"12px 20px",borderRadius:10,background:toast.type==="err"?"rgba(127,29,29,.95)":"rgba(6,78,59,.95)",color:"#fff",fontSize:12,fontWeight:600,boxShadow:"0 16px 48px rgba(0,0,0,.5)",borderLeft:`3px solid ${toast.type==="err"?"#EF4444":"#10B981"}`,maxWidth:340 }} className="sr">{toast.msg}</div>}

      <div style={{ display:"flex",minHeight:"100vh" }}>

        {/* ─── SIDEBAR ─────────────────────────── */}
        <div className="glass" style={{ width:72,borderRight:"1px solid #151F32",display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 0",position:"fixed",top:0,left:0,bottom:0,zIndex:100 }}>
          {/* Logo */}
          <div style={{ width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#7C3AED,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#fff",marginBottom:24,animation:"glow 4s infinite",cursor:"pointer" }} onClick={() => setSection("office")}>K</div>

          {/* Nav */}
          <div style={{ display:"flex",flexDirection:"column",gap:6,flex:1 }}>
            {navItems.map(n => (
              <button key={n.id} onClick={() => setSection(n.id)} style={{
                width:48,height:48,borderRadius:10,border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,transition:"all .2s",
                background: section === n.id ? "rgba(124,58,237,.15)" : "transparent",
                color: section === n.id ? "#A855F7" : "#334155",
              }}>
                <span style={{ fontSize:10,fontWeight:800,letterSpacing:".03em" }}>{n.icon}</span>
                <span style={{ fontSize:7,fontWeight:600 }}>{n.label}</span>
              </button>
            ))}
          </div>

          {/* System health */}
          <div style={{ marginTop:"auto",display:"flex",flexDirection:"column",alignItems:"center",gap:8 }}>
            <div style={{ width:10,height:10,borderRadius:"50%",background:health.color,boxShadow:`0 0 10px ${health.color}60` }} />
            <div style={{ fontSize:7,color:"#334155",fontWeight:600,writingMode:"vertical-lr",transform:"rotate(180deg)",letterSpacing:".1em" }}>SYSTEM</div>
          </div>
        </div>

        {/* ─── MAIN CONTENT ────────────────────── */}
        <div style={{ flex:1,marginLeft:72,padding:"20px 24px" }}>

          {/* ─── TOP BAR ───────────────────────── */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
            <div>
              <h1 style={{ fontSize:20,fontWeight:800,color:"#F1F5F9",letterSpacing:"-.02em" }}>
                {section === "office" ? "Oficina Virtual" : section === "command" ? "Centro de Comando" : section === "pipeline" ? "Pipeline de Productos" : section === "analytics" ? "Analytics" : "Leader Agent"}
              </h1>
              <p style={{ fontSize:11,color:"#334155",marginTop:2 }}>Kily&apos;s Agents — {agents.filter(a => a.online).length} agentes conectados</p>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ fontFamily:"'SF Mono',monospace",fontSize:12,color:"#1E293B",fontWeight:600 }}>{clock}</div>
              <div style={{ padding:"5px 12px",borderRadius:20,background:health.bg,fontSize:10,fontWeight:700,color:health.color,display:"flex",alignItems:"center",gap:5 }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:health.color,animation:data?.systemHealth !== "operational" ? "pulse 1.5s infinite" : "none" }} />
                {health.label}
              </div>
              <button className="btn" onClick={load} disabled={loading} style={{ padding:"6px 12px" }}>{loading ? "..." : "Refresh"}</button>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* OFICINA                                 */}
          {/* ═══════════════════════════════════════ */}
          {section === "office" && (
            <div className="au">
              {/* Agent cards grid */}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20 }}>
                {agents.map((a, i) => {
                  const st = stateMap[a.state] || stateMap.idle;
                  const isSelected = selectedAgent === a.id;
                  return (
                    <div key={a.id} className="card" onClick={() => setSelectedAgent(isSelected ? null : a.id)} style={{
                      padding:0,overflow:"hidden",cursor:"pointer",
                      borderColor: isSelected ? a.color + "60" : undefined,
                      boxShadow: isSelected ? `0 0 24px ${a.color}15` : undefined,
                      animation: `fadeUp .4s ease ${i * 0.07}s both`,
                    }}>
                      {/* Color bar */}
                      <div style={{ height:3,background:a.online ? `linear-gradient(90deg,${a.color},${a.color}00)` : "#1E293B" }} />

                      <div style={{ padding:"16px 16px 14px" }}>
                        {/* Header */}
                        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                          <div style={{ position:"relative" }}>
                            <div style={{
                              width:42,height:42,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,
                              background: a.online ? `${a.color}12` : "#0B1120",
                              color: a.online ? a.color : "#1E293B",
                              animation: st.anim || "none",
                            }}>{a.avatar}</div>
                            {/* Status dot */}
                            <div style={{ position:"absolute",bottom:-1,right:-1,width:11,height:11,borderRadius:"50%",border:"2px solid #0C1222",background:st.color }} />
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13,fontWeight:700,color:"#E2E8F0" }}>{a.name}</div>
                            <div style={{ fontSize:9,color:"#475569",marginTop:1 }}>{a.role}</div>
                          </div>
                        </div>

                        {/* State badge */}
                        <div style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:6,background:`${st.color}10`,fontSize:9,fontWeight:700,color:st.color,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10 }}>
                          <span style={{ width:5,height:5,borderRadius:"50%",background:st.color }} />{st.label}
                        </div>

                        {/* Metrics */}
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                          {a.id === "dropshipping" && <>
                            <div style={{ padding:8,background:"#080D17",borderRadius:8 }}>
                              <div style={{ fontSize:8,color:"#334155",fontWeight:600 }}>PRODUCTOS</div>
                              <div style={{ fontSize:18,fontWeight:800,color:"#F1F5F9" }}>{a.metrics?.totalProducts || 0}</div>
                            </div>
                            <div style={{ padding:8,background:"#080D17",borderRadius:8 }}>
                              <div style={{ fontSize:8,color:"#334155",fontWeight:600 }}>ULTIMA</div>
                              <div style={{ fontSize:13,fontWeight:700,color:"#3B82F6" }}>{timeAgo(a.metrics?.lastRun)}</div>
                            </div>
                          </>}
                          {a.id === "landing" && <>
                            <div style={{ padding:8,background:"#080D17",borderRadius:8 }}>
                              <div style={{ fontSize:8,color:"#334155",fontWeight:600 }}>PUBLICADAS</div>
                              <div style={{ fontSize:18,fontWeight:800,color:"#F1F5F9" }}>{a.metrics?.published || 0}</div>
                            </div>
                            <div style={{ padding:8,background:"#080D17",borderRadius:8 }}>
                              <div style={{ fontSize:8,color:"#334155",fontWeight:600 }}>HOY</div>
                              <div style={{ fontSize:18,fontWeight:800,color:"#10B981" }}>{a.metrics?.last24h || 0}</div>
                            </div>
                          </>}
                          {a.id === "ads" && <>
                            <div style={{ padding:8,background:"#080D17",borderRadius:8 }}>
                              <div style={{ fontSize:8,color:"#334155",fontWeight:600 }}>ACTIVAS</div>
                              <div style={{ fontSize:18,fontWeight:800,color: (a.metrics?.active || 0) > 0 ? "#10B981" : "#EF4444" }}>{a.metrics?.active || 0}</div>
                            </div>
                            <div style={{ padding:8,background:"#080D17",borderRadius:8 }}>
                              <div style={{ fontSize:8,color:"#334155",fontWeight:600 }}>ROAS</div>
                              <div style={{ fontSize:18,fontWeight:800,color:"#7C3AED" }}>{a.metrics?.weekRoas || 0}x</div>
                            </div>
                          </>}
                          {a.id === "leader" && <>
                            <div style={{ padding:8,background:"#080D17",borderRadius:8 }}>
                              <div style={{ fontSize:8,color:"#334155",fontWeight:600 }}>ISSUES</div>
                              <div style={{ fontSize:18,fontWeight:800,color:a.metrics?.critical > 0 ? "#EF4444" : "#F59E0B" }}>{a.metrics?.issues || 0}</div>
                            </div>
                            <div style={{ padding:8,background:"#080D17",borderRadius:8 }}>
                              <div style={{ fontSize:8,color:"#334155",fontWeight:600 }}>MEJORAS</div>
                              <div style={{ fontSize:18,fontWeight:800,color:"#10B981" }}>{a.metrics?.suggestions || 0}</div>
                            </div>
                          </>}
                        </div>
                      </div>

                      {/* Dashboard link */}
                      {a.url && <div style={{ padding:"8px 16px",borderTop:"1px solid #151F32",textAlign:"center" }}><a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10,color:"#1E293B",textDecoration:"none",fontWeight:600 }}>Abrir dashboard →</a></div>}
                    </div>
                  );
                })}
              </div>

              {/* KPI Strip */}
              <div className="card fi" style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",padding:0,marginBottom:20,overflow:"hidden" }}>
                {[
                  { label:"Productos",value:ag.dropshipping?.metrics?.totalProducts || 0,color:"#3B82F6" },
                  { label:"Landings",value:ag.landing?.metrics?.published || 0,color:"#10B981" },
                  { label:"Campanas",value:ag.ads?.metrics?.total || 0,color:"#7C3AED" },
                  { label:"Activas",value:ag.ads?.metrics?.active || 0,color:ag.ads?.metrics?.active > 0 ? "#10B981" : "#EF4444" },
                  { label:"Gasto 7d",value:fmtUSD(ag.ads?.metrics?.weekSpend),color:"#EF4444" },
                  { label:"ROAS",value:`${ag.ads?.metrics?.weekRoas || 0}x`,color:"#F59E0B" },
                ].map((k, i) => (
                  <div key={i} style={{ padding:"14px 12px",textAlign:"center",borderRight:i < 5 ? "1px solid #151F32" : "none" }}>
                    <div style={{ fontSize:8,color:"#334155",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4 }}>{k.label}</div>
                    <div style={{ fontSize:20,fontWeight:800,color:k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Two columns */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
                {/* Activity */}
                <div className="card" style={{ padding:18 }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                    <h3 style={{ fontSize:13,fontWeight:700,color:"#E2E8F0" }}>Actividad reciente</h3>
                    <span style={{ fontSize:9,color:"#1E293B",fontWeight:600 }}>{activity.length}</span>
                  </div>
                  <div style={{ maxHeight:320,overflowY:"auto" }}>
                    {activity.length === 0 && <div style={{ padding:24,textAlign:"center",color:"#1E293B",fontSize:11 }}>Sin actividad</div>}
                    {activity.map((a, i) => (
                      <div key={i} style={{ display:"flex",gap:10,padding:"9px 0",borderBottom:i < activity.length - 1 ? "1px solid #151F3220" : "none" }} className="sr" >
                        <div style={{ width:26,height:26,borderRadius:7,background:`${a.color}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:a.color,flexShrink:0 }}>{a.avatar}</div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:11,color:"#E2E8F0",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{a.title}</div>
                          {a.subtitle && <div style={{ fontSize:9,color:"#334155",marginTop:1 }}>{a.subtitle}</div>}
                        </div>
                        <div style={{ fontSize:9,color:"#1E293B",flexShrink:0 }}>{timeAgo(a.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leader Chat */}
                <div className="card" style={{ padding:18,display:"flex",flexDirection:"column" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
                    <div style={{ width:24,height:24,borderRadius:7,background:"rgba(245,158,11,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#F59E0B" }}>K</div>
                    <h3 style={{ fontSize:13,fontWeight:700,color:"#E2E8F0",flex:1 }}>Leader Agent</h3>
                    <div style={{ fontSize:8,padding:"2px 8px",borderRadius:8,background:leader.leaderStatus === "working" ? "rgba(245,158,11,.08)" : "rgba(239,68,68,.08)",color:leader.leaderStatus === "working" ? "#F59E0B" : "#EF4444",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em" }}>{leader.leaderStatus === "working" ? "Supervisando" : "Alerta"}</div>
                  </div>

                  {/* Leader summary */}
                  {leader.leaderMessage && (
                    <div style={{ padding:"10px 12px",background:"#080D17",borderRadius:"4px 12px 12px 12px",marginBottom:10,borderLeft:"2px solid #F59E0B",fontSize:11,color:"#CBD5E1",lineHeight:1.5 }}>{leader.leaderMessage}</div>
                  )}

                  {/* Interactions */}
                  <div style={{ flex:1,maxHeight:220,overflowY:"auto",display:"flex",flexDirection:"column",gap:8 }}>
                    {(leader.interactions || []).map((int, i) => {
                      const to = agents.find(a => a.id === int.to);
                      const typeColors = { suggestion:"#7C3AED", nudge:"#F59E0B", feedback:"#10B981" };
                      return (
                        <div key={i} className="sr" style={{ animationDelay:`${i * 0.06}s` }}>
                          <div style={{ fontSize:8,color:"#334155",marginBottom:2,display:"flex",alignItems:"center",gap:3 }}>
                            <span style={{ color:"#F59E0B",fontWeight:700 }}>Leader</span>
                            <span>→</span>
                            <span style={{ color:to?.color || "#64748B",fontWeight:700 }}>{to?.name || int.to}</span>
                            <span style={{ padding:"1px 5px",borderRadius:4,background:`${typeColors[int.type] || "#334155"}10`,color:typeColors[int.type] || "#334155",fontSize:7,fontWeight:700 }}>{int.type}</span>
                          </div>
                          <div style={{ marginLeft:0,padding:"8px 12px",background:"#080D17",borderRadius:"4px 10px 10px 10px",fontSize:11,color:"#94A3B8",lineHeight:1.4 }}>{int.message}</div>
                        </div>
                      );
                    })}
                    {(!leader.interactions || leader.interactions.length === 0) && <div style={{ padding:16,textAlign:"center",color:"#151F32",fontSize:10 }}>Sin interacciones</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* COMMAND CENTER                          */}
          {/* ═══════════════════════════════════════ */}
          {section === "command" && (
            <div className="au">
              {/* Workflow cards */}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24 }}>
                {[
                  { id:"run-search",agent:"Dropshipping",icon:"D",color:"#3B82F6",title:"Buscar productos",desc:"Ejecuta una busqueda de productos ganadores con scoring de 8 criterios",action:"Iniciar busqueda" },
                  { id:"run-landings",agent:"Landing Agent",icon:"L",color:"#10B981",title:"Crear landings",desc:"Genera landing pages automaticas para productos con score alto y publica en Shopify",action:"Crear landings" },
                  { id:"run-monitor",agent:"Ads Agent",icon:"A",color:"#7C3AED",title:"Monitorear campanas",desc:"Analiza metricas de campanas activas, pausa las malas y escala las buenas",action:"Monitorear" },
                ].map((w, i) => (
                  <div key={w.id} className="card" style={{ padding:24,animation:`fadeUp .4s ease ${i * 0.08}s both` }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
                      <div style={{ width:40,height:40,borderRadius:10,background:`${w.color}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:w.color }}>{w.icon}</div>
                      <div>
                        <div style={{ fontSize:14,fontWeight:700,color:"#E2E8F0" }}>{w.title}</div>
                        <div style={{ fontSize:10,color:"#334155" }}>{w.agent}</div>
                      </div>
                    </div>
                    <p style={{ fontSize:11,color:"#475569",lineHeight:1.5,marginBottom:16,minHeight:36 }}>{w.desc}</p>
                    <button className="btn-glow" onClick={() => runAction(w.id, w.title)} disabled={!!actionLoading} style={{ width:"100%",padding:"10px",fontSize:12,fontWeight:700,borderRadius:8 }}>
                      {actionLoading === w.id ? "Ejecutando..." : w.action}
                    </button>
                  </div>
                ))}
              </div>

              {/* Full pipeline workflow */}
              <div className="card" style={{ padding:24 }}>
                <h3 style={{ fontSize:14,fontWeight:700,color:"#E2E8F0",marginBottom:16 }}>Flujo completo de produccion</h3>
                <div style={{ display:"flex",alignItems:"center",gap:0 }}>
                  {[
                    { step:1,agent:"Dropshipping",icon:"D",color:"#3B82F6",desc:"Busca productos",metric:`${ag.dropshipping?.metrics?.totalProducts || 0} encontrados`,online:ag.dropshipping?.online },
                    { step:2,agent:"Landing",icon:"L",color:"#10B981",desc:"Crea paginas",metric:`${ag.landing?.metrics?.published || 0} publicadas`,online:ag.landing?.online },
                    { step:3,agent:"Ads",icon:"A",color:"#7C3AED",desc:"Crea campanas",metric:`${ag.ads?.metrics?.active || 0} activas`,online:ag.ads?.online },
                    { step:4,agent:"Optimizador",icon:"$",color:"#F59E0B",desc:"Pausa/escala",metric:`ROAS ${ag.ads?.metrics?.weekRoas || 0}x`,online:ag.ads?.online },
                  ].map((s, i) => (
                    <div key={i} style={{ display:"flex",alignItems:"center",flex:1 }}>
                      <div style={{ flex:1,padding:16,background:"#080D17",borderRadius:10,textAlign:"center" }}>
                        <div style={{ width:36,height:36,borderRadius:10,background:s.online ? `${s.color}12` : "#151F32",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:s.online ? s.color : "#1E293B",margin:"0 auto 8px" }}>{s.icon}</div>
                        <div style={{ fontSize:12,fontWeight:700,color:"#E2E8F0" }}>{s.agent}</div>
                        <div style={{ fontSize:9,color:"#334155",marginTop:2 }}>{s.desc}</div>
                        <div style={{ fontSize:11,fontWeight:700,color:s.color,marginTop:6 }}>{s.metric}</div>
                        <div style={{ width:8,height:8,borderRadius:"50%",background:s.online ? "#10B981" : "#EF4444",margin:"8px auto 0" }} />
                      </div>
                      {i < 3 && <div style={{ width:32,display:"flex",alignItems:"center",justifyContent:"center",color:"#1E293B",fontSize:14 }}>→</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* PIPELINE                                */}
          {/* ═══════════════════════════════════════ */}
          {section === "pipeline" && (
            <div className="au">
              {/* Summary rings */}
              <div style={{ display:"flex",gap:20,marginBottom:24,justifyContent:"center" }}>
                {[
                  { value:pip.discovered.length,label:"Descubiertos",color:"#3B82F6" },
                  { value:pip.landing_created.length,label:"Con landing",color:"#10B981" },
                  { value:pip.campaign_active.length,label:"Con campana",color:"#7C3AED" },
                  { value:pip.converting.length,label:"Convirtiendo",color:"#F59E0B" },
                ].map((r, i) => (
                  <div key={i} style={{ textAlign:"center" }}>
                    <Ring value={r.value} max={Math.max(pipTotal, 1)} color={r.color} size={56} />
                    <div style={{ fontSize:9,color:"#334155",marginTop:6,fontWeight:600 }}>{r.label}</div>
                  </div>
                ))}
              </div>

              {/* Kanban */}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
                {[
                  { key:"discovered",label:"Descubiertos",color:"#3B82F6",icon:"D" },
                  { key:"landing_created",label:"Con Landing",color:"#10B981",icon:"L" },
                  { key:"campaign_active",label:"Con Campana",color:"#7C3AED",icon:"A" },
                  { key:"converting",label:"Convirtiendo",color:"#F59E0B",icon:"$" },
                ].map(col => (
                  <div key={col.key}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"10px 12px",background:`${col.color}06`,borderRadius:10,borderTop:`2px solid ${col.color}` }}>
                      <div style={{ width:22,height:22,borderRadius:6,background:col.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff" }}>{col.icon}</div>
                      <div style={{ fontSize:11,fontWeight:700,color:"#E2E8F0" }}>{col.label}</div>
                      <div style={{ marginLeft:"auto",fontSize:10,fontWeight:700,color:col.color }}>{(pip[col.key] || []).length}</div>
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",gap:6,minHeight:180 }}>
                      {(pip[col.key] || []).map((item, i) => (
                        <div key={i} className="card" style={{ padding:10,borderLeft:`2px solid ${col.color}`,animation:`fadeUp .3s ease ${i * 0.04}s both` }}>
                          <div style={{ fontSize:11,fontWeight:700,color:"#E2E8F0",marginBottom:3 }}>{item.name}</div>
                          <div style={{ display:"flex",gap:6,fontSize:9,color:"#334155" }}>
                            {item.score > 0 && <span>Score: <b style={{ color:item.score >= 8 ? "#10B981" : "#F59E0B" }}>{item.score}</b></span>}
                            {item.status && <span style={{ color:item.status === "ACTIVE" ? "#10B981" : "#475569" }}>{item.status}</span>}
                          </div>
                        </div>
                      ))}
                      {(pip[col.key] || []).length === 0 && <div style={{ padding:20,textAlign:"center",color:"#0E1528",fontSize:10,border:"1px dashed #151F32",borderRadius:8 }}>Vacio</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ANALYTICS                               */}
          {/* ═══════════════════════════════════════ */}
          {section === "analytics" && (
            <div className="au">
              {/* Agent performance cards */}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20 }}>
                {[
                  { agent:ag.dropshipping,name:"Dropshipping",color:"#3B82F6",metrics:[
                    { label:"Productos totales",value:ag.dropshipping?.metrics?.totalProducts || 0 },
                    { label:"Ultima busqueda",value:timeAgo(ag.dropshipping?.metrics?.lastRun) },
                    { label:"Productos/run",value:ag.dropshipping?.metrics?.productsLastRun || 0 },
                    { label:"Estado",value:ag.dropshipping?.online ? "Online" : "Offline" },
                  ]},
                  { agent:ag.landing,name:"Landing Agent",color:"#10B981",metrics:[
                    { label:"Total landings",value:ag.landing?.metrics?.total || 0 },
                    { label:"Publicadas",value:ag.landing?.metrics?.published || 0 },
                    { label:"Borradores",value:ag.landing?.metrics?.drafts || 0 },
                    { label:"Ultimas 24h",value:ag.landing?.metrics?.last24h || 0 },
                  ]},
                  { agent:ag.ads,name:"Ads Agent",color:"#7C3AED",metrics:[
                    { label:"Campanas",value:ag.ads?.metrics?.total || 0 },
                    { label:"Gasto 7d",value:fmtUSD(ag.ads?.metrics?.weekSpend) },
                    { label:"Clics 7d",value:ag.ads?.metrics?.weekClicks || 0 },
                    { label:"Conversiones",value:ag.ads?.metrics?.weekConversions || 0 },
                  ]},
                ].map((card, i) => (
                  <div key={i} className="card" style={{ padding:20,borderTop:`2px solid ${card.color}`,animation:`fadeUp .4s ease ${i * 0.08}s both` }}>
                    <div style={{ fontSize:13,fontWeight:700,color:"#E2E8F0",marginBottom:14 }}>{card.name}</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                      {card.metrics.map((m, j) => (
                        <div key={j} style={{ padding:8,background:"#080D17",borderRadius:8 }}>
                          <div style={{ fontSize:8,color:"#334155",fontWeight:600,textTransform:"uppercase" }}>{m.label}</div>
                          <div style={{ fontSize:15,fontWeight:800,color:card.color,marginTop:2 }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Funnel */}
              <div className="card" style={{ padding:20 }}>
                <h3 style={{ fontSize:13,fontWeight:700,color:"#E2E8F0",marginBottom:14 }}>Embudo de conversion</h3>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {[
                    { label:"Productos descubiertos",value:ag.dropshipping?.metrics?.totalProducts || 0,color:"#3B82F6",maxW:100 },
                    { label:"Landings publicadas",value:ag.landing?.metrics?.published || 0,color:"#10B981",maxW:80 },
                    { label:"Campanas creadas",value:ag.ads?.metrics?.total || 0,color:"#7C3AED",maxW:60 },
                    { label:"Campanas activas",value:ag.ads?.metrics?.active || 0,color:"#F59E0B",maxW:40 },
                    { label:"Conversiones 7d",value:ag.ads?.metrics?.weekConversions || 0,color:"#EF4444",maxW:25 },
                  ].map((f, i) => {
                    const maxVal = ag.dropshipping?.metrics?.totalProducts || 1;
                    const pct = Math.max(8, (f.value / maxVal) * 100);
                    return (
                      <div key={i} style={{ display:"flex",alignItems:"center",gap:12 }}>
                        <div style={{ width:130,fontSize:10,color:"#475569",fontWeight:600,textAlign:"right" }}>{f.label}</div>
                        <div style={{ flex:1,height:28,background:"#080D17",borderRadius:6,overflow:"hidden",position:"relative" }}>
                          <div style={{ width:`${pct}%`,height:"100%",background:`${f.color}20`,borderRadius:6,transition:"width 1s ease",display:"flex",alignItems:"center",paddingLeft:10 }}>
                            <span style={{ fontSize:12,fontWeight:800,color:f.color }}>{f.value}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* LEADER                                  */}
          {/* ═══════════════════════════════════════ */}
          {section === "leader" && (
            <div className="au">
              {/* Leader header */}
              <div className="card" style={{ padding:20,marginBottom:16,display:"flex",alignItems:"center",gap:16,borderLeft:"3px solid #F59E0B" }}>
                <div style={{ width:52,height:52,borderRadius:14,background:"rgba(245,158,11,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:900,color:"#F59E0B",animation:"breathe 3s ease infinite" }}>K</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16,fontWeight:800,color:"#F1F5F9" }}>Leader Agent</div>
                  <div style={{ fontSize:12,color:"#475569",marginTop:2 }}>{leader.leaderMessage || "Analizando sistema..."}</div>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <div style={{ padding:"6px 14px",borderRadius:8,background:"rgba(239,68,68,.06)",textAlign:"center" }}>
                    <div style={{ fontSize:8,color:"#475569",fontWeight:600 }}>ISSUES</div>
                    <div style={{ fontSize:18,fontWeight:800,color:leader.summary?.criticalIssues > 0 ? "#EF4444" : "#F59E0B" }}>{leader.summary?.totalIssues || 0}</div>
                  </div>
                  <div style={{ padding:"6px 14px",borderRadius:8,background:"rgba(16,185,129,.06)",textAlign:"center" }}>
                    <div style={{ fontSize:8,color:"#475569",fontWeight:600 }}>MEJORAS</div>
                    <div style={{ fontSize:18,fontWeight:800,color:"#10B981" }}>{leader.summary?.totalSuggestions || 0}</div>
                  </div>
                </div>
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
                {/* Issues */}
                <div className="card" style={{ padding:18 }}>
                  <h3 style={{ fontSize:13,fontWeight:700,color:"#E2E8F0",marginBottom:12 }}>Problemas detectados</h3>
                  {(leader.issues || []).length === 0 ? (
                    <div style={{ padding:24,textAlign:"center",color:"#10B981",fontSize:12,fontWeight:700 }}>Sin problemas</div>
                  ) : (
                    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      {leader.issues.map((issue, i) => {
                        const sc = { critical:"#EF4444",high:"#F59E0B",medium:"#3B82F6" };
                        return (
                          <div key={i} style={{ padding:10,background:"#080D17",borderRadius:8,borderLeft:`2px solid ${sc[issue.severity]}` }} className="sr">
                            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                              <span style={{ fontSize:8,fontWeight:700,color:sc[issue.severity],textTransform:"uppercase",padding:"1px 6px",borderRadius:4,background:`${sc[issue.severity]}10` }}>{issue.severity}</span>
                              <span style={{ fontSize:9,color:"#334155" }}>{issue.agent}</span>
                            </div>
                            <div style={{ fontSize:11,color:"#CBD5E1",lineHeight:1.4 }}>{issue.message}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Conversations */}
                <div className="card" style={{ padding:18 }}>
                  <h3 style={{ fontSize:13,fontWeight:700,color:"#E2E8F0",marginBottom:12 }}>Conversaciones entre agentes</h3>
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    {(leader.interactions || []).map((int, i) => {
                      const to = agents.find(a => a.id === int.to);
                      return (
                        <div key={i} className="sr" style={{ animationDelay:`${i * 0.07}s` }}>
                          <div style={{ display:"flex",alignItems:"center",gap:5,marginBottom:3 }}>
                            <div style={{ width:18,height:18,borderRadius:5,background:"rgba(245,158,11,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#F59E0B" }}>K</div>
                            <span style={{ fontSize:9,color:"#334155" }}>→</span>
                            <div style={{ width:18,height:18,borderRadius:5,background:`${to?.color || "#334155"}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:to?.color || "#334155" }}>{to?.avatar || "?"}</div>
                            <span style={{ fontSize:9,fontWeight:700,color:to?.color || "#475569" }}>{to?.name}</span>
                          </div>
                          <div style={{ marginLeft:22,padding:"8px 12px",background:"#080D17",borderRadius:"3px 10px 10px 10px",fontSize:11,color:"#94A3B8",lineHeight:1.4 }}>{int.message}</div>
                        </div>
                      );
                    })}
                    {(!leader.interactions || leader.interactions.length === 0) && <div style={{ padding:20,textAlign:"center",color:"#151F32",fontSize:10 }}>Todo en orden — sin comunicaciones necesarias</div>}
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              {leader.suggestions?.length > 0 && (
                <div className="card" style={{ padding:18,marginTop:16 }}>
                  <h3 style={{ fontSize:13,fontWeight:700,color:"#E2E8F0",marginBottom:12 }}>Mejoras propuestas por el Leader</h3>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                    {leader.suggestions.map((s, i) => (
                      <div key={i} style={{ padding:12,background:"#080D17",borderRadius:8,display:"flex",alignItems:"flex-start",gap:10 }} className="sr">
                        <div style={{ width:24,height:24,borderRadius:6,background:"rgba(124,58,237,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#A855F7",flexShrink:0 }}>+</div>
                        <div>
                          <div style={{ fontSize:11,color:"#E2E8F0",fontWeight:600,lineHeight:1.4 }}>{s.action}</div>
                          <div style={{ fontSize:9,color:"#334155",marginTop:3 }}>→ {s.to} — prioridad {s.priority}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop:40,paddingTop:14,borderTop:"1px solid #151F32",display:"flex",justifyContent:"space-between",fontSize:9,color:"#0E1528" }}>
            <span>Kily&apos;s Agents — Oficina Virtual v3</span>
            <span>{agents.length} agentes — {data?.systemHealth || "..."}</span>
          </div>
        </div>
      </div>
    </>
  );
}
