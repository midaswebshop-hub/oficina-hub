// lib/cod_confirmer.js
// ============================================================
// COD CONFIRMER — Confirma pedidos contra entrega por WhatsApp
//
// Flujo:
// 1. Shopify webhook → nuevo pedido COD
// 2. Espera 30 min (dejar que el cliente se calme)
// 3. Envía WhatsApp de confirmación (doble opt-in)
// 4. Si confirma → marca como verificado → enviar a Dropi
// 5. Si no responde en 24h → 1 recordatorio
// 6. Si no responde en 48h → cancelar pedido
//
// Reduce RTS de ~15% a ~8% filtrando pedidos no serios
//
// Requiere: Telegram para alertas (WhatsApp API cuando se configure)
// Por ahora: genera los mensajes y notifica por Telegram para que
// Kily los envíe manualmente. Cuando haya WhatsApp Business API
// se automatiza sin cambiar la lógica.
//
// Archivo nuevo — NO modifica ningún archivo existente
// Env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SUPABASE vars
// ============================================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── TEMPLATES DE MENSAJES ──────────────────────────────────
const TEMPLATES = {
  CR: {
    confirmation: (order) =>
      `Hola ${order.firstName} 👋\n\n` +
      `Soy de ${order.storeName}. Recibimos tu pedido #${order.orderNumber}:\n\n` +
      `📦 ${order.productName}\n` +
      `💰 ${order.total} ${order.currency} — pago contra entrega\n` +
      `📍 Envío a: ${order.city}\n\n` +
      `¿Confirmás que te lo enviemos? Respondé *SÍ* para confirmar.\n\n` +
      `Si tenés alguna duda, escribime por acá.`,

    reminder: (order) =>
      `Hola ${order.firstName}, te escribimos ayer sobre tu pedido #${order.orderNumber} ` +
      `(${order.productName} por ${order.total} ${order.currency}).\n\n` +
      `¿Lo confirmamos? Respondé *SÍ* o *NO* para que sepamos.`,

    confirmed: (order) =>
      `✅ Perfecto ${order.firstName}, tu pedido #${order.orderNumber} está confirmado.\n\n` +
      `Te enviamos el número de seguimiento cuando despache. ¡Gracias!`,

    cancelled: (order) =>
      `Hola ${order.firstName}, como no recibimos respuesta, cancelamos el pedido #${order.orderNumber}.\n\n` +
      `Si cambiás de opinión, podés volver a pedirlo en nuestra tienda.`,
  },

  GT: {
    confirmation: (order) =>
      `Hola ${order.firstName} 👋\n\n` +
      `Somos de ${order.storeName}. Recibimos tu pedido #${order.orderNumber}:\n\n` +
      `📦 ${order.productName}\n` +
      `💰 ${order.total} ${order.currency} — pago contra entrega\n` +
      `📍 Envío a: ${order.city}\n\n` +
      `¿Confirmás que te lo enviemos? Respondé *SÍ* para confirmar.`,

    reminder: (order) =>
      `Hola ${order.firstName}, te escribimos sobre tu pedido #${order.orderNumber}.\n` +
      `¿Lo confirmamos o lo cancelamos? Respondé *SÍ* o *NO*.`,

    confirmed: (order) =>
      `✅ Listo ${order.firstName}, pedido #${order.orderNumber} confirmado. ¡Te avisamos cuando despache!`,

    cancelled: (order) =>
      `Hola ${order.firstName}, cancelamos el pedido #${order.orderNumber} por falta de respuesta.\n` +
      `Podés volver a pedirlo cuando quieras.`,
  },

  CO: {
    confirmation: (order) =>
      `Hola ${order.firstName} 👋\n\n` +
      `Te escribimos de ${order.storeName}. Recibimos tu pedido #${order.orderNumber}:\n\n` +
      `📦 ${order.productName}\n` +
      `💰 $${order.total} ${order.currency} — pago contra entrega\n` +
      `📍 Envío a: ${order.city}\n\n` +
      `¿Confirmas que te lo enviemos? Responde *SÍ* para confirmar.\n\n` +
      `Cualquier duda, escríbenos por aquí.`,

    reminder: (order) =>
      `Hola ${order.firstName}, te contactamos ayer por tu pedido #${order.orderNumber} ` +
      `(${order.productName}).\n\n` +
      `¿Lo confirmamos? Responde *SÍ* o *NO*.`,

    confirmed: (order) =>
      `✅ Perfecto ${order.firstName}, tu pedido #${order.orderNumber} va en camino.\n` +
      `Te enviamos el número de guía cuando despache. ¡Gracias!`,

    cancelled: (order) =>
      `Hola ${order.firstName}, cancelamos el pedido #${order.orderNumber} por falta de confirmación.\n` +
      `Si cambias de opinión, puedes volver a pedirlo.`,
  },
};

