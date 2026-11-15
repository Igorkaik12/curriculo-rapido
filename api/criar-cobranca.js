const crypto = require("crypto");

const MODELOS = [
  ["Primeiro Emprego", 599],
  ["Jovem Aprendiz", 699],
  ["Corporativo", 799],
  ["Criativo", 849],
  ["Moderno", 949],
  ["Primeiro Emprego Clássico", 999],
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
  if (req.method !== "POST") return
