// api/criar-cobranca.js
// Cria o link de pagamento na InfinitePay e guarda o pedido no Redis (Vercel KV).

const PRECOS = [599, 699, 799, 849, 949, 999]; // centavos, na mesma ordem dos modelos do site
const NOMES = [
  "Primeiro Emprego",
  "Jovem Aprendiz",
  "Corporativo",
  "Criativo",
  "Moderno",
  "Primeiro Emprego Clássico",
];

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

async function criarLink(payload) {
  const urls = [
    "https://api.checkout.infinitepay.io/links",
    "https://api.infinitepay.io/invoices/public/checkout/links",
  ];
  let ultimo = "";
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const texto = await r.text();
      let j = {};
      try { j = JSON.parse(texto); } catch (e) {}
      if (r.ok && j.url) return j.url;
      ultimo = u + " -> " + r.status + " " + texto.slice(0, 300);
      console.error("InfinitePay recusou:", ultimo);
    } catch (e) {
      ultimo = u + " -> " + e.message;
      console.error("Falha ao chamar InfinitePay:", ultimo);
    }
  }
  throw new Error(ultimo || "sem resposta");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "metodo" });

  try {
    const handle = process.env.INFINITEPAY_HANDLE;
    const base = (
      process.env.APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL
        : "")
    ).replace(/\/+$/, "");

    if (!handle || !base || !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      console.error("Faltam variáveis de ambiente (INFINITEPAY_HANDLE, APP_URL, KV_REST_API_URL, KV_REST_API_TOKEN)");
      return res.status(500).json({ erro: "config" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const modelo = Number(body.modelo);
    if (!Number.isInteger(modelo) || modelo < 0 || modelo >= PRECOS.length) {
      return res.status(400).json({ erro: "modelo" });
    }

    const orderNsu = crypto.randomUUID();
    const price = PRECOS[modelo];

    // Guarda só o necessário (sem dados pessoais): modelo, preço e status.
    await redis([
      "SET",
      "order:" + orderNsu,
      JSON.stringify({ modelo, price, status: "pending" }),
      "EX",
      60 * 60 * 24 * 30,
    ]);

    const payload = {
      handle,
      order_nsu: orderNsu,
      redirect_url: base + "/",
      items: [{ quantity: 1, price, description: "Currículo Rápido - " + NOMES[modelo] }],
    };

    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim();

    let url;
    try {
      url = await criarLink(
        nome && email ? { ...payload, customer: { name: nome, email } } : payload
      );
    } catch (e) {
      // tenta de novo sem os dados do cliente, caso o pré-preenchimento seja o problema
      url = await criarLink(payload);
    }

    return res.status(200).json({ url, order_nsu: orderNsu });
  } catch (e) {
    console.error("criar-cobranca erro:", e);
    return res.status(500).json({ erro: "interno" });
  }
};
