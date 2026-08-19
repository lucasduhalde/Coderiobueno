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

// IP del cliente. `x-forwarded-for` lo puede falsificar quien llama: el proxy
// añade la IP real al FINAL de la lista, así que nunca hay que leer la primera.
// En Vercel `x-real-ip` lo escribe la plataforma y es el valor de confianza.
export function ip(req) {
  const uno = (v) => (Array.isArray(v) ? v[v.length - 1] : v) || '';
  const real = uno(req.headers['x-real-ip']).trim();
  if (real) return real;
  const partes = uno(req.headers['x-forwarded-for']).split(',');
  return partes[partes.length - 1].trim() || 'desconocida';
}

// Devuelve true si la petición está dentro del límite.
export async function limite(clave, maximo, ventanaSeg) {
  const n = await redis('INCR', clave);
  if (n === 1) await redis('EXPIRE', clave, String(ventanaSeg));
  return n <= maximo;
}

// Comparación en tiempo constante, para no filtrar el token por temporización.
export function tokenValido(recibido, esperado) {
  if (!esperado || typeof recibido !== 'string') return false;
  const a = Buffer.from(String(recibido));
  const b = Buffer.from(String(esperado));
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

// Rechaza peticiones de escritura originadas en otro sitio (CSRF).
export function mismoOrigen(req) {
  const origen = req.headers.origin;
  if (!origen) return true; // sin Origin no es una petición de navegador cross-site
  try {
    return new URL(origen).host === req.headers.host;
  } catch {
    return false;
  }
}
