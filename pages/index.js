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
function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }

// ─── PROGRESS RING ──────────────────────────────────────────
function Ring({ value, max, color, size = 52 }) {
  const p = max > 0 ? Math.min(value / max, 1) : 0;
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#111827" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={c} strokeDashoffset={c * (1 - p)} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#F1F5F9" }}>{value}</div>
    </div>
  );
}

// ─── COUNTDOWN RING ─────────────────────────────────────────
function CountdownRing({ seconds, total, color = "#7C3AED" }) {
  const p = total > 0 ? seconds / total : 0;
  const r = 9, c = 2 * Math.PI * r;
  return (
    <svg width={24} height={24} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={12} cy={12} r={r} fill="none" stroke="#111827" strokeWidth="2" />
      <circle cx={12} cy={12} r={r} fill="none" stroke={color} strokeWidth="2" strokeDasharray={c} strokeDashoffset={c * (1 - p)} strokeLinecap="round" style={{ transition: "stroke-dashoffset .3s" }} />
    </svg>
  );
}

// ─── SCORE BADGE ────────────────────────────────────────────
function ScoreBadge({ score, label }) {
  const color = score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}10`, border: `2px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color }}>{score}</div>
      <div style={{ fontSize: 7, color: "#475569", fontWeight: 600 }}>{label}</div>
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
  const [detail, setDetail] = useState(null); // agent detail panel
  const [logs, setLogs] = useState([]); // action execution log
  const [clock, setClock] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  const show = (msg, type = "ok") => {
    setToast({ msg, type });
    setLogs(prev => [{ msg, type, time: new Date().toLocaleTimeString("es-CO") }, ...prev].slice(0, 30));
    if (type === "err") setNotifCount(c => c + 1);
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [s, a, p] = await Promise.all([
      fetch("/api/hub?action=status").then(r => r.json()).catch(() => null),
      fetch("/api/hub?action=activity").then(r => r.json()).catch(() => ({ activities: [] })),
      fetch("/api/hub?action=pipeline").then(r => r.json()).catch(() => null),
    ]);
    if (s) {
      setData(s);
      // Add leader issues as notifications
      if (s.leader?.issues?.length > 0) setNotifCount(c => c + s.leader.issues.filter(i => i.severity === "critical").length);
    }
    setActivity(a?.activities || []);
    if (p) setPipeline(p.pipeline);
    setLoading(false);
    setCountdown(60);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh countdown
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { load(); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    return () => clearInterval(t);
  }, []);

  async function runAction(action, label) {
    setActionLoading(action);
    show(`Ejecutando: ${label}...`, "ok");
    try {
      const r = await fetch(`/api/hub?action=${action}`, { method: "POST" }).then(r => r.json());
      show(r.ok ? `${label} — completado` : (r.error || "Error"), r.ok ? "ok" : "err");
      if (r.ok) setTimeout(load, 3000);
    } catch { show(`${label} — error de red`, "err"); }
    setActionLoading(null);
  }

  const agents = data?.agents ? Object.values(data.agents) : [];
  const leader = data?.leader || {};
  const ag = data?.agents || {};
  const healthMap = { operational: { c: "#10B981", l: "OPERATIVO" }, degraded: { c: "#F59E0B", l: "DEGRADADO" }, down: { c: "#EF4444", l: "CAIDO" } };
  const health = healthMap[data?.systemHealth] || healthMap.down;
  const stateMap = { idle: { l: "Standby", c: "#475569", p: false }, working: { l: "Trabajando", c: "#3B82F6", p: true }, alert: { l: "Alerta", c: "#F59E0B", p: true }, offline: { l: "Offline", c: "#EF4444", p: false }, error: { l: "Error", c: "#EF4444", p: true } };
  const pip = pipeline || { discovered: [], landing_created: [], campaign_active: [], converting: [] };

  // Compute performance scores
  function agentScore(id) {
    if (id === "dropshipping") {
      const prods = ag.dropshipping?.metrics?.totalProducts || 0;
      const online = ag.dropshipping?.online ? 30 : 0;
      return Math.min(100, online + Math.min(prods, 70));
    }
    if (id === "landing") {
      const pub = ag.landing?.metrics?.published || 0;
      const online = ag.landing?.online ? 30 : 0;
      return Math.min(100, online + Math.min(pub * 8, 70));
    }
    if (id === "ads") {
      const active = ag.ads?.metrics?.active || 0;
      const roas = parseFloat(ag.ads?.metrics?.weekRoas || 0);
      const online = ag.ads?.online ? 20 : 0;
      return Math.min(100, online + active * 15 + Math.round(roas * 20));
    }
    if (id === "leader") {
      const issues = leader.summary?.totalIssues || 0;
      return Math.max(0, 100 - issues * 25);
    }
    return 0;
  }

  const navItems = [
    { id: "office", icon: "OFF", label: "Oficina" },
    { id: "command", icon: "CMD", label: "Comando" },
    { id: "pipeline", icon: "PIP", label: "Pipeline" },
    { id: "analytics", icon: "ANL", label: "Analytics" },
    { id: "leader", icon: "LDR", label: "Leader" },
    { id: "logs", icon: "LOG", label: "Logs" },
  ];

  const detailAgent = detail ? agents.find(a => a.id === detail) : null;

  return (
    <>
      <Head><title>Oficina Virtual — Kily&apos;s Agents</title></Head>
      <style dangerouslySetInnerHTML={{ __html: `
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#030712;color:#CBD5E1;font-family:'Inter',-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
        ::selection{background:#7C3AED;color:#fff}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(124,58,237,.2)}50%{box-shadow:0 0 40px rgba(124,58,237,.5)}}
        @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes slideR{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideL{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes dotMove{0%{transform:translateX(0);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(60px);opacity:0}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
        .au{animation:fadeUp .5s ease both}
        .sr{animation:slideR .35s ease both}
        .card{background:rgba(15,23,42,.5);border-radius:14px;border:1px solid rgba(30,41,59,.4);transition:all .25s;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
        .card:hover{border-color:rgba(51,65,85,.5);background:rgba(15,23,42,.7)}
        .btn{padding:8px 16px;border-radius:8px;border:1px solid #1E293B;background:transparent;color:#94A3B8;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
        .btn:hover{border-color:#7C3AED;color:#C4B5FD;background:rgba(124,58,237,.05)}
        .btn:disabled{opacity:.3;cursor:wait}
        .btn-glow{background:linear-gradient(135deg,#7C3AED,#9333EA);border:none;color:#fff;font-weight:700;box-shadow:0 4px 24px rgba(124,58,237,.3)}
        .btn-glow:hover{box-shadow:0 8px 40px rgba(124,58,237,.5);transform:translateY(-1px)}
        .glass{background:rgba(3,7,18,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
        .glow-border{border-image:linear-gradient(180deg,rgba(124,58,237,.3),transparent) 1}
        .metric-box{padding:10px;background:rgba(3,7,18,.5);border-radius:10px;border:1px solid rgba(30,41,59,.2)}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1E293B;border-radius:2px}
      `}} />

      {/* TOAST */}
      {toast && <div style={{ position:"fixed",top:16,right:16,zIndex:9999,padding:"10px 18px",borderRadius:10,background:toast.type==="err"?"rgba(127,29,29,.95)":"rgba(6,78,59,.95)",color:"#fff",fontSize:11,fontWeight:600,boxShadow:"0 20px 60px rgba(0,0,0,.6)",borderLeft:`3px solid ${toast.type==="err"?"#EF4444":"#10B981"}`,maxWidth:320 }} className="sr">{toast.msg}</div>}

      {/* DETAIL PANEL (slide-out) */}
      {detailAgent && (
        <div style={{ position:"fixed",top:0,right:0,bottom:0,width:380,zIndex:200,borderLeft:"1px solid rgba(30,41,59,.3)",padding:"20px 24px",overflowY:"auto",animation:"slideL .3s ease" }} className="glass">
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:40,height:40,borderRadius:10,background:`${detailAgent.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:detailAgent.color }}>{detailAgent.avatar}</div>
              <div>
                <div style={{ fontSize:15,fontWeight:700,color:"#F1F5F9" }}>{detailAgent.name}</div>
                <div style={{ fontSize:10,color:"#475569" }}>{detailAgent.role} — {detailAgent.platform}</div>
              </div>
            </div>
            <button onClick={() => setDetail(null)} style={{ background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:18,padding:4 }}>x</button>
          </div>

          {/* Score */}
          <div style={{ display:"flex",justifyContent:"center",marginBottom:20 }}>
            <ScoreBadge score={agentScore(detailAgent.id)} label="Performance" />
          </div>

          {/* Status */}
          <div style={{ padding:12,background:"rgba(3,7,18,.4)",borderRadius:10,marginBottom:14 }}>
            <div style={{ fontSize:9,color:"#334155",fontWeight:600,marginBottom:6 }}>ESTADO</div>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:detailAgent.online ? "#10B981" : "#EF4444" }} />
              <span style={{ fontSize:12,fontWeight:700,color:detailAgent.online ? "#10B981" : "#EF4444" }}>{detailAgent.online ? "ONLINE" : "OFFLINE"}</span>
              {detailAgent.url && <a href={detailAgent.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft:"auto",fontSize:10,color:"#7C3AED",textDecoration:"none" }}>Dashboard →</a>}
            </div>
          </div>

          {/* Metrics */}
          <div style={{ fontSize:9,color:"#334155",fontWeight:600,marginBottom:6 }}>METRICAS</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14 }}>
            {Object.entries(detailAgent.metrics || {}).map(([k, v]) => (
              <div key={k} className="metric-box">
                <div style={{ fontSize:8,color:"#334155",fontWeight:600,textTransform:"uppercase" }}>{k.replace(/([A-Z])/g, " $1")}</div>
                <div style={{ fontSize:16,fontWeight:800,color:detailAgent.color,marginTop:2 }}>{typeof v === "boolean" ? (v ? "Si" : "No") : v}</div>
              </div>
            ))}
          </div>

          {/* Related activity */}
          <div style={{ fontSize:9,color:"#334155",fontWeight:600,marginBottom:6 }}>ACTIVIDAD RECIENTE</div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {activity.filter(a => a.agent === detailAgent.id).slice(0, 8).map((a, i) => (
              <div key={i} style={{ padding:8,background:"rgba(3,7,18,.4)",borderRadius:8,fontSize:10 }}>
                <div style={{ color:"#E2E8F0",fontWeight:600 }}>{a.title}</div>
                {a.subtitle && <div style={{ color:"#334155",marginTop:1 }}>{a.subtitle}</div>}
                <div style={{ color:"#1E293B",marginTop:2 }}>{timeAgo(a.timestamp)}</div>
              </div>
            ))}
            {activity.filter(a => a.agent === detailAgent.id).length === 0 && <div style={{ padding:12,textAlign:"center",color:"#1E293B",fontSize:10 }}>Sin actividad</div>}
          </div>

          {/* Leader feedback for this agent */}
          {(leader.interactions || []).filter(i => i.to === detailAgent.id).length > 0 && (
            <>
              <div style={{ fontSize:9,color:"#334155",fontWeight:600,marginTop:14,marginBottom:6 }}>FEEDBACK DEL LEADER</div>
              {leader.interactions.filter(i => i.to === detailAgent.id).map((int, i) => (
                <div key={i} style={{ padding:8,background:"rgba(245,158,11,.04)",borderRadius:8,borderLeft:"2px solid #F59E0B",marginBottom:6,fontSize:10,color:"#CBD5E1",lineHeight:1.4 }}>{int.message}</div>
              ))}
            </>
          )}
        </div>
      )}

      {/* NOTIFICATION PANEL */}
      {showNotifs && (
        <div style={{ position:"fixed",top:52,right:detail ? 396 : 16,width:300,maxHeight:400,zIndex:150,borderRadius:12,padding:14,overflowY:"auto",border:"1px solid rgba(30,41,59,.3)" }} className="glass sr">
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
            <span style={{ fontSize:12,fontWeight:700,color:"#F1F5F9" }}>Notificaciones</span>
            <button onClick={() => { setShowNotifs(false); setNotifCount(0); }} style={{ background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:10 }}>Cerrar</button>
          </div>
          {(leader.issues || []).map((issue, i) => {
            const sc = { critical:"#EF4444",high:"#F59E0B",medium:"#3B82F6" };
            return (
              <div key={i} style={{ padding:8,background:"rgba(3,7,18,.4)",borderRadius:8,borderLeft:`2px solid ${sc[issue.severity]}`,marginBottom:6,fontSize:10,color:"#CBD5E1" }}>
                <span style={{ fontSize:8,fontWeight:700,color:sc[issue.severity],textTransform:"uppercase" }}>{issue.severity}</span> — {issue.message}
              </div>
            );
          })}
          {logs.slice(0, 10).map((l, i) => (
            <div key={`l${i}`} style={{ padding:6,fontSize:9,color:"#475569",borderBottom:"1px solid rgba(30,41,59,.2)" }}>
              <span style={{ color:l.type === "err" ? "#EF4444" : "#10B981",marginRight:4 }}>{l.type === "err" ? "ERR" : "OK"}</span>
              {l.msg} <span style={{ color:"#1E293B" }}>{l.time}</span>
            </div>
          ))}
          {(leader.issues || []).length === 0 && logs.length === 0 && <div style={{ padding:16,textAlign:"center",color:"#1E293B",fontSize:10 }}>Sin notificaciones</div>}
        </div>
      )}

      <div style={{ display:"flex",minHeight:"100vh" }}>

        {/* ─── SIDEBAR ─────────────────────────── */}
        <div className="glass" style={{ width:68,borderRight:"1px solid rgba(30,41,59,.25)",display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 0",position:"fixed",top:0,left:0,bottom:0,zIndex:100 }}>
          <div style={{ width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#7C3AED,#9333EA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:900,color:"#fff",marginBottom:20,animation:"glow 4s infinite",cursor:"pointer" }} onClick={() => setSection("office")}>K</div>

          <div style={{ display:"flex",flexDirection:"column",gap:4,flex:1 }}>
            {navItems.map(n => (
              <button key={n.id} onClick={() => setSection(n.id)} title={n.label} style={{
                width:44,height:44,borderRadius:10,border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,transition:"all .2s",position:"relative",
                background: section === n.id ? "rgba(124,58,237,.12)" : "transparent",
                color: section === n.id ? "#A855F7" : "#1E293B",
              }}>
                <span style={{ fontSize:9,fontWeight:800,letterSpacing:".03em" }}>{n.icon}</span>
                <span style={{ fontSize:6,fontWeight:600 }}>{n.label}</span>
                {n.id === "leader" && (leader.summary?.totalIssues || 0) > 0 && (
                  <div style={{ position:"absolute",top:4,right:4,width:8,height:8,borderRadius:"50%",background:"#EF4444",animation:"pulse 1.5s infinite" }} />
                )}
              </button>
            ))}
          </div>

          {/* System indicator */}
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6,marginTop:"auto" }}>
            <CountdownRing seconds={countdown} total={60} />
            <div style={{ width:8,height:8,borderRadius:"50%",background:health.c,boxShadow:`0 0 10px ${health.c}50` }} />
          </div>
        </div>

        {/* ─── MAIN ────────────────────────────── */}
        <div style={{ flex:1,marginLeft:68,marginRight:detail ? 380 : 0,transition:"margin-right .3s",padding:"16px 22px" }}>

          {/* TOP BAR */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22 }}>
            <div>
              <h1 style={{ fontSize:18,fontWeight:800,color:"#F1F5F9",letterSpacing:"-.02em" }}>
                {navItems.find(n => n.id === section)?.label || "Oficina"}
              </h1>
              <p style={{ fontSize:10,color:"#1E293B",marginTop:1 }}>{agents.filter(a => a.online).length}/{agents.length} agentes — auto-refresh {countdown}s</p>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <span style={{ fontFamily:"monospace",fontSize:11,color:"#0F172A" }}>{clock}</span>
              <div style={{ padding:"4px 10px",borderRadius:16,background:`${health.c}08`,fontSize:9,fontWeight:700,color:health.c,display:"flex",alignItems:"center",gap:4 }}>
                <span style={{ width:5,height:5,borderRadius:"50%",background:health.c }} />{health.l}
              </div>
              {/* Notification bell */}
              <button onClick={() => setShowNotifs(!showNotifs)} style={{ position:"relative",background:"none",border:"none",cursor:"pointer",padding:4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={notifCount > 0 ? "#F59E0B" : "#1E293B"} strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
                {notifCount > 0 && <div style={{ position:"absolute",top:0,right:0,width:10,height:10,borderRadius:"50%",background:"#EF4444",fontSize:6,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800 }}>{notifCount}</div>}
              </button>
              <button className="btn" onClick={load} disabled={loading} style={{ padding:"5px 10px",fontSize:10 }}>{loading ? "..." : "Refresh"}</button>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* OFICINA                                 */}
          {/* ═══════════════════════════════════════ */}
          {section === "office" && (
            <div className="au">
              {/* Agent grid */}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16 }}>
                {agents.map((a, i) => {
                  const st = stateMap[a.state] || stateMap.idle;
                  const score = agentScore(a.id);
                  return (
                    <div key={a.id} className="card" onClick={() => setDetail(detail === a.id ? null : a.id)} style={{ padding:0,overflow:"hidden",cursor:"pointer",borderColor:detail===a.id ? `${a.color}40` : undefined,animation:`fadeUp .4s ease ${i*0.06}s both` }}>
                      <div style={{ height:2,background:a.online ? `linear-gradient(90deg,${a.color},${a.color}00)` : "#111827" }} />
                      <div style={{ padding:"14px 14px 12px" }}>
                        {/* Header row */}
                        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                          <div style={{ position:"relative" }}>
                            <div style={{ width:40,height:40,borderRadius:10,background:a.online ? `${a.color}10` : "#0B1120",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:900,color:a.online ? a.color : "#111827",animation:st.p ? "breathe 2s ease infinite" : "none" }}>{a.avatar}</div>
                            <div style={{ position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",border:"2px solid rgba(15,23,42,.5)",background:st.c,animation:st.p ? "pulse 1.5s infinite" : "none" }} />
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12,fontWeight:700,color:"#E2E8F0" }}>{a.name}</div>
                            <div style={{ fontSize:8,color:"#334155" }}>{a.role}</div>
                          </div>
                          <ScoreBadge score={score} label="" />
                        </div>

                        {/* State + metrics */}
                        <div style={{ display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:5,background:`${st.c}08`,fontSize:8,fontWeight:700,color:st.c,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8 }}>
                          <span style={{ width:4,height:4,borderRadius:"50%",background:st.c }} />{st.l}
                        </div>

                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:5 }}>
                          {a.id === "dropshipping" && <>
                            <div className="metric-box"><div style={{ fontSize:7,color:"#1E293B",fontWeight:600 }}>PRODUCTOS</div><div style={{ fontSize:16,fontWeight:800,color:"#F1F5F9" }}>{a.metrics?.totalProducts || 0}</div></div>
                            <div className="metric-box"><div style={{ fontSize:7,color:"#1E293B",fontWeight:600 }}>ULTIMA</div><div style={{ fontSize:12,fontWeight:700,color:"#3B82F6" }}>{timeAgo(a.metrics?.lastRun)}</div></div>
                          </>}
                          {a.id === "landing" && <>
                            <div className="metric-box"><div style={{ fontSize:7,color:"#1E293B",fontWeight:600 }}>PUBLICADAS</div><div style={{ fontSize:16,fontWeight:800,color:"#F1F5F9" }}>{a.metrics?.published || 0}</div></div>
                            <div className="metric-box"><div style={{ fontSize:7,color:"#1E293B",fontWeight:600 }}>HOY</div><div style={{ fontSize:16,fontWeight:800,color:"#10B981" }}>{a.metrics?.last24h || 0}</div></div>
                          </>}
                          {a.id === "ads" && <>
                            <div className="metric-box"><div style={{ fontSize:7,color:"#1E293B",fontWeight:600 }}>ACTIVAS</div><div style={{ fontSize:16,fontWeight:800,color:(a.metrics?.active||0) > 0 ? "#10B981" : "#EF4444" }}>{a.metrics?.active || 0}</div></div>
                            <div className="metric-box"><div style={{ fontSize:7,color:"#1E293B",fontWeight:600 }}>ROAS</div><div style={{ fontSize:16,fontWeight:800,color:"#7C3AED" }}>{a.metrics?.weekRoas || 0}x</div></div>
                          </>}
                          {a.id === "leader" && <>
                            <div className="metric-box"><div style={{ fontSize:7,color:"#1E293B",fontWeight:600 }}>ISSUES</div><div style={{ fontSize:16,fontWeight:800,color:a.metrics?.critical > 0 ? "#EF4444" : "#F59E0B" }}>{a.metrics?.issues || 0}</div></div>
                            <div className="metric-box"><div style={{ fontSize:7,color:"#1E293B",fontWeight:600 }}>MEJORAS</div><div style={{ fontSize:16,fontWeight:800,color:"#10B981" }}>{a.metrics?.suggestions || 0}</div></div>
                          </>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Flow visualization */}
              <div className="card" style={{ padding:16,marginBottom:16 }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  {[
                    { a:"D",c:"#3B82F6",n:"Dropshipping",v:ag.dropshipping?.metrics?.totalProducts || 0,l:"productos",on:ag.dropshipping?.online },
                    { a:"L",c:"#10B981",n:"Landing",v:ag.landing?.metrics?.published || 0,l:"publicadas",on:ag.landing?.online },
                    { a:"A",c:"#7C3AED",n:"Ads Agent",v:ag.ads?.metrics?.total || 0,l:"campanas",on:ag.ads?.online },
                    { a:"$",c:"#F59E0B",n:"Ventas",v:ag.ads?.metrics?.weekConversions || 0,l:"conversiones",on:ag.ads?.online },
                  ].map((s, i) => (
                    <div key={i} style={{ display:"flex",alignItems:"center",flex:1 }}>
                      <div style={{ flex:1,textAlign:"center" }}>
                        <div style={{ width:36,height:36,borderRadius:10,background:s.on ? `${s.c}10` : "#111827",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:s.on ? s.c : "#111827",margin:"0 auto 6px",border:`1px solid ${s.on ? s.c+"30" : "#111827"}` }}>{s.a}</div>
                        <div style={{ fontSize:18,fontWeight:800,color:s.c }}>{s.v}</div>
                        <div style={{ fontSize:8,color:"#334155" }}>{s.l}</div>
                      </div>
                      {i < 3 && (
                        <div style={{ width:50,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",height:20 }}>
                          <div style={{ width:40,height:1,background:"#1E293B" }} />
                          {s.on && <div style={{ position:"absolute",width:6,height:6,borderRadius:"50%",background:s.c,animation:"dotMove 2s ease infinite",animationDelay:`${i*0.5}s` }} />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Two columns */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                {/* Activity */}
                <div className="card" style={{ padding:16 }}>
                  <h3 style={{ fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:10 }}>Actividad reciente</h3>
                  <div style={{ maxHeight:280,overflowY:"auto" }}>
                    {activity.length === 0 && <div style={{ padding:20,textAlign:"center",color:"#111827",fontSize:10 }}>Sin actividad</div>}
                    {activity.map((a, i) => (
                      <div key={i} style={{ display:"flex",gap:8,padding:"8px 0",borderBottom:i < activity.length - 1 ? "1px solid rgba(30,41,59,.15)" : "none" }} className="sr">
                        <div style={{ width:24,height:24,borderRadius:6,background:`${a.color}08`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:a.color,flexShrink:0 }}>{a.avatar}</div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:10,color:"#E2E8F0",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{a.title}</div>
                          {a.subtitle && <div style={{ fontSize:8,color:"#334155",marginTop:1 }}>{a.subtitle}</div>}
                        </div>
                        <div style={{ fontSize:8,color:"#111827",flexShrink:0 }}>{timeAgo(a.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leader chat */}
                <div className="card" style={{ padding:16,display:"flex",flexDirection:"column" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
                    <div style={{ width:22,height:22,borderRadius:6,background:"rgba(245,158,11,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#F59E0B" }}>K</div>
                    <h3 style={{ fontSize:12,fontWeight:700,color:"#E2E8F0",flex:1 }}>Leader Agent</h3>
                    <div style={{ fontSize:7,padding:"2px 6px",borderRadius:6,background:leader.leaderStatus==="working" ? "rgba(245,158,11,.06)" : "rgba(239,68,68,.06)",color:leader.leaderStatus==="working" ? "#F59E0B" : "#EF4444",fontWeight:700,textTransform:"uppercase" }}>{leader.leaderStatus === "working" ? "Activo" : "Alerta"}</div>
                  </div>

                  {leader.leaderMessage && (
                    <div style={{ padding:"8px 10px",background:"rgba(3,7,18,.4)",borderRadius:"3px 10px 10px 10px",marginBottom:8,borderLeft:"2px solid #F59E0B",fontSize:10,color:"#CBD5E1",lineHeight:1.5 }}>{leader.leaderMessage}</div>
                  )}

                  <div style={{ flex:1,maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:6 }}>
                    {(leader.interactions || []).map((int, i) => {
                      const to = agents.find(a => a.id === int.to);
                      const tc = { suggestion:"#7C3AED",nudge:"#F59E0B",feedback:"#10B981" };
                      return (
                        <div key={i} className="sr" style={{ animationDelay:`${i*0.05}s` }}>
                          <div style={{ fontSize:7,color:"#1E293B",marginBottom:2,display:"flex",alignItems:"center",gap:3 }}>
                            <span style={{ color:"#F59E0B",fontWeight:700 }}>Leader</span>→<span style={{ color:to?.color,fontWeight:700 }}>{to?.name}</span>
                            <span style={{ padding:"0 4px",borderRadius:3,background:`${tc[int.type]}08`,color:tc[int.type],fontSize:7,fontWeight:700 }}>{int.type}</span>
                          </div>
                          <div style={{ padding:"6px 10px",background:"rgba(3,7,18,.4)",borderRadius:"3px 8px 8px 8px",fontSize:10,color:"#94A3B8",lineHeight:1.4 }}>{int.message}</div>
                        </div>
                      );
                    })}
                    {(!leader.interactions || leader.interactions.length === 0) && <div style={{ padding:12,textAlign:"center",color:"#0F172A",fontSize:9 }}>Sin interacciones</div>}
                  </div>

                  {/* Quick controls */}
                  <div style={{ display:"flex",gap:6,marginTop:10,paddingTop:10,borderTop:"1px solid rgba(30,41,59,.2)" }}>
                    <button className="btn" onClick={() => runAction("run-search","Busqueda")} disabled={!!actionLoading} style={{ flex:1,fontSize:9,padding:"6px 4px",color:"#3B82F6",borderColor:"#3B82F620" }}>{actionLoading==="run-search" ? "..." : "Buscar"}</button>
                    <button className="btn" onClick={() => runAction("run-landings","Landings")} disabled={!!actionLoading} style={{ flex:1,fontSize:9,padding:"6px 4px",color:"#10B981",borderColor:"#10B98120" }}>{actionLoading==="run-landings" ? "..." : "Landings"}</button>
                    <button className="btn" onClick={() => runAction("run-monitor","Monitor")} disabled={!!actionLoading} style={{ flex:1,fontSize:9,padding:"6px 4px",color:"#7C3AED",borderColor:"#7C3AED20" }}>{actionLoading==="run-monitor" ? "..." : "Ads"}</button>
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
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20 }}>
                {[
                  { id:"run-search",icon:"D",color:"#3B82F6",title:"Buscar productos",desc:"Ejecuta scoring de 8 criterios para encontrar productos ganadores",time:"~3 min" },
                  { id:"run-landings",icon:"L",color:"#10B981",title:"Crear landings",desc:"Genera paginas con Gemini + publica automaticamente en Shopify",time:"~45 seg" },
                  { id:"run-monitor",icon:"A",color:"#7C3AED",title:"Monitorear ads",desc:"Analiza metricas, pausa campanas malas y escala las buenas",time:"~30 seg" },
                ].map((w, i) => (
                  <div key={w.id} className="card" style={{ padding:20,animation:`fadeUp .4s ease ${i*0.07}s both` }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                      <div style={{ width:38,height:38,borderRadius:10,background:`${w.color}10`,border:`1px solid ${w.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:w.color }}>{w.icon}</div>
                      <div>
                        <div style={{ fontSize:13,fontWeight:700,color:"#E2E8F0" }}>{w.title}</div>
                        <div style={{ fontSize:9,color:"#334155" }}>{w.time}</div>
                      </div>
                    </div>
                    <p style={{ fontSize:10,color:"#475569",lineHeight:1.5,marginBottom:14,minHeight:32 }}>{w.desc}</p>
                    <button className="btn-glow" onClick={() => runAction(w.id,w.title)} disabled={!!actionLoading} style={{ width:"100%",padding:10,fontSize:11,borderRadius:8 }}>
                      {actionLoading === w.id ? "Ejecutando..." : "Ejecutar"}
                    </button>
                  </div>
                ))}
              </div>

              {/* Full flow */}
              <div className="card" style={{ padding:20 }}>
                <h3 style={{ fontSize:13,fontWeight:700,color:"#E2E8F0",marginBottom:14 }}>Flujo de produccion</h3>
                <div style={{ display:"flex",gap:0 }}>
                  {[
                    { n:1,a:"Dropshipping",icon:"D",c:"#3B82F6",desc:"Busca productos",m:`${ag.dropshipping?.metrics?.totalProducts || 0} encontrados`,on:ag.dropshipping?.online },
                    { n:2,a:"Landing",icon:"L",c:"#10B981",desc:"Crea paginas",m:`${ag.landing?.metrics?.published || 0} publicadas`,on:ag.landing?.online },
                    { n:3,a:"Ads Agent",icon:"A",c:"#7C3AED",desc:"Crea campanas",m:`${ag.ads?.metrics?.active || 0} activas`,on:ag.ads?.online },
                    { n:4,a:"Optimizador",icon:"$",c:"#F59E0B",desc:"Pausa/escala",m:`ROAS ${ag.ads?.metrics?.weekRoas || 0}x`,on:ag.ads?.online },
                  ].map((s, i) => (
                    <div key={i} style={{ display:"flex",alignItems:"center",flex:1 }}>
                      <div style={{ flex:1,padding:14,background:"rgba(3,7,18,.4)",borderRadius:10,textAlign:"center" }}>
                        <div style={{ width:32,height:32,borderRadius:8,background:s.on ? `${s.c}10` : "#111827",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:s.on ? s.c : "#111827",margin:"0 auto 6px" }}>{s.icon}</div>
                        <div style={{ fontSize:11,fontWeight:700,color:"#E2E8F0" }}>{s.a}</div>
                        <div style={{ fontSize:8,color:"#334155",marginTop:1 }}>{s.desc}</div>
                        <div style={{ fontSize:10,fontWeight:700,color:s.c,marginTop:4 }}>{s.m}</div>
                        <div style={{ width:6,height:6,borderRadius:"50%",background:s.on ? "#10B981" : "#EF4444",margin:"6px auto 0" }} />
                      </div>
                      {i < 3 && <div style={{ width:28,textAlign:"center",color:"#1E293B",fontSize:12 }}>→</div>}
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
              <div style={{ display:"flex",gap:16,marginBottom:20,justifyContent:"center" }}>
                {[
                  { v:pip.discovered.length,l:"Descubiertos",c:"#3B82F6" },
                  { v:pip.landing_created.length,l:"Con landing",c:"#10B981" },
                  { v:pip.campaign_active.length,l:"Con campana",c:"#7C3AED" },
                  { v:pip.converting.length,l:"Convirtiendo",c:"#F59E0B" },
                ].map((r, i) => (
                  <div key={i} style={{ textAlign:"center" }}>
                    <Ring value={r.v} max={Math.max(pip.discovered.length, 1)} color={r.c} />
                    <div style={{ fontSize:8,color:"#334155",marginTop:4,fontWeight:600 }}>{r.l}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10 }}>
                {[
                  { key:"discovered",l:"Descubiertos",c:"#3B82F6",i:"D" },
                  { key:"landing_created",l:"Con Landing",c:"#10B981",i:"L" },
                  { key:"campaign_active",l:"Con Campana",c:"#7C3AED",i:"A" },
                  { key:"converting",l:"Convirtiendo",c:"#F59E0B",i:"$" },
                ].map(col => (
                  <div key={col.key}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"8px 10px",background:`${col.c}05`,borderRadius:8,borderTop:`2px solid ${col.c}` }}>
                      <div style={{ width:20,height:20,borderRadius:5,background:col.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#fff" }}>{col.i}</div>
                      <span style={{ fontSize:10,fontWeight:700,color:"#E2E8F0" }}>{col.l}</span>
                      <span style={{ marginLeft:"auto",fontSize:9,fontWeight:700,color:col.c }}>{(pip[col.key]||[]).length}</span>
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",gap:5,minHeight:160 }}>
                      {(pip[col.key]||[]).map((item, i) => (
                        <div key={i} className="card" style={{ padding:8,borderLeft:`2px solid ${col.c}`,animation:`fadeUp .3s ease ${i*0.04}s both` }}>
                          <div style={{ fontSize:10,fontWeight:700,color:"#E2E8F0",marginBottom:2 }}>{item.name}</div>
                          <div style={{ display:"flex",gap:4,fontSize:8,color:"#334155" }}>
                            {item.score > 0 && <span>Score: <b style={{ color:item.score >= 8 ? "#10B981" : "#F59E0B" }}>{item.score}</b></span>}
                            {item.status && <span style={{ color:item.status==="ACTIVE" ? "#10B981" : "#475569" }}>{item.status}</span>}
                          </div>
                        </div>
                      ))}
                      {(pip[col.key]||[]).length === 0 && <div style={{ padding:16,textAlign:"center",color:"#0B1120",fontSize:9,border:"1px dashed #151F32",borderRadius:8 }}>Vacio</div>}
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
              {/* Performance scores */}
              <div className="card" style={{ padding:18,marginBottom:16 }}>
                <h3 style={{ fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:14 }}>Performance de agentes</h3>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14 }}>
                  {agents.map((a, i) => {
                    const score = agentScore(a.id);
                    const color = score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
                    return (
                      <div key={a.id} style={{ textAlign:"center",padding:14,background:"rgba(3,7,18,.4)",borderRadius:10 }}>
                        <Ring value={score} max={100} color={color} size={60} />
                        <div style={{ fontSize:11,fontWeight:700,color:"#E2E8F0",marginTop:8 }}>{a.name}</div>
                        <div style={{ fontSize:8,color,fontWeight:700,marginTop:2 }}>{score >= 80 ? "Excelente" : score >= 50 ? "Regular" : "Bajo"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Metrics per agent */}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16 }}>
                {[
                  { n:"Dropshipping",c:"#3B82F6",m:[
                    { l:"Productos",v:ag.dropshipping?.metrics?.totalProducts || 0 },
                    { l:"Por run",v:ag.dropshipping?.metrics?.productsLastRun || 0 },
                    { l:"Ultima busqueda",v:timeAgo(ag.dropshipping?.metrics?.lastRun) },
                    { l:"Activo",v:ag.dropshipping?.metrics?.isActive ? "Si" : "No" },
                  ]},
                  { n:"Landing Agent",c:"#10B981",m:[
                    { l:"Total",v:ag.landing?.metrics?.total || 0 },
                    { l:"Publicadas",v:ag.landing?.metrics?.published || 0 },
                    { l:"Borradores",v:ag.landing?.metrics?.drafts || 0 },
                    { l:"Hoy",v:ag.landing?.metrics?.last24h || 0 },
                  ]},
                  { n:"Ads Agent",c:"#7C3AED",m:[
                    { l:"Campanas",v:ag.ads?.metrics?.total || 0 },
                    { l:"Gasto 7d",v:fmtUSD(ag.ads?.metrics?.weekSpend) },
                    { l:"Clics",v:ag.ads?.metrics?.weekClicks || 0 },
                    { l:"ROAS",v:`${ag.ads?.metrics?.weekRoas || 0}x` },
                  ]},
                ].map((card, i) => (
                  <div key={i} className="card" style={{ padding:16,borderTop:`2px solid ${card.c}`,animation:`fadeUp .4s ease ${i*0.07}s both` }}>
                    <div style={{ fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:10 }}>{card.n}</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                      {card.m.map((m, j) => (
                        <div key={j} className="metric-box">
                          <div style={{ fontSize:7,color:"#1E293B",fontWeight:600,textTransform:"uppercase" }}>{m.l}</div>
                          <div style={{ fontSize:14,fontWeight:800,color:card.c,marginTop:2 }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Funnel */}
              <div className="card" style={{ padding:18 }}>
                <h3 style={{ fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:12 }}>Embudo de conversion</h3>
                {[
                  { l:"Productos descubiertos",v:ag.dropshipping?.metrics?.totalProducts || 0,c:"#3B82F6" },
                  { l:"Landings publicadas",v:ag.landing?.metrics?.published || 0,c:"#10B981" },
                  { l:"Campanas creadas",v:ag.ads?.metrics?.total || 0,c:"#7C3AED" },
                  { l:"Campanas activas",v:ag.ads?.metrics?.active || 0,c:"#F59E0B" },
                  { l:"Conversiones 7d",v:ag.ads?.metrics?.weekConversions || 0,c:"#EF4444" },
                ].map((f, i) => {
                  const maxVal = ag.dropshipping?.metrics?.totalProducts || 1;
                  const w = Math.max(6, (f.v / maxVal) * 100);
                  return (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
                      <div style={{ width:120,fontSize:9,color:"#475569",textAlign:"right",fontWeight:600 }}>{f.l}</div>
                      <div style={{ flex:1,height:24,background:"rgba(3,7,18,.4)",borderRadius:5,overflow:"hidden" }}>
                        <div style={{ width:`${w}%`,height:"100%",background:`${f.c}15`,borderRadius:5,display:"flex",alignItems:"center",paddingLeft:8,transition:"width 1s ease" }}>
                          <span style={{ fontSize:11,fontWeight:800,color:f.c }}>{f.v}</span>
                        </div>
                      </div>
                      <div style={{ width:36,fontSize:9,color:"#334155",textAlign:"right" }}>{pct(f.v, maxVal)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* LEADER                                  */}
          {/* ═══════════════════════════════════════ */}
          {section === "leader" && (
            <div className="au">
              <div className="card" style={{ padding:16,marginBottom:14,display:"flex",alignItems:"center",gap:14,borderLeft:"3px solid #F59E0B" }}>
                <div style={{ width:48,height:48,borderRadius:12,background:"rgba(245,158,11,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:900,color:"#F59E0B",animation:"breathe 3s ease infinite" }}>K</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15,fontWeight:800,color:"#F1F5F9" }}>Leader Agent</div>
                  <div style={{ fontSize:11,color:"#475569",marginTop:1 }}>{leader.leaderMessage}</div>
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <div style={{ padding:"6px 12px",borderRadius:8,background:"rgba(239,68,68,.04)",textAlign:"center" }}>
                    <div style={{ fontSize:7,color:"#475569",fontWeight:600 }}>ISSUES</div>
                    <div style={{ fontSize:16,fontWeight:800,color:leader.summary?.criticalIssues > 0 ? "#EF4444" : "#F59E0B" }}>{leader.summary?.totalIssues || 0}</div>
                  </div>
                  <div style={{ padding:"6px 12px",borderRadius:8,background:"rgba(16,185,129,.04)",textAlign:"center" }}>
                    <div style={{ fontSize:7,color:"#475569",fontWeight:600 }}>MEJORAS</div>
                    <div style={{ fontSize:16,fontWeight:800,color:"#10B981" }}>{leader.summary?.totalSuggestions || 0}</div>
                  </div>
                </div>
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                {/* Issues */}
                <div className="card" style={{ padding:16 }}>
                  <h3 style={{ fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:10 }}>Problemas</h3>
                  {(leader.issues||[]).length === 0 ? <div style={{ padding:20,textAlign:"center",color:"#10B981",fontSize:11 }}>Sin problemas</div> : (leader.issues||[]).map((issue, i) => {
                    const sc = { critical:"#EF4444",high:"#F59E0B",medium:"#3B82F6" };
                    return (
                      <div key={i} style={{ padding:10,background:"rgba(3,7,18,.4)",borderRadius:8,borderLeft:`2px solid ${sc[issue.severity]}`,marginBottom:6 }} className="sr">
                        <div style={{ display:"flex",alignItems:"center",gap:4,marginBottom:3 }}>
                          <span style={{ fontSize:7,fontWeight:700,color:sc[issue.severity],textTransform:"uppercase",padding:"1px 5px",borderRadius:3,background:`${sc[issue.severity]}08` }}>{issue.severity}</span>
                          <span style={{ fontSize:8,color:"#334155" }}>{issue.agent}</span>
                        </div>
                        <div style={{ fontSize:10,color:"#CBD5E1",lineHeight:1.4 }}>{issue.message}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Conversations */}
                <div className="card" style={{ padding:16 }}>
                  <h3 style={{ fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:10 }}>Conversaciones</h3>
                  {(leader.interactions||[]).map((int, i) => {
                    const to = agents.find(a => a.id === int.to);
                    return (
                      <div key={i} className="sr" style={{ animationDelay:`${i*0.06}s`,marginBottom:8 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:4,marginBottom:2 }}>
                          <div style={{ width:16,height:16,borderRadius:4,background:"rgba(245,158,11,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:800,color:"#F59E0B" }}>K</div>
                          <span style={{ fontSize:8,color:"#1E293B" }}>→</span>
                          <div style={{ width:16,height:16,borderRadius:4,background:`${to?.color}08`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:800,color:to?.color }}>{to?.avatar}</div>
                          <span style={{ fontSize:8,fontWeight:700,color:to?.color }}>{to?.name}</span>
                        </div>
                        <div style={{ marginLeft:20,padding:"6px 10px",background:"rgba(3,7,18,.4)",borderRadius:"3px 8px 8px 8px",fontSize:10,color:"#94A3B8",lineHeight:1.4 }}>{int.message}</div>
                      </div>
                    );
                  })}
                  {(!leader.interactions||leader.interactions.length===0) && <div style={{ padding:16,textAlign:"center",color:"#0F172A",fontSize:9 }}>Todo en orden</div>}
                </div>
              </div>

              {leader.suggestions?.length > 0 && (
                <div className="card" style={{ padding:16,marginTop:14 }}>
                  <h3 style={{ fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:10 }}>Mejoras propuestas</h3>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                    {leader.suggestions.map((s, i) => (
                      <div key={i} style={{ padding:10,background:"rgba(3,7,18,.4)",borderRadius:8,display:"flex",gap:8 }} className="sr">
                        <div style={{ width:20,height:20,borderRadius:5,background:"rgba(124,58,237,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#A855F7",flexShrink:0 }}>+</div>
                        <div>
                          <div style={{ fontSize:10,color:"#E2E8F0",fontWeight:600,lineHeight:1.3 }}>{s.action}</div>
                          <div style={{ fontSize:8,color:"#334155",marginTop:2 }}>→ {s.to} — {s.priority}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* LOGS                                    */}
          {/* ═══════════════════════════════════════ */}
          {section === "logs" && (
            <div className="au">
              <div className="card" style={{ padding:16 }}>
                <h3 style={{ fontSize:12,fontWeight:700,color:"#E2E8F0",marginBottom:12 }}>Historial de acciones</h3>
                {logs.length === 0 && <div style={{ padding:24,textAlign:"center",color:"#111827",fontSize:10 }}>Sin acciones ejecutadas en esta sesion</div>}
                {logs.map((l, i) => (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:i < logs.length - 1 ? "1px solid rgba(30,41,59,.15)" : "none" }} className="sr">
                    <div style={{ width:6,height:6,borderRadius:"50%",background:l.type === "err" ? "#EF4444" : "#10B981",flexShrink:0 }} />
                    <div style={{ flex:1,fontSize:11,color:"#CBD5E1" }}>{l.msg}</div>
                    <div style={{ fontSize:9,color:"#1E293B",fontFamily:"monospace" }}>{l.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop:32,paddingTop:12,borderTop:"1px solid rgba(30,41,59,.15)",display:"flex",justifyContent:"space-between",fontSize:8,color:"#0B1120" }}>
            <span>Kily&apos;s Agents — Oficina Virtual v4</span>
            <span>{agents.length} agentes — next refresh {countdown}s</span>
          </div>
        </div>
      </div>
    </>
  );
}
