// POST /api/criar-cobranca  -> cria o link de pagamento na InfinitePay (Cloudflare Pages Functions)
const PRECOS = [599, 699, 799, 849, 949, 999]; // em CENTAVOS (o preço vem daqui, nunca do navegador)
const NOMES = ["Primeiro Emprego", "Jovem Aprendiz", "Corporativo", "Criativo", "Moderno", "Primeiro Emprego Clássico"];

const redis = (env, cmd) =>
  fetch(env.UPSTASH_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + env.UPSTASH_TOKEN },
    body: JSON.stringify(cmd),
  }).then((r) => r.json());
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch {}
  const { modelo, email, nome, tel } = b;
  const price = PRECOS[modelo];
  if (!price || !/^\S+@\S+\.\S+$/.test(email || "")) return json({ erro: "dados inválidos" }, 400);

  const order_nsu = crypto.randomUUID();
  const fone = String(tel || "").replace(/\D/g, "");
  const payload = {
    handle: env.INFINITEPAY_HANDLE, // igorkaik12 (sem o $)
    order_nsu,
    redirect_url: env.SITE_URL, // o cliente volta para cá depois de pagar
    items: [{ quantity: 1, price, description: "Currículo Rápido - " + NOMES[modelo] }],
    customer: {
      name: String(nome || "").slice(0, 80),
      email,
      ...(fone.length >= 10 ? { phone_number: "+55" + fone } : {}),
    },
  };

  const r = await fetch("https://api.checkout.infinitepay.io/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const d = await r.json().catch(() => ({}));
  // A documentação não informa o nome do campo da resposta; pegamos o primeiro link do checkout que vier nela.
  const url = (JSON.stringify(d).match(/https:\/\/checkout\.infinitepay\.io[^"\\]+/) || [])[0];
  console.log("InfinitePay /links:", r.status, JSON.stringify(d)); // aparece nos logs do Cloudflare
  if (!r.ok || !url) return json({ erro: "falha ao criar o pagamento" }, 502);

  await redis(env, ["SET", "order:" + order_nsu, JSON.stringify({ modelo, price }), "EX", 604800]);
  return json({ url, order_nsu });
}
