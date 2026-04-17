import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── MAIN ───────────────────────────────────────────────────
export default function Hub() {
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [tab, setTab] = useState("office");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

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

  async function runAction(action, label) {
    setActionLoading(action);
    try {
      const r = await fetch(`/api/hub?action=${action}`, { method: "POST" }).then(r => r.json());
      show(r.ok ? `${label} ejecutado` : (r.error || "Error"), r.ok ? "ok" : "err");
      if (r.ok) setTimeout(load, 3000);
    } catch { show("Error de red", "err"); }
    setActionLoading(null);
  }

  const agents = data?.agents || {};
  const leader = data?.leader || {};
  const agentList = Object.values(agents);
  const healthColors = { operational: "#10B981", degraded: "#F59E0B", down: "#EF4444" };

  const stateConfig = {
    idle: { label: "En espera", color: "#64748B", pulse: false },
    working: { label: "Trabajando", color: "#3B82F6", pulse: true },
    alert: { label: "Alerta", color: "#F59E0B", pulse: true },
    offline: { label: "Desconectado", color: "#EF4444", pulse: false },
    error: { label: "Error", color: "#EF4444", pulse: true },
  };

  return (
    <>
      <Head><title>Oficina Virtual — Kily&apos;s Agents</title></Head>
      <style dangerouslySetInnerHTML={{ __html: `
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#060A13;color:#CBD5E1;font-family:'Inter',-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
        ::selection{background:#7C3AED;color:#fff}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes glow{0%,100%{box-shadow:0 0 12px rgba(124,58,237,.3)}50%{box-shadow:0 0 28px rgba(124,58,237,.7)}}
        @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        .au{animation:fadeUp .4s ease both}
        .card{background:#0F172A;border-radius:16px;border:1px solid #1E293B;transition:border-color .2s}
        .card:hover{border-color:#334155}
        .btn{padding:8px 16px;border-radius:10px;border:1px solid #334155;background:transparent;color:#CBD5E1;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
        .btn:hover{border-color:#7C3AED;color:#A855F7}
        .btn:disabled{opacity:.4;cursor:wait}
        .btn-primary{background:linear-gradient(135deg,#7C3AED,#9333EA);border:none;color:#fff;box-shadow:0 4px 20px rgba(124,58,237,.25)}
        .btn-primary:hover{transform:translateY(-1px)}
        .tab-btn{padding:8px 14px;border-radius:8px;border:none;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1E293B;border-radius:2px}
      `}} />

      {toast && (
        <div style={{ position:"fixed",top:20,right:20,zIndex:9999,padding:"12px 20px",borderRadius:12,background:toast.type==="err"?"#7F1D1D":"#064E3B",color:"#fff",fontSize:12,fontWeight:600,boxShadow:"0 12px 40px rgba(0,0,0,.5)",borderLeft:`4px solid ${toast.type==="err"?"#EF4444":"#10B981"}`,maxWidth:360,animation:"slideIn .3s ease" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth:1280,margin:"0 auto",padding:"20px 16px",minHeight:"100vh" }}>

        {/* ─── HEADER ──────────────────────────── */}
        <div className="au" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28,paddingBottom:20,borderBottom:"1px solid #1E293B" }}>
          <div style={{ display:"flex",alignItems:"center",gap:14 }}>
            <div style={{ width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#7C3AED,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#fff",animation:"glow 3s infinite" }}>K</div>
            <div>
              <h1 style={{ fontSize:22,fontWeight:900,color:"#F1F5F9" }}>Oficina Virtual</h1>
              <p style={{ fontSize:11,color:"#475569",marginTop:2 }}>Kily&apos;s Agents — {agentList.filter(a=>a.online).length} agentes conectados</p>
            </div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            {data && (
              <div style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,background:`${healthColors[data.systemHealth]}12`,fontSize:11,fontWeight:700,color:healthColors[data.systemHealth] }}>
                <span style={{ width:7,height:7,borderRadius:"50%",background:healthColors[data.systemHealth] }} />
                {data.systemHealth === "operational" ? "Operativo" : data.systemHealth === "degraded" ? "Degradado" : "Caido"}
              </div>
            )}
            <button className="btn" onClick={load} disabled={loading}>{loading ? "..." : "Actualizar"}</button>
          </div>
        </div>

        {/* ─── TABS ────────────────────────────── */}
        <div style={{ display:"flex",gap:4,marginBottom:24,background:"#0B1120",borderRadius:10,padding:3 }}>
          {[
            { k:"office", l:"Oficina" },
            { k:"pipeline", l:"Pipeline" },
            { k:"leader", l:"Leader" },
          ].map(t => (
            <button key={t.k} className="tab-btn" onClick={() => setTab(t.k)} style={{
              flex:1, background: tab===t.k ? "rgba(124,58,237,.15)" : "transparent",
              color: tab===t.k ? "#A855F7" : "#475569",
            }}>{t.l}</button>
          ))}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* TAB: OFICINA                            */}
        {/* ═══════════════════════════════════════ */}
        {tab === "office" && (
          <div className="au">
            {/* Agent cards */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24 }}>
              {agentList.map((a, i) => {
                const sc = stateConfig[a.state] || stateConfig.idle;
                return (
                  <div key={a.id} className="card" style={{ padding:20, borderTop:`3px solid ${a.online ? a.color : "#1E293B"}`, animation:`fadeUp .4s ease ${i*0.08}s both` }}>
                    {/* Avatar + status */}
                    <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
                      <div style={{ position:"relative" }}>
                        <div style={{ width:44,height:44,borderRadius:12,background:a.online ? `${a.color}20` : "#1E293B",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:a.online ? a.color : "#334155",transition:"all .3s",
                          ...(sc.pulse ? { animation:"breathe 2s ease infinite" } : {}),
                        }}>{a.avatar}</div>
                        <div style={{ position:"absolute",bottom:-2,right:-2,width:12,height:12,borderRadius:"50%",background:sc.color,border:"2px solid #0F172A",
                          ...(sc.pulse ? { animation:"pulse 1.5s infinite" } : {}),
                        }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13,fontWeight:700,color:"#F1F5F9" }}>{a.name}</div>
                        <div style={{ fontSize:10,color:"#475569" }}>{a.role}</div>
                      </div>
                    </div>
                    {/* Estado */}
                    <div style={{ padding:"6px 10px",borderRadius:8,background:`${sc.color}10`,fontSize:10,fontWeight:700,color:sc.color,textAlign:"center",marginBottom:10,textTransform:"uppercase",letterSpacing:".05em" }}>
                      {sc.label}
                    </div>
                    {/* Métricas */}
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:10 }}>
                      {a.id === "dropshipping" && <>
                        <div style={{ padding:"8px",background:"#0B1120",borderRadius:8 }}><div style={{ color:"#475569" }}>Productos</div><div style={{ fontSize:16,fontWeight:800,color:"#F1F5F9" }}>{a.metrics?.totalProducts || 0}</div></div>
                        <div style={{ padding:"8px",background:"#0B1120",borderRadius:8 }}><div style={{ color:"#475569" }}>Ultima</div><div style={{ fontSize:12,fontWeight:700,color:"#3B82F6" }}>{timeAgo(a.metrics?.lastRun)}</div></div>
                      </>}
                      {a.id === "landing" && <>
                        <div style={{ padding:"8px",background:"#0B1120",borderRadius:8 }}><div style={{ color:"#475569" }}>Publicadas</div><div style={{ fontSize:16,fontWeight:800,color:"#F1F5F9" }}>{a.metrics?.published || 0}</div></div>
                        <div style={{ padding:"8px",background:"#0B1120",borderRadius:8 }}><div style={{ color:"#475569" }}>24h</div><div style={{ fontSize:16,fontWeight:800,color:"#10B981" }}>{a.metrics?.last24h || 0}</div></div>
                      </>}
                      {a.id === "ads" && <>
                        <div style={{ padding:"8px",background:"#0B1120",borderRadius:8 }}><div style={{ color:"#475569" }}>Activas</div><div style={{ fontSize:16,fontWeight:800,color:"#10B981" }}>{a.metrics?.active || 0}</div></div>
                        <div style={{ padding:"8px",background:"#0B1120",borderRadius:8 }}><div style={{ color:"#475569" }}>ROAS</div><div style={{ fontSize:16,fontWeight:800,color:"#7C3AED" }}>{a.metrics?.weekRoas || 0}x</div></div>
                      </>}
                      {a.id === "leader" && <>
                        <div style={{ padding:"8px",background:"#0B1120",borderRadius:8 }}><div style={{ color:"#475569" }}>Problemas</div><div style={{ fontSize:16,fontWeight:800,color:a.metrics?.critical > 0 ? "#EF4444" : "#F1F5F9" }}>{a.metrics?.issues || 0}</div></div>
                        <div style={{ padding:"8px",background:"#0B1120",borderRadius:8 }}><div style={{ color:"#475569" }}>Mejoras</div><div style={{ fontSize:16,fontWeight:800,color:"#F59E0B" }}>{a.metrics?.suggestions || 0}</div></div>
                      </>}
                    </div>
                    {/* Link */}
                    {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ display:"block",marginTop:10,fontSize:10,color:"#334155",textDecoration:"none",textAlign:"center" }}>Abrir dashboard →</a>}
                  </div>
                );
              })}
            </div>

            {/* Two columns: Activity + Leader interactions */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>

              {/* Activity feed */}
              <div className="card" style={{ padding:20 }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
                  <h3 style={{ fontSize:14,fontWeight:700,color:"#F1F5F9" }}>Actividad reciente</h3>
                  <span style={{ fontSize:10,color:"#334155" }}>{activity.length} eventos</span>
                </div>
                <div style={{ maxHeight:360,overflowY:"auto",display:"flex",flexDirection:"column",gap:0 }}>
                  {activity.length === 0 && <div style={{ padding:24,textAlign:"center",color:"#334155",fontSize:12 }}>Sin actividad</div>}
                  {activity.map((a, i) => (
                    <div key={i} style={{ display:"flex",gap:10,padding:"10px 0",borderBottom:i<activity.length-1?"1px solid #1E293B08":"none",animation:`slideIn .3s ease ${i*0.05}s both` }}>
                      <div style={{ width:28,height:28,borderRadius:8,background:`${a.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:a.color,flexShrink:0 }}>{a.avatar}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12,color:"#F1F5F9",fontWeight:600 }}>{a.title}</div>
                        {a.subtitle && <div style={{ fontSize:10,color:"#475569",marginTop:1 }}>{a.subtitle}</div>}
                      </div>
                      <div style={{ fontSize:9,color:"#334155",flexShrink:0 }}>{timeAgo(a.timestamp)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leader interactions (chat bubbles) */}
              <div className="card" style={{ padding:20 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14 }}>
                  <div style={{ width:24,height:24,borderRadius:6,background:"rgba(245,158,11,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#F59E0B" }}>K</div>
                  <h3 style={{ fontSize:14,fontWeight:700,color:"#F1F5F9" }}>Leader Agent</h3>
                  {leader.leaderStatus && <div style={{ fontSize:9,padding:"2px 8px",borderRadius:10,background:leader.leaderStatus==="working"?"rgba(245,158,11,.1)":"rgba(239,68,68,.1)",color:leader.leaderStatus==="working"?"#F59E0B":"#EF4444",fontWeight:700 }}>{leader.leaderStatus === "working" ? "SUPERVISANDO" : "ALERTA"}</div>}
                </div>

                {/* Leader message */}
                {leader.leaderMessage && (
                  <div style={{ padding:12,background:"#0B1120",borderRadius:"4px 12px 12px 12px",marginBottom:12,borderLeft:"3px solid #F59E0B" }}>
                    <div style={{ fontSize:12,color:"#F1F5F9",lineHeight:1.5 }}>{leader.leaderMessage}</div>
                  </div>
                )}

                {/* Interactions as chat bubbles */}
                <div style={{ maxHeight:240,overflowY:"auto",display:"flex",flexDirection:"column",gap:8 }}>
                  {(leader.interactions || []).map((int, i) => {
                    const toAgent = agentList.find(a => a.id === int.to);
                    const colors = { suggestion: "#7C3AED", nudge: "#F59E0B", feedback: "#10B981" };
                    return (
                      <div key={i} style={{ animation:`slideIn .3s ease ${i*0.08}s both` }}>
                        <div style={{ fontSize:9,color:"#475569",marginBottom:3,display:"flex",alignItems:"center",gap:4 }}>
                          <span style={{ fontWeight:700,color:"#F59E0B" }}>Leader</span> → <span style={{ fontWeight:700,color:toAgent?.color || "#94A3B8" }}>{toAgent?.name || int.to}</span>
                          <span style={{ padding:"1px 6px",borderRadius:6,background:`${colors[int.type] || "#475569"}15`,color:colors[int.type] || "#475569",fontSize:8,fontWeight:700 }}>{int.type}</span>
                        </div>
                        <div style={{ padding:"10px 12px",background:"#0B1120",borderRadius:"4px 12px 12px 12px",fontSize:12,color:"#CBD5E1",lineHeight:1.4 }}>
                          {int.message}
                        </div>
                      </div>
                    );
                  })}
                  {(!leader.interactions || leader.interactions.length === 0) && (
                    <div style={{ padding:20,textAlign:"center",color:"#334155",fontSize:11 }}>Sin interacciones — todo en orden</div>
                  )}
                </div>

                {/* Control buttons */}
                <div style={{ display:"flex",gap:8,marginTop:14,paddingTop:14,borderTop:"1px solid #1E293B" }}>
                  <button className="btn" onClick={() => runAction("run-search","Busqueda")} disabled={!!actionLoading} style={{ flex:1,fontSize:10,padding:"8px 6px",borderColor:"#3B82F630",color:"#3B82F6" }}>
                    {actionLoading === "run-search" ? "..." : "Buscar productos"}
                  </button>
                  <button className="btn" onClick={() => runAction("run-landings","Landings")} disabled={!!actionLoading} style={{ flex:1,fontSize:10,padding:"8px 6px",borderColor:"#10B98130",color:"#10B981" }}>
                    {actionLoading === "run-landings" ? "..." : "Crear landings"}
                  </button>
                  <button className="btn" onClick={() => runAction("run-monitor","Monitoreo")} disabled={!!actionLoading} style={{ flex:1,fontSize:10,padding:"8px 6px",borderColor:"#7C3AED30",color:"#7C3AED" }}>
                    {actionLoading === "run-monitor" ? "..." : "Monitorear ads"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* TAB: PIPELINE                           */}
        {/* ═══════════════════════════════════════ */}
        {tab === "pipeline" && (
          <div className="au">
            <h2 style={{ fontSize:18,fontWeight:700,color:"#F1F5F9",marginBottom:20 }}>Pipeline de productos</h2>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14 }}>
              {[
                { key:"discovered", label:"Descubiertos", color:"#3B82F6", icon:"D" },
                { key:"landing_created", label:"Con Landing", color:"#10B981", icon:"L" },
                { key:"campaign_active", label:"Con Campana", color:"#7C3AED", icon:"A" },
                { key:"converting", label:"Convirtiendo", color:"#F59E0B", icon:"$" },
              ].map(col => (
                <div key={col.key}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"10px 14px",background:`${col.color}10`,borderRadius:10,borderTop:`3px solid ${col.color}` }}>
                    <div style={{ width:24,height:24,borderRadius:6,background:col.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff" }}>{col.icon}</div>
                    <div>
                      <div style={{ fontSize:12,fontWeight:700,color:"#F1F5F9" }}>{col.label}</div>
                      <div style={{ fontSize:10,color:"#475569" }}>{(pipeline?.[col.key] || []).length} productos</div>
                    </div>
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:8,minHeight:200 }}>
                    {(pipeline?.[col.key] || []).map((item, i) => (
                      <div key={i} className="card" style={{ padding:12,borderLeft:`3px solid ${col.color}`,animation:`fadeUp .3s ease ${i*0.05}s both` }}>
                        <div style={{ fontSize:12,fontWeight:700,color:"#F1F5F9",marginBottom:4 }}>{item.name}</div>
                        <div style={{ display:"flex",gap:8,fontSize:10,color:"#475569" }}>
                          {item.score > 0 && <span>Score: <b style={{ color:item.score >= 8 ? "#10B981" : "#F59E0B" }}>{item.score}</b></span>}
                          {item.status && <span style={{ color:item.status === "ACTIVE" ? "#10B981" : "#64748B" }}>{item.status}</span>}
                          {item.spend && <span>${item.spend}/d</span>}
                        </div>
                      </div>
                    ))}
                    {(pipeline?.[col.key] || []).length === 0 && (
                      <div style={{ padding:20,textAlign:"center",color:"#1E293B",fontSize:11,border:"1px dashed #1E293B",borderRadius:10 }}>Vacio</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* TAB: LEADER                             */}
        {/* ═══════════════════════════════════════ */}
        {tab === "leader" && (
          <div className="au">
            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:24 }}>
              <div style={{ width:48,height:48,borderRadius:14,background:"rgba(245,158,11,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:900,color:"#F59E0B",animation:"breathe 3s ease infinite" }}>K</div>
              <div>
                <h2 style={{ fontSize:20,fontWeight:800,color:"#F1F5F9" }}>Leader Agent — Supervision</h2>
                <p style={{ fontSize:12,color:"#475569",marginTop:2 }}>{leader.leaderMessage || "Analizando..."}</p>
              </div>
            </div>

            {/* Issues */}
            {leader.issues?.length > 0 && (
              <div className="card" style={{ padding:20,marginBottom:16 }}>
                <h3 style={{ fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:14 }}>Problemas detectados ({leader.issues.length})</h3>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {leader.issues.map((issue, i) => {
                    const sevColors = { critical:"#EF4444", high:"#F59E0B", medium:"#3B82F6" };
                    return (
                      <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:10,padding:12,background:"#0B1120",borderRadius:10,borderLeft:`3px solid ${sevColors[issue.severity] || "#64748B"}`,animation:`slideIn .3s ease ${i*0.06}s both` }}>
                        <span style={{ fontSize:9,fontWeight:700,color:sevColors[issue.severity],textTransform:"uppercase",padding:"2px 6px",borderRadius:4,background:`${sevColors[issue.severity]}15`,flexShrink:0 }}>{issue.severity}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12,color:"#F1F5F9",fontWeight:600 }}>{issue.message}</div>
                          <div style={{ fontSize:10,color:"#475569",marginTop:2 }}>Agente: {issue.agent}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {leader.suggestions?.length > 0 && (
              <div className="card" style={{ padding:20,marginBottom:16 }}>
                <h3 style={{ fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:14 }}>Mejoras propuestas ({leader.suggestions.length})</h3>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {leader.suggestions.map((s, i) => (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:12,background:"#0B1120",borderRadius:10,animation:`slideIn .3s ease ${i*0.06}s both` }}>
                      <div style={{ width:28,height:28,borderRadius:8,background:"rgba(124,58,237,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#A855F7" }}>+</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12,color:"#F1F5F9",fontWeight:600 }}>{s.action}</div>
                        <div style={{ fontSize:10,color:"#475569",marginTop:2 }}>Leader → {s.to} — Prioridad: {s.priority}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactions detail */}
            {leader.interactions?.length > 0 && (
              <div className="card" style={{ padding:20 }}>
                <h3 style={{ fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:14 }}>Conversaciones entre agentes</h3>
                <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                  {leader.interactions.map((int, i) => {
                    const toAgent = agentList.find(a => a.id === int.to);
                    return (
                      <div key={i} style={{ animation:`slideIn .3s ease ${i*0.08}s both` }}>
                        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                          <div style={{ width:20,height:20,borderRadius:5,background:"rgba(245,158,11,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#F59E0B" }}>K</div>
                          <span style={{ fontSize:10,color:"#475569" }}>Leader dice a</span>
                          <div style={{ width:20,height:20,borderRadius:5,background:`${toAgent?.color || "#64748B"}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:toAgent?.color || "#64748B" }}>{toAgent?.avatar || "?"}</div>
                          <span style={{ fontSize:10,fontWeight:700,color:toAgent?.color || "#94A3B8" }}>{toAgent?.name || int.to}</span>
                        </div>
                        <div style={{ marginLeft:26,padding:"10px 14px",background:"#0B1120",borderRadius:"4px 14px 14px 14px",fontSize:12,color:"#CBD5E1",lineHeight:1.5 }}>
                          {int.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!leader.issues?.length && !leader.suggestions?.length && (
              <div className="card" style={{ padding:48,textAlign:"center" }}>
                <div style={{ fontSize:32,marginBottom:12,color:"#10B981" }}>OK</div>
                <div style={{ fontSize:16,fontWeight:700,color:"#F1F5F9" }}>Todo en orden</div>
                <div style={{ fontSize:12,color:"#475569",marginTop:4 }}>El Leader no detecto problemas ni tiene sugerencias</div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop:40,paddingTop:16,borderTop:"1px solid #1E293B",display:"flex",justifyContent:"space-between",fontSize:10,color:"#1E293B" }}>
          <span>Kily&apos;s Agents — Oficina Virtual v2</span>
          <span>{agentList.length} agentes</span>
        </div>
      </div>
    </>
  );
}