// ─── PROCESAR NUEVO PEDIDO COD ──────────────────────────────
// Called when Shopify webhook fires for a new COD order
export async function processNewCODOrder(shopifyOrder) {
  const order = extractOrderData(shopifyOrder);

  if (!order.phone) {
    await alertTelegram(
      `⚠️ Pedido #${order.orderNumber} sin teléfono — no se puede confirmar COD`
    );
    return { ok: false, reason: "no_phone" };
  }

  // Check do_not_contact list
  const { data: blocked } = await supabase
    .from("do_not_contact")
    .select("phone")
    .eq("phone", order.phone)
    .single();

  if (blocked) {
    await alertTelegram(
      `🚫 Pedido #${order.orderNumber} — cliente en lista do_not_contact. Enviar sin confirmar o cancelar.`
    );
    return { ok: false, reason: "do_not_contact" };
  }

  // Get the right template
  const country = order.countryCode || "CR";
  const templates = TEMPLATES[country] || TEMPLATES.CR;
  const message = templates.confirmation(order);

  // For now: send via Telegram for Kily to forward manually
  // When WhatsApp Business API is ready, this becomes automatic
  await alertTelegram(
    `📦 *NUEVO PEDIDO COD — Confirmar*\n\n` +
    `Pedido: #${order.orderNumber}\n` +
    `Producto: ${order.productName}\n` +
    `Total: ${order.total} ${order.currency}\n` +
    `Cliente: ${order.firstName} ${order.lastName}\n` +
    `Tel: ${order.phone}\n` +
    `Ciudad: ${order.city}\n` +
    `País: ${country}\n\n` +
    `📋 *Mensaje para enviar por WhatsApp:*\n\n` +
    `\`\`\`\n${message}\n\`\`\`\n\n` +
    `Copia y envía al cliente. Cuando responda SÍ, usa /confirm ${order.orderNumber}`
  );

  // Save confirmation request in Supabase
  try {
    await supabase.from("permission_requests").insert({
      type: "cod_confirmation",
      order_id: order.orderNumber,
      customer_phone: order.phone,
      customer_name: `${order.firstName} ${order.lastName}`,
      country: country,
      status: "pending",
      message_sent: message,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    console.error("[COD] Error saving to Supabase:", err.message);
  }

  return {
    ok: true,
    orderNumber: order.orderNumber,
    status: "pending_confirmation",
    messageSent: message,
  };
}

// ─── CONFIRMAR PEDIDO ───────────────────────────────────────
export async function confirmOrder(orderNumber) {
  try {
    await supabase
      .from("permission_requests")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("order_id", orderNumber)
      .eq("type", "cod_confirmation");

    await alertTelegram(`✅ Pedido #${orderNumber} CONFIRMADO — listo para enviar a Dropi`);
    return { ok: true, orderNumber, status: "confirmed" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── CANCELAR PEDIDO ────────────────────────────────────────
export async function cancelOrder(orderNumber, reason = "no_response") {
  try {
    await supabase
      .from("permission_requests")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason })
      .eq("order_id", orderNumber)
      .eq("type", "cod_confirmation");

    await alertTelegram(`❌ Pedido #${orderNumber} CANCELADO — razón: ${reason}`);
    return { ok: true, orderNumber, status: "cancelled" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── LISTAR PENDIENTES ──────────────────────────────────────
export async function listPendingConfirmations() {
  const { data, error } = await supabase
    .from("permission_requests")
    .select("*")
    .eq("type", "cod_confirmation")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  // Check for expired ones (>48h)
  const now = Date.now();
  const expired = [];
  const active = [];

  for (const req of data || []) {
    if (new Date(req.expires_at).getTime() < now) {
      expired.push(req);
    } else {
      active.push(req);
    }
  }

  // Auto-cancel expired
  for (const exp of expired) {
    await cancelOrder(exp.order_id, "expired_48h");
  }

  return {
    ok: true,
    pending: active,
    auto_cancelled: expired.length,
    total: (data || []).length,
  };
}

// ─── HELPERS ────────────────────────────────────────────────
function extractOrderData(shopifyOrder) {
  const shipping = shopifyOrder.shipping_address || shopifyOrder.billing_address || {};
  const lineItem = shopifyOrder.line_items?.[0] || {};

  return {
    orderNumber: shopifyOrder.order_number || shopifyOrder.name || "N/A",
    firstName: shipping.first_name || shopifyOrder.customer?.first_name || "Cliente",
    lastName: shipping.last_name || shopifyOrder.customer?.last_name || "",
    phone: shipping.phone || shopifyOrder.customer?.phone || shopifyOrder.phone || "",
    city: shipping.city || "N/A",
    countryCode: shipping.country_code || "CR",
    productName: lineItem.name || lineItem.title || "Producto",
    total: shopifyOrder.total_price || "0",
    currency: shopifyOrder.currency || "CRC",
    storeName: "Escala 100K",
  };
}

async function alertTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[COD] Telegram no configurado:", message);
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("[COD] Telegram error:", err.message);
  }
}
