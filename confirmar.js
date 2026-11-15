// POST /api/confirmar  -> confere o pagamento na InfinitePay e libera 1 download (Cloudflare Pages Functions)
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
  const { order_nsu, transaction_nsu, slug, consumir } = b;
  if (!order_nsu || !transaction_nsu || !slug) return json({ paid: false });

  const o = (await redis(env, ["GET", "order:" + order_nsu])).result;
  if (!o) return json({ paid: false }); // pedido que não foi criado por este site
  const ord = JSON.parse(o);

  const r = await fetch("https://api.checkout.infinitepay.io/payment_check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle: env.INFINITEPAY_HANDLE, order_nsu, transaction_nsu, slug }),
  });
  const d = await r.json().catch(() => ({}));
  // amount = valor original em centavos; confere com o preço guardado no servidor
  const paid = d.success === true && d.paid === true && d.amount === ord.price;
  if (!paid) return json({ paid: false });

  if (!consumir) {
    const usado = (await redis(env, ["GET", "usado:" + order_nsu])).result;
    return json({ paid: true, usado: !!usado });
  }
  // SET ... NX só grava se ainda não existir: garante o uso único
  const u = await redis(env, ["SET", "usado:" + order_nsu, "1", "NX"]);
  return json({ paid: true, ok: u.result === "OK", modelo: ord.modelo });
}
