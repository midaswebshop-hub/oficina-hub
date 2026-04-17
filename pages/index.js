import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

// ─── HELPERS ────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

function formatUSD(v) {
  if (!v && v !== 0) return "$0";
  return "$" + parseFloat(v).toFixed(2);
}

// ─── MINI CHARTS ────────────────────────────────────────────
function Sparkline({ data, color, width = 120, height = 32 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 0.01);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 4 - ((v - min) / range) * (height - 8)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────
export default function Hub() {
  const [status, setStatus] = useState(null);
  const [activity, setActivity] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, a, an] = await Promise.all([
      fetch("/api/hub?action=status").then(r => r.json()).catch(() => null),
      fetch("/api/hub?action=activity").then(r => r.json()).catch(() => ({ activities: [] })),
      fetch("/api/hub?action=analytics").then(r => r.json()).catch(() => null),
    ]);
    if (s) setStatus(s);
    setActivity(a?.activities || []);
    if (an) setAnalytics(an);
    setLastRefresh(new Date().toLocaleTimeString("es-CO"));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const agents = status?.agents || {};
  const healthColors = { operational: "#10B981", degraded: "#F59E0B", down: "#EF4444" };
  const healthLabels = { operational: "Operativo", degraded: "Degradado", down: "Caido" };

  return (
    <>
      <Head><title>Oficina Virtual — Kily&apos;s Agents</title></Head>
      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
        body { background: #060A13; color: #CBD5E1; font-family: 'Inter', -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased }
        ::selection { background: #7C3AED; color: #fff }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 8px rgba(124,58,237,.3) } 50% { box-shadow: 0 0 20px rgba(124,58,237,.6) } }
        .au { animation: fadeUp .4s ease both }
        .au-1 { animation-delay: .06s } .au-2 { animation-delay: .12s } .au-3 { animation-delay: .18s } .au-4 { animation-delay: .24s }
        .card { background: #0F172A; border-radius: 16px; border: 1px solid #1E293B; transition: border-color .2s }
        .card:hover { border-color: #334155 }
        .btn { padding: 10px 20px; border-radius: 10px; border: 1px solid #334155; background: transparent; color: #CBD5E1; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .2s }
        .btn:hover { border-color: #7C3AED; color: #A855F7 }
        .btn-primary { background: linear-gradient(135deg, #7C3AED, #9333EA); border: none; color: #fff; box-shadow: 0 4px 20px rgba(124,58,237,.25) }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(124,58,237,.35) }
        ::-webkit-scrollbar { width: 5px } ::-webkit-scrollbar-track { background: transparent } ::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 3px }
      `}} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px", minHeight: "100vh" }}>

        {/* ─── HEADER ──────────────────────────────── */}
        <div className="au" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, paddingBottom: 20, borderBottom: "1px solid #1E293B" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", boxShadow: "0 4px 24px rgba(124,58,237,.4)", animation: "glow 3s infinite" }}>K</div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: "#F1F5F9", lineHeight: 1.1 }}>
                Oficina Virtual
              </h1>
              <p style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>Kily&apos;s Agents — Centro de comando</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {status && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: `${healthColors[status.systemHealth]}15`, fontSize: 12, fontWeight: 700, color: healthColors[status.systemHealth] }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: healthColors[status.systemHealth], display: "inline-block" }} />
                {healthLabels[status.systemHealth] || "—"}
              </div>
            )}
            <button className="btn" onClick={load} disabled={loading} style={loading ? { opacity: 0.5 } : {}}>
              {loading ? "Cargando..." : "Actualizar"}
            </button>
            {lastRefresh && <span style={{ fontSize: 10, color: "#334155" }}>{lastRefresh}</span>}
          </div>
        </div>

        {/* ─── AGENT CARDS ─────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          {/* Dropshipping Agent */}
          <div className="card au au-1" style={{ padding: 24, borderTop: `3px solid ${agents.dropshipping?.online ? "#3B82F6" : "#334155"}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: agents.dropshipping?.online ? "rgba(59,130,246,.15)" : "rgba(100,116,139,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: agents.dropshipping?.online ? "#3B82F6" : "#64748B" }}>D</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>Dropshipping</div>
                  <div style={{ fontSize: 10, color: "#475569" }}>Render</div>
                </div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: agents.dropshipping?.online ? "#10B981" : "#EF4444", boxShadow: agents.dropshipping?.online ? "0 0 8px rgba(16,185,129,.5)" : "0 0 8px rgba(239,68,68,.5)" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ padding: "10px 12px", background: "#0B1120", borderRadius: 10 }}>
                <div style={{ fontSize: 9, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Productos</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9" }}>{agents.dropshipping?.totalProducts || 0}</div>
              </div>
              <div style={{ padding: "10px 12px", background: "#0B1120", borderRadius: 10 }}>
                <div style={{ fontSize: 9, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Ultima busqueda</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#3B82F6" }}>{timeAgo(agents.dropshipping?.lastRun)}</div>
              </div>
            </div>
            <a href="https://dropshipping-agent-zkn1.onrender.com" target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, fontSize: 11, color: "#475569", textDecoration: "none", textAlign: "center" }}>Abrir dashboard →</a>
          </div>

          {/* Landing Agent */}
          <div className="card au au-2" style={{ padding: 24, borderTop: `3px solid ${agents.landing?.online ? "#10B981" : "#334155"}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: agents.landing?.online ? "rgba(16,185,129,.15)" : "rgba(100,116,139,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: agents.landing?.online ? "#10B981" : "#64748B" }}>L</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>Landing Pages</div>
                  <div style={{ fontSize: 10, color: "#475569" }}>Render</div>
                </div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: agents.landing?.online ? "#10B981" : "#EF4444", boxShadow: agents.landing?.online ? "0 0 8px rgba(16,185,129,.5)" : "0 0 8px rgba(239,68,68,.5)" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ padding: "10px 12px", background: "#0B1120", borderRadius: 10 }}>
                <div style={{ fontSize: 9, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Publicadas</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9" }}>{agents.landing?.published || 0}</div>
              </div>
              <div style={{ padding: "10px 12px", background: "#0B1120", borderRadius: 10 }}>
                <div style={{ fontSize: 9, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Ultimas 24h</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#10B981" }}>{agents.landing?.last24h || 0}</div>
              </div>
            </div>
            <a href="https://landing-page-agent-m2z7.onrender.com" target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, fontSize: 11, color: "#475569", textDecoration: "none", textAlign: "center" }}>Abrir dashboard →</a>
          </div>

          {/* Ads Agent */}
          <div className="card au au-3" style={{ padding: 24, borderTop: `3px solid ${agents.ads?.online ? "#7C3AED" : "#334155"}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: agents.ads?.online ? "rgba(124,58,237,.15)" : "rgba(100,116,139,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: agents.ads?.online ? "#7C3AED" : "#64748B" }}>A</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>Ads Agent PRO</div>
                  <div style={{ fontSize: 10, color: "#475569" }}>Vercel</div>
                </div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: agents.ads?.online ? "#10B981" : "#EF4444", boxShadow: agents.ads?.online ? "0 0 8px rgba(16,185,129,.5)" : "0 0 8px rgba(239,68,68,.5)" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ padding: "10px 8px", background: "#0B1120", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#64748B", fontWeight: 600 }}>Activas</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#10B981" }}>{agents.ads?.active || 0}</div>
              </div>
              <div style={{ padding: "10px 8px", background: "#0B1120", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#64748B", fontWeight: 600 }}>Pausadas</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#F59E0B" }}>{agents.ads?.paused || 0}</div>
              </div>
              <div style={{ padding: "10px 8px", background: "#0B1120", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#64748B", fontWeight: 600 }}>Gasto 7d</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#EF4444" }}>{formatUSD(agents.ads?.weekSpend)}</div>
              </div>
            </div>
            <a href="https://ads-agent-nine.vercel.app" target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, fontSize: 11, color: "#475569", textDecoration: "none", textAlign: "center" }}>Abrir dashboard →</a>
          </div>
        </div>

        {/* ─── KPI BAR ─────────────────────────────── */}
        <div className="card au au-2" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0, padding: 0, marginBottom: 28, overflow: "hidden" }}>
          {[
            { label: "Productos", value: agents.dropshipping?.totalProducts || 0, color: "#3B82F6" },
            { label: "Landings", value: agents.landing?.published || 0, color: "#10B981" },
            { label: "Campanas", value: agents.ads?.total || 0, color: "#7C3AED" },
            { label: "Conversiones 7d", value: agents.ads?.weekConversions || 0, color: "#F59E0B" },
            { label: "ROAS", value: `${agents.ads?.weekRoas || 0}x`, color: "#EF4444" },
          ].map((kpi, i) => (
            <div key={i} style={{ padding: "18px 16px", textAlign: "center", borderRight: i < 4 ? "1px solid #1E293B" : "none" }}>
              <div style={{ fontSize: 9, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{kpi.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* ─── TWO COLUMNS: ACTIVITY + PIPELINE ────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>

          {/* Actividad reciente */}
          <div className="card au au-3" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>Actividad reciente</h3>
            {activity.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#334155", fontSize: 13 }}>
                {loading ? "Cargando actividad..." : "Sin actividad reciente"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {activity.map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: i < activity.length - 1 ? "1px solid #1E293B0a" : "none" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#F1F5F9", fontWeight: 600 }}>{a.title}</div>
                      {a.subtitle && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{a.subtitle}</div>}
                    </div>
                    <div style={{ fontSize: 10, color: "#334155", flexShrink: 0 }}>{timeAgo(a.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline / Flujo */}
          <div className="card au au-4" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>Flujo de produccion</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { step: 1, agent: "Dropshipping", action: "Busca productos", metric: `${agents.dropshipping?.totalProducts || 0} encontrados`, online: agents.dropshipping?.online, color: "#3B82F6" },
                { step: 2, agent: "Landing Agent", action: "Crea paginas + Shopify", metric: `${agents.landing?.published || 0} publicadas`, online: agents.landing?.online, color: "#10B981" },
                { step: 3, agent: "Ads Agent", action: "Campanas Meta Ads", metric: `${agents.ads?.active || 0} activas`, online: agents.ads?.online, color: "#7C3AED" },
                { step: 4, agent: "Optimizador", action: "Pausa/escala automatico", metric: `ROAS: ${agents.ads?.weekRoas || 0}x`, online: agents.ads?.online, color: "#F59E0B" },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: s.online ? `${s.color}20` : "#1E293B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: s.online ? s.color : "#475569", flexShrink: 0 }}>{s.step}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>{s.agent}</span>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.online ? "#10B981" : "#EF4444" }} />
                      </div>
                      <div style={{ fontSize: 11, color: "#475569" }}>{s.action}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.metric}</div>
                  </div>
                  {i < 3 && (
                    <div style={{ marginLeft: 15, width: 2, height: 20, background: s.online ? "#1E293B" : "#1E293B50", borderRadius: 1 }} />
                  )}
                </div>
              ))}
            </div>

            {/* Conexiones */}
            <div style={{ marginTop: 16, padding: 14, background: "#0B1120", borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Conexiones del Ads Agent</div>
              <div style={{ display: "flex", gap: 16 }}>
                {[
                  { label: "Meta", ok: agents.ads?.metaConnected },
                  { label: "Supabase", ok: agents.ads?.supabaseConnected },
                  { label: "Telegram", ok: agents.ads?.telegramConnected },
                ].map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: c.ok ? "#10B981" : "#EF4444", fontWeight: 600 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.ok ? "#10B981" : "#EF4444" }} />
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── ADS ANALYTICS ───────────────────────── */}
        {analytics?.daily && analytics.daily.length > 0 && (
          <div className="card au" style={{ padding: 24, marginBottom: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>Analytics de Ads (7 dias)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Gasto", value: formatUSD(analytics.totals?.spend), data: analytics.daily.map(d => d.spend), color: "#EF4444" },
                { label: "Clics", value: analytics.totals?.clicks || 0, data: analytics.daily.map(d => d.clicks), color: "#3B82F6" },
                { label: "Conversiones", value: analytics.totals?.conversions || 0, data: analytics.daily.map(d => d.conversions), color: "#10B981" },
                { label: "CPC", value: formatUSD(analytics.totals?.cpc), data: analytics.daily.map(d => d.cpc), color: "#F59E0B" },
              ].map((m, i) => (
                <div key={i} style={{ padding: 14, background: "#0B1120", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#F1F5F9", marginBottom: 8 }}>{m.value}</div>
                  <Sparkline data={m.data} color={m.color} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── QUICK ACTIONS ───────────────────────── */}
        <div className="card au" style={{ padding: 24, marginBottom: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>Acciones rapidas</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Buscar productos", href: "https://dropshipping-agent-zkn1.onrender.com", color: "#3B82F6" },
              { label: "Crear landing", href: "https://landing-page-agent-m2z7.onrender.com", color: "#10B981" },
              { label: "Autopilot Ads", href: "https://ads-agent-nine.vercel.app", color: "#7C3AED" },
              { label: "Shopify Admin", href: "https://admin.shopify.com/store/hy1jn3-vn", color: "#96BF48" },
            ].map((a, i) => (
              <a key={i} href={a.href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 12px", background: `${a.color}10`, borderRadius: 10, border: `1px solid ${a.color}30`, textDecoration: "none", color: a.color, fontSize: 13, fontWeight: 700, transition: "all .2s" }}>
                {a.label}
              </a>
            ))}
          </div>
        </div>

        {/* ─── FOOTER ──────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 20, borderTop: "1px solid #1E293B", fontSize: 11, color: "#1E293B" }}>
          <span>Kily&apos;s Agents — Oficina Virtual v1</span>
          <span>4 agentes conectados</span>
        </div>
      </div>
    </>
  );
}
