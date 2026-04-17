// pages/api/hub.js
// ============================================================
// API CENTRAL — Estado, actividad, shopify, workflows, configs
// ============================================================

import { AGENTS, fetchAgent, fetchAllStatus, postAgent, leaderAnalyze } from "../../lib/agents";
import { getShopifyOverview } from "../../lib/shopify";
import { workflowLaunchProduct, workflowHealthCheck } from "../../lib/workflow";

export default async function handler(req, res) {
  const action = req.query.action;

  try {
    // ─── STATUS + LEADER ──────────────────────────────────
    if (action === "status") {
      const raw = await fetchAllStatus();
      const leader = leaderAnalyze(raw);

      const agents = {};
      for (const a of AGENTS) {
        const r = raw[a.id];
        agents[a.id] = {
          id: a.id, name: a.name, role: a.role, avatar: a.avatar, color: a.color, platform: a.platform, url: a.url,
          online: a.id === "leader" ? true : (r?.online || false),
          error: r?.error || null,
          state: a.id === "leader" ? leader.leaderStatus : r?.online ? "idle" : "offline",
          metrics: a.id === "dropshipping" ? {
            totalProducts: r?.data?.stats?.totalProducts || r?.data?.recentProducts?.length || 0,
            lastRun: r?.data?.lastRun?.completedAt || null,
            productsLastRun: r?.data?.lastRun?.productsFound || 0,
            isActive: r?.data?.config?.is_active ?? true,
          } : a.id === "landing" ? {
            total: r?.data?.total || 0, published: r?.data?.published || 0,
            drafts: r?.data?.drafts || 0, last24h: r?.data?.last24h || 0,
          } : a.id === "ads" ? {
            total: r?.data?.total || 0, active: r?.data?.active || 0, paused: r?.data?.paused || 0,
            weekSpend: r?.data?.weekSpend || "0", weekClicks: r?.data?.weekClicks || 0,
            weekConversions: r?.data?.weekConversions || 0, weekRoas: r?.data?.weekRoas || "0",
            metaConnected: r?.data?.metaConnected ?? false,
            supabaseConnected: r?.data?.supabaseConnected ?? false,
            telegramConnected: r?.data?.telegramConnected ?? false,
          } : a.id === "leader" ? {
            issues: leader.summary.totalIssues, critical: leader.summary.criticalIssues,
            suggestions: leader.summary.totalSuggestions,
          } : {},
        };
      }

      const onlineCount = Object.values(agents).filter(a => a.online).length - 1;
      return res.json({
        timestamp: new Date().toISOString(),
        systemHealth: onlineCount === 3 ? "operational" : onlineCount >= 2 ? "degraded" : "down",
        agents, leader,
      });
    }

    // ─── ACTIVITY ─────────────────────────────────────────
    if (action === "activity") {
      const activities = [];
      const [dropRes, landRes, adsRes] = await Promise.all([
        fetchAgent(AGENTS[0].url, AGENTS[0].endpoints.runs),
        fetchAgent(AGENTS[1].url, AGENTS[1].endpoints.list),
        fetchAgent(AGENTS[2].url, AGENTS[2].endpoints.list),
      ]);

      if (dropRes.ok) for (const run of (dropRes.data?.runs || dropRes.data || []).slice(0, 5))
        activities.push({ agent: "dropshipping", agentName: "Dropshipping", avatar: "D", type: "run", title: `Busqueda — ${run.productsFound || run.products_found || 0} productos`, timestamp: run.completedAt || run.completed_at || run.created_at, color: "#3B82F6" });

      if (landRes.ok) for (const lp of (landRes.data?.landings || landRes.data?.pages || []).slice(0, 5))
        activities.push({ agent: "landing", agentName: "Landing", avatar: "L", type: "landing", title: lp.product_name || lp.title || "Producto", subtitle: lp.status === "published" ? "Shopify" : "Borrador", timestamp: lp.created_at, color: "#10B981" });

      if (adsRes.ok) for (const c of (adsRes.data?.campaigns || []).slice(0, 5))
        activities.push({ agent: "ads", agentName: "Ads", avatar: "A", type: "campaign", title: c.product_name, subtitle: `${c.status} — ${c.country_code} — $${c.budget_daily_usd}/d`, timestamp: c.created_at, color: "#7C3AED" });

      activities.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      return res.json({ activities: activities.slice(0, 20) });
    }

    // ─── PIPELINE ─────────────────────────────────────────
    if (action === "pipeline") {
      const pipeline = { discovered: [], landing_created: [], campaign_active: [], converting: [] };
      const [prodRes, landRes, adsRes] = await Promise.all([
        fetchAgent(AGENTS[0].url, AGENTS[0].endpoints.products),
        fetchAgent(AGENTS[1].url, AGENTS[1].endpoints.list),
        fetchAgent(AGENTS[2].url, AGENTS[2].endpoints.list),
      ]);

      const products = (prodRes.ok ? (prodRes.data?.products || prodRes.data || []) : []).slice(0, 20);
      const landings = landRes.ok ? (landRes.data?.landings || landRes.data?.pages || []) : [];
      const campaigns = adsRes.ok ? (adsRes.data?.campaigns || []) : [];
      const landingNames = new Set(landings.map(l => (l.product_name || l.title || "").toLowerCase()));
      const campaignNames = new Set(campaigns.map(c => (c.product_name || "").toLowerCase()));

      for (const p of products) {
        const name = (p.product_name || p.name || "").toLowerCase();
        const item = { name: p.product_name || p.name, score: p.score || p.total_score || 0, source: p.source, country: p.country_code };
        if (campaignNames.has(name)) {
          const camp = campaigns.find(c => (c.product_name || "").toLowerCase() === name);
          if (camp?.status === "ACTIVE") pipeline.converting.push({ ...item, status: "ACTIVE", spend: camp.budget_daily_usd });
          else pipeline.campaign_active.push({ ...item, status: camp?.status || "PAUSED" });
        } else if (landingNames.has(name)) pipeline.landing_created.push(item);
        else pipeline.discovered.push(item);
      }
      return res.json({ pipeline });
    }

    // ─── SHOPIFY ──────────────────────────────────────────
    if (action === "shopify") {
      const data = await getShopifyOverview();
      return res.json(data);
    }

    // ─── ANALYTICS (from ads agent) ───────────────────────
    if (action === "analytics") {
      const r = await fetchAgent(AGENTS[2].url, AGENTS[2].endpoints.analytics);
      return res.json(r.ok ? r.data : { daily: [], totals: {} });
    }

    // ─── AGENT CONFIG (read) ──────────────────────────────
    if (action === "agent-config" && req.method === "GET") {
      const agentId = req.query.agent;
      const agent = AGENTS.find(a => a.id === agentId);
      if (!agent?.url) return res.status(404).json({ error: "Agente no encontrado" });

      const endpoint = agentId === "dropshipping" ? "/api/agent?action=status"
        : agentId === "landing" ? "/api/landing?action=status"
        : "/api/ads?action=config";
      const r = await fetchAgent(agent.url, endpoint);
      return res.json(r.ok ? r.data : { error: r.error });
    }

    // ─── HEALTH CHECK ─────────────────────────────────────
    if (action === "health-check") {
      const result = await workflowHealthCheck();
      return res.json(result);
    }

    // ─── POST ACTIONS ─────────────────────────────────────
    if (req.method === "POST") {
      if (action === "run-search") {
        const r = await postAgent(AGENTS[0].url, "/api/agent?action=run", {});
        return res.json({ ok: r.ok, agent: "dropshipping", result: r.data });
      }
      if (action === "run-landings") {
        const r = await postAgent(AGENTS[1].url, "/api/landing?action=auto-create", {});
        return res.json({ ok: r.ok, agent: "landing", result: r.data });
      }
      if (action === "run-monitor") {
        const r = await postAgent(AGENTS[2].url, "/api/ads?action=monitor", {});
        return res.json({ ok: r.ok, agent: "ads", result: r.data });
      }

      // Workflow: Lanzar producto (cadena completa)
      if (action === "workflow-launch") {
        const result = await workflowLaunchProduct(req.body || {});
        return res.json(result);
      }

      // Agent config update
      if (action === "agent-config") {
        const { agent: agentId, config } = req.body;
        const agent = AGENTS.find(a => a.id === agentId);
        if (!agent?.url) return res.status(404).json({ error: "Agente no encontrado" });
        const endpoint = agentId === "dropshipping" ? "/api/agent?action=config"
          : agentId === "ads" ? "/api/ads?action=config" : null;
        if (!endpoint) return res.status(400).json({ error: "Config no soportado para este agente" });
        const r = await postAgent(agent.url, endpoint, config);
        return res.json({ ok: r.ok, result: r.data });
      }
    }

    return res.status(400).json({ error: `Accion no valida: ${action}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
