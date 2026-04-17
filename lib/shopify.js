// lib/shopify.js
// ============================================================
// SHOPIFY API — Productos, ordenes, metricas del negocio real
// ============================================================

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

async function shopifyGet(endpoint) {
  if (!STORE || !TOKEN) return { ok: false, error: "Shopify no configurado" };
  try {
    const res = await fetch(`https://${STORE}/admin/api/2024-01/${endpoint}`, {
      headers: { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function getShopifyOverview() {
  const [prodRes, orderRes, shopRes] = await Promise.all([
    shopifyGet("products.json?limit=250&fields=id,title,status,created_at,variants,images"),
    shopifyGet("orders.json?limit=50&status=any&fields=id,name,total_price,financial_status,fulfillment_status,created_at,line_items,currency"),
    shopifyGet("shop.json"),
  ]);

  const products = prodRes.ok ? prodRes.data.products || [] : [];
  const orders = orderRes.ok ? orderRes.data.orders || [] : [];
  const shop = shopRes.ok ? shopRes.data.shop || {} : {};

  // Calcular métricas
  const activeProducts = products.filter(p => p.status === "active").length;
  const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
  const paidOrders = orders.filter(o => o.financial_status === "paid");
  const pendingOrders = orders.filter(o => o.financial_status === "pending");
  const last7d = orders.filter(o => Date.now() - new Date(o.created_at).getTime() < 7 * 86400000);
  const revenue7d = last7d.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);

  return {
    ok: true,
    shop: { name: shop.name, domain: shop.domain, currency: shop.currency, plan: shop.plan_name },
    products: {
      total: products.length,
      active: activeProducts,
      draft: products.filter(p => p.status === "draft").length,
      recent: products.slice(0, 8).map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        price: p.variants?.[0]?.price || "0",
        image: p.images?.[0]?.src || null,
        created: p.created_at,
      })),
    },
    orders: {
      total: orders.length,
      paid: paidOrders.length,
      pending: pendingOrders.length,
      totalRevenue: totalRevenue.toFixed(2),
      revenue7d: revenue7d.toFixed(2),
      recent: orders.slice(0, 8).map(o => ({
        id: o.id,
        name: o.name,
        total: o.total_price,
        currency: o.currency,
        status: o.financial_status,
        fulfillment: o.fulfillment_status || "unfulfilled",
        items: (o.line_items || []).map(li => li.title).join(", "),
        created: o.created_at,
      })),
    },
  };
}
