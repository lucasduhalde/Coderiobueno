// Adaptador mínimo a Upstash Redis vía REST.
// Vercel KV inyecta KV_REST_API_*; Upstash directo inyecta UPSTASH_REDIS_REST_*.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const configurado = Boolean(URL_ && TOKEN);

export async function redis(...comando) {
  if (!configurado) throw new Error('store-no-configurado');
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando),
  });
  if (!r.ok) throw new Error(`upstash ${r.status}: ${await r.text()}`);
  const { result, error } = await r.json();
  if (error) throw new Error(error);
  return result;
}

export function ip(req) {
  const f = req.headers['x-forwarded-for'];
  return (Array.isArray(f) ? f[0] : (f || '')).split(',')[0].trim() || 'desconocida';
}

// Devuelve true si la petición está dentro del límite.
export async function limite(clave, maximo, ventanaSeg) {
  const n = await redis('INCR', clave);
  if (n === 1) await redis('EXPIRE', clave, String(ventanaSeg));
  return n <= maximo;
}
