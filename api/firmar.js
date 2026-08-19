import { redis, configurado, ip, limite, mismoOrigen } from '../lib/store.js';

const LISTA = 'crb:firmas';
const TOTAL = 'crb:firmas:total';
const EMAILS = 'crb:firmas:emails';

const limpiar = (v, max) => String(v ?? '').trim().slice(0, max);
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo-no-permitido' });
  if (!mismoOrigen(req)) return res.status(403).json({ error: 'origen-no-permitido' });
  if (!configurado) return res.status(503).json({ error: 'store-no-configurado' });

  let cuerpo;
  try {
    cuerpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'cuerpo-invalido' });
  }
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return res.status(400).json({ error: 'cuerpo-invalido' });
  }

  // Honeypot: los bots rellenan campos ocultos.
  if (limpiar(cuerpo.campo_reservado, 200)) return res.status(200).json({ ok: true, total: null });

  const nombre = limpiar(cuerpo.nombre, 80);
  const comuna = limpiar(cuerpo.comuna, 60) || 'Río Bueno';
  const email = limpiar(cuerpo.email, 120).toLowerCase();
  const mensaje = limpiar(cuerpo.mensaje, 280);

  if (nombre.length < 3) return res.status(400).json({ error: 'nombre-invalido' });
  if (email && !emailValido(email)) return res.status(400).json({ error: 'email-invalido' });
  if (cuerpo.consentimiento !== true) return res.status(400).json({ error: 'consentimiento-requerido' });

  try {
    if (!(await limite(`crb:rl:${ip(req)}`, 30, 3600))) {
      return res.status(429).json({ error: 'demasiadas-solicitudes' });
    }
    if (email && (await redis('SISMEMBER', EMAILS, email)) === 1) {
      const total = Number(await redis('GET', TOTAL)) || 0;
      return res.status(200).json({ ok: true, duplicado: true, total });
    }

    await redis('RPUSH', LISTA, JSON.stringify({
      nombre, comuna, email, mensaje, fecha: new Date().toISOString(),
    }));
    if (email) await redis('SADD', EMAILS, email);
    const total = await redis('INCR', TOTAL);

    return res.status(200).json({ ok: true, total });
  } catch (e) {
    return res.status(500).json({ error: 'error-store' });
  }
}
