// Confere com a InfinitePay se o pagamento foi feito e controla o "1 download por pagamento".
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN },
    body: JSON.stringify(cmd),
  });
  return (await r.json()).result;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erro: "método não permitido" });
  try {
    const { order_nsu, transaction_nsu, slug, consumir } = req.body || {};
    if (!order_nsu || !transaction_nsu || !slug) return res.status(400).json({ paid: false, ok: false });

    // só aceita pedidos que foram criados por nós
    const raw = await redis(["GET", "pedido:" + order_nsu]);
    if (!raw) return res.status(200).json({ paid: false, ok: false });
    const pedido = JSON.parse(raw);

    // pergunta para a InfinitePay se foi pago de verdade
    const r = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: process.env.INFINITEPAY_HANDLE,
        order_nsu,
        transaction_nsu,
        slug,
      }),
    });
    const d = await r.json().catch(() => ({}));
    const pago = r.ok && d.paid === true && Number(d.amount) >= pedido.cents;
    if (!pago) return res.status(200).json({ paid: false, ok: false });

    if (consumir) {
      // SET ... NX só funciona uma vez: garante 1 único download
      const primeiro = await redis(["SET", "usado:" + order_nsu, "1", "NX", "EX", 2592000]);
      if (!primeiro) return res.status(200).json({ ok: false });
      return res.status(200).json({ ok: true, modelo: pedido.modelo });
    }

    const usado = await redis(["EXISTS", "usado:" + order_nsu]);
    return res.status(200).json({ paid: true, usado: usado === 1 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "erro interno" });
  }
};
