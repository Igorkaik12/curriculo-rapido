// api/confirmar.js
// Confere na InfinitePay se o pedido foi pago e controla o download único.

async function redis(cmd) {
  const r = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.KV_REST_API_TOKEN },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error("Redis: " + j.error);
  return j.result;
}

async function perguntarInfinitePay(handle, order_nsu, transaction_nsu, slug) {
  const r = await fetch("https://api.checkout.infinitepay.io/payment_check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, order_nsu, transaction_nsu, slug }),
  });
  const texto = await r.text();
  console.log("payment_check", r.status, texto.slice(0, 300));
  try { return JSON.parse(texto); } catch (e) { return {}; }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "metodo" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { order_nsu, transaction_nsu, slug, consumir } = body;

    if (!order_nsu || !/^[0-9a-f-]{36}$/i.test(order_nsu)) {
      return res.status(400).json({ paid: false, ok: false });
    }

    const bruto = await redis(["GET", "order:" + order_nsu]);
    if (!bruto) return res.status(200).json({ paid: false, ok: false });
    const pedido = JSON.parse(bruto);

    // Ainda não marcado como pago: pergunta direto para a InfinitePay.
    if (pedido.status !== "paid") {
      if (!transaction_nsu || !slug) return res.status(200).json({ paid: false, ok: false });

      const chk = await perguntarInfinitePay(
        process.env.INFINITEPAY_HANDLE, order_nsu, transaction_nsu, slug
      );
      let pago = chk && chk.paid === true;
      if (pago && typeof chk.paid_amount === "number" && chk.paid_amount < pedido.price) pago = false;

      if (!pago) return res.status(200).json({ paid: false, ok: false });

      pedido.status = "paid";
      await redis(["SET", "order:" + order_nsu, JSON.stringify(pedido), "EX", 60 * 60 * 24 * 30]);
    }

    const jaUsado = (await redis(["GET", "used:" + order_nsu])) !== null;

    if (!consumir) {
      return res.status(200).json({ paid: true, usado: jaUsado, modelo: pedido.modelo });
    }

    // Consome o download único (SET NX = só o primeiro pedido consegue).
    const ganhou = await redis(["SET", "used:" + order_nsu, "1", "NX", "EX", 60 * 60 * 24 * 30]);
    if (ganhou !== "OK") return res.status(200).json({ paid: true, usado: true, ok: false });

    return res.status(200).json({ paid: true, ok: true, modelo: pedido.modelo });
  } catch (e) {
    console.error("confirmar erro:", e);
    return res.status(500).json({ paid: false, ok: false });
  }
};
