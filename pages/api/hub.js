// pages/api/hub.js — API CENTRAL v7 (Leader AI)
import { AGENTS, fetchAgent, fetchAllStatus, postAgent, leaderAnalyze, getCampaigns, toggleCampaign, getCampaignMetrics } from "../../lib/agents";
import { getShopifyOverview } from "../../lib/shopify";
import { workflowLaunchProduct, workflowHealthCheck } from "../../lib/workflow";
import { analyzeAgent, generateLeaderReport, suggestImprovements, leaderChat } from "../../lib/leader_ai";
import { processNewCODOrder, confirmOrder, cancelOrder, listPendingConfirmations } from "../../lib/cod_confirmer";

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    // STATUS + LEADER
    if (action === "status") {
      const [raw, shopData] = await Promise.all([fetchAllStatus(), getShopifyOverview().catch(() => null)]);
      const leader = leaderAnalyze(raw, shopData);
      const agents = {};
      for (const a of AGENTS) {
        const r = raw[a.id];
        agents[a.id] = {
          id:a.id, name:a.name, role:a.role, avatar:a.avatar, color:a.color, platform:a.platform, url:a.url,
          online: a.id === "leader" ? true : (r?.online || false), error: r?.error || null,
          state: a.id === "leader" ? leader.leaderStatus : r?.online ? "idle" : "offline",
          metrics: a.id === "dropshipping" ? { totalProducts: r?.data?.stats?.totalProducts || r?.data?.recentProducts?.length || 0, lastRun: r?.data?.lastRun?.completedAt || null, productsLastRun: r?.data?.lastRun?.productsFound || 0, isActive: r?.data?.config?.is_active ?? true }
            : a.id === "landing" ? { total: r?.data?.total || 0, published: r?.data?.published || 0, drafts: r?.data?.drafts || 0, last24h: r?.data?.last24h || 0 }
            : a.id === "ads" ? { total: r?.data?.total || 0, active: r?.data?.active || 0, paused: r?.data?.paused || 0, weekSpend: r?.data?.weekSpend || "0", weekClicks: r?.data?.weekClicks || 0, weekConversions: r?.data?.weekConversions || 0, weekRoas: r?.data?.weekRoas || "0", metaConnected: r?.data?.metaConnected ?? false, supabaseConnected: r?.data?.supabaseConnected ?? false, telegramConnected: r?.data?.telegramConnected ?? false }
            : a.id === "leader" ? { issues: leader.summary.totalIssues, critical: leader.summary.criticalIssues, suggestions: leader.summary.totalSuggestions } : {},
        };
      }
      const onlineCount = Object.values(agents).filter(a => a.online).length - 1;
      return res.json({ timestamp: new Date().toISOString(), systemHealth: onlineCount === 3 ? "operational" : onlineCount >= 2 ? "degraded" : "down", agents, leader, shopify: shopData?.ok ? { revenue7d: shopData.orders?.revenue7d, totalOrders: shopData.orders?.total, activeProducts: shopData.products?.active } : null });
    }

    // ACTIVITY
    if (action === "activity") {
      const activities = [];
      const [dropRes, landRes, adsRes] = await Promise.all([fetchAgent(AGENTS[0].url, AGENTS[0].endpoints.runs), fetchAgent(AGENTS[1].url, AGENTS[1].endpoints.list), fetchAgent(AGENTS[2].url, AGENTS[2].endpoints.list)]);
      if (dropRes.ok) for (const run of (dropRes.data?.runs || dropRes.data || []).slice(0, 5)) activities.push({ agent:"dropshipping", avatar:"D", title:`Busqueda — ${run.productsFound || run.products_found || 0} productos`, timestamp: run.completedAt || run.completed_at || run.created_at, color:"#3B82F6" });
      if (landRes.ok) for (const lp of (landRes.data?.landings || landRes.data?.pages || []).slice(0, 5)) activities.push({ agent:"landing", avatar:"L", title: lp.product_name || lp.title || "Producto", subtitle: lp.status === "published" ? "Shopify" : "Borrador", timestamp: lp.created_at, color:"#10B981" });
      if (adsRes.ok) for (const c of (adsRes.data?.campaigns || []).slice(0, 5)) activities.push({ agent:"ads", avatar:"A", title: c.product_name, subtitle:`${c.status} — ${c.country_code} — $${c.budget_daily_usd}/d`, timestamp: c.created_at, color:"#7C3AED" });
      activities.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      return res.json({ activities: activities.slice(0, 20) });
    }

    // PIPELINE
    if (action === "pipeline") {
      const pipeline = { discovered:[], landing_created:[], campaign_active:[], converting:[] };
      const [prodRes, landRes, adsRes] = await Promise.all([fetchAgent(AGENTS[0].url, AGENTS[0].endpoints.products), fetchAgent(AGENTS[1].url, AGENTS[1].endpoints.list), fetchAgent(AGENTS[2].url, AGENTS[2].endpoints.list)]);
      const products = (prodRes.ok ? (prodRes.data?.products || prodRes.data || []) : []).slice(0, 25);
      const landings = landRes.ok ? (landRes.data?.landings || landRes.data?.pages || []) : [];
      const campaigns = adsRes.ok ? (adsRes.data?.campaigns || []) : [];
      const landNames = new Set(landings.map(l => (l.product_name || l.title || "").toLowerCase()));
      const campNames = new Set(campaigns.map(c => (c.product_name || "").toLowerCase()));
      for (const p of products) {
        const n = (p.product_name || p.name || "").toLowerCase();
        const item = { name: p.product_name || p.name, score: p.score || p.total_score || 0, source: p.source, country: p.country_code };
        if (campNames.has(n)) { const camp = campaigns.find(c => (c.product_name||"").toLowerCase() === n); pipeline[camp?.status === "ACTIVE" ? "converting" : "campaign_active"].push({ ...item, status: camp?.status, spend: camp?.budget_daily_usd, campaignId: camp?.id }); }
        else if (landNames.has(n)) pipeline.landing_created.push(item);
        else pipeline.discovered.push(item);
      }
      return res.json({ pipeline });
    }

    // SHOPIFY
    if (action === "shopify") return res.json(await getShopifyOverview());

    // ANALYTICS
    if (action === "analytics") { const r = await fetchAgent(AGENTS[2].url, AGENTS[2].endpoints.analytics); return res.json(r.ok ? r.data : { daily:[], totals:{} }); }

    // CAMPAIGNS LIST
    if (action === "campaigns") return res.json({ campaigns: await getCampaigns() });

    // CAMPAIGN METRICS
    if (action === "campaign-metrics") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Falta id" });
      const data = await getCampaignMetrics(id);
      return res.json(data || { error: "Sin datos" });
    }

    // HEALTH CHECK
    if (action === "health-check") return res.json(await workflowHealthCheck());

    // COD: listar confirmaciones pendientes
    if (action === "cod-pending") return res.json(await listPendingConfirmations());

    // ─── LEADER AI ENDPOINTS ──────────────────────────────────
    // Full AI report — GET /api/hub?action=leader-report
    if (action === "leader-report") {
      const [raw, shopData] = await Promise.all([fetchAllStatus(), getShopifyOverview().catch(() => null)]);
      const staticLeader = leaderAnalyze(raw, shopData);
      try {
        const aiReport = await generateLeaderReport(raw, shopData);
        return res.json({ source: "gemini", ...aiReport, staticFallback: staticLeader });
      } catch {
        return res.json({ source: "static", ...staticLeader });
      }
    }

    // Analyze single agent — GET /api/hub?action=leader-analyze&agent=dropshipping
    if (action === "leader-analyze") {
      const agentId = req.query.agent;
      if (!agentId) return res.status(400).json({ error: "Falta parametro agent" });
      const agent = AGENTS.find(a => a.id === agentId);
      if (!agent?.url) return res.status(404).json({ error: `Agente ${agentId} no encontrado` });
      const r = await fetchAgent(agent.url, agent.endpoints.status);
      const statusData = { online: r.ok, data: r.ok ? r.data : null, error: r.ok ? null : r.error };
      try {
        const analysis = await analyzeAgent(agentId, statusData);
        return res.json({ source: "gemini", agentId, ...analysis });
      } catch {
        return res.json({ source: "static", agentId, score: 0, health: "unknown", error: "Gemini no disponible" });
      }
    }

    // AGENT CONFIG (read)
    if (action === "agent-config" && req.method === "GET") {
      const agentId = req.query.agent;
      const agent = AGENTS.find(a => a.id === agentId);
      if (!agent?.url) return res.status(404).json({ error: "No encontrado" });
      const ep = agentId === "ads" ? "/api/ads?action=config" : "/api/agent?action=status";
      const r = await fetchAgent(agent.url, ep);
      return res.json(r.ok ? r.data : { error: r.error });
    }

    // POST ACTIONS
    if (req.method === "POST") {
      if (action === "run-search") return res.json(await postAgent(AGENTS[0].url, "/api/agent?action=run", {}));
      if (action === "run-landings") return res.json(await postAgent(AGENTS[1].url, "/api/landing?action=auto-create", {}));
      if (action === "run-monitor") return res.json(await postAgent(AGENTS[2].url, "/api/ads?action=monitor", {}));

      // Leader AI: improvements — POST /api/hub?action=leader-improve&agent=dropshipping
      if (action === "leader-improve") {
        const agentId = req.query.agent;
        if (!agentId) return res.status(400).json({ error: "Falta parametro agent" });
        const agent = AGENTS.find(a => a.id === agentId);
        if (!agent?.url) return res.status(404).json({ error: `Agente ${agentId} no encontrado` });
        const r = await fetchAgent(agent.url, agent.endpoints.status);
        const statusData = { online: r.ok, data: r.ok ? r.data : null };
        const recentHistory = req.body?.history || null;
        try {
          const result = await suggestImprovements(agentId, statusData, recentHistory);
          return res.json({ source: "gemini", agentId, ...result });
        } catch {
          return res.json({ source: "static", agentId, improvements: [], error: "Gemini no disponible" });
        }
      }

      // Leader AI: chat — POST /api/hub?action=leader-chat body:{message}
      if (action === "leader-chat") {
        const { message } = req.body || {};
        if (!message) return res.status(400).json({ error: "Falta message en el body" });
        const [raw, shopData] = await Promise.all([fetchAllStatus(), getShopifyOverview().catch(() => null)]);
        const staticLeader = leaderAnalyze(raw, shopData);
        const context = { agentStatus: raw, shopify: shopData, leaderAnalysis: staticLeader };
        try {
          const result = await leaderChat(message, context);
          return res.json({ source: "gemini", ...result });
        } catch {
          return res.json({ source: "static", response: "No puedo responder en este momento. Gemini API no disponible.", suggestions: [], relatedAgents: [] });
        }
      }
      if (action === "workflow-launch") return res.json(await workflowLaunchProduct(req.body || {}));

      // Toggle campaign
      if (action === "toggle-campaign") {
        const { id, activate } = req.body;
        if (!id) return res.status(400).json({ error: "Falta id" });
        const r = await toggleCampaign(id, activate);
        return res.json(r);
      }

      // ─── COD CONFIRMER ────────────────────────────────
      // Webhook: nuevo pedido COD
      if (action === "cod-order") {
        const result = await processNewCODOrder(req.body);
        return res.json(result);
      }

      // Confirmar pedido
      if (action === "cod-confirm") {
        const { orderNumber } = req.body;
        if (!orderNumber) return res.status(400).json({ error: "Falta orderNumber" });
        const result = await confirmOrder(orderNumber);
        return res.json(result);
      }

      // Cancelar pedido
      if (action === "cod-cancel") {
        const { orderNumber, reason } = req.body;
        if (!orderNumber) return res.status(400).json({ error: "Falta orderNumber" });
        const result = await cancelOrder(orderNumber, reason || "manual");
        return res.json(result);
      }

      // Agent config update
      if (action === "agent-config") {
        const { agent: agentId, config } = req.body;
        const agent = AGENTS.find(a => a.id === agentId);
        if (!agent?.url) return res.status(404).json({ error: "No encontrado" });
        const ep = agentId === "ads" ? "/api/ads?action=config" : "/api/agent?action=config";
        return res.json(await postAgent(agent.url, ep, config));
      }
    }

    return res.status(400).json({ error: `Accion: ${action}` });
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
