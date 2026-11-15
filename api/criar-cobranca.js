// Cria o link de pagamento na InfinitePay para o modelo escolhido.
// OS PREÇOS DE VERDADE FICAM AQUI (em centavos). O site só mostra, quem cobra é este arquivo.
const crypto = require("crypto");

const MODELOS = [
  ["Primeiro Emprego", 599],            // R$ 5,99
  ["Jovem Aprendiz", 699],              // R$ 6,99
  ["Corporativo", 799],                 // R$ 7,99
  ["Criativo", 849],                    // R$ 8,49
  ["Moderno", 949],                     // R$ 9,49
  ["Primeiro Emprego Clássico", 999],   // R$ 9,99
];

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
    if (!process.env.INFINITEPAY_HANDLE) return res.status(500).json({ erro: "handle não configurado" });
    const { modelo, nome, email } = req.body || {};
    const idx = Number(modelo);
    const m = MODELOS[idx];
    if (!Number.isInteger(idx) || !m) return res.status(400).json({ erro: "modelo inválido" });
    if (!nome || !/^\S+@\S+\.\S+$/.test(email || "")) return res.status(400).json({ erro: "dados inválidos" });

    const order_nsu = crypto.randomUUID();
    const host = req.headers["x-forwarded-host"] || req.headers.host;

    const r = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: process.env.INFINITEPAY_HANDLE,
        order_nsu,
        redirect_url: "https://" + host + "/",
        items: [{ quantity: 1, price: m[1], description: "Currículo - " + m[0] }],
        customer: { name: String(nome).slice(0, 100), email: String(email).slice(0, 100) },
      }),
    });
    const d = await r.json().catch(() => ({}));
    const url = d.url || d.link || d.checkout_url;
    if (!r.ok || !url) {
      console.error("InfinitePay respondeu:", r.status, JSON.stringify(d));
      return res.status(502).json({ erro: "falha ao criar cobrança" });
    }

    // guarda o pedido por 30 dias (modelo + valor esperado)
    await redis(["SET", "pedido:" + order_nsu, JSON.stringify({ modelo: idx, cents: m[1] }), "EX", 2592000]);
    return res.status(200).json({ url, order_nsu });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "erro interno" });
  }
};
