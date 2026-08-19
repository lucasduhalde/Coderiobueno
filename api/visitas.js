import { redis, configurado } from '../lib/store.js';

const CLAVE = 'crb:visitas';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!configurado) {
    return res.status(503).json({ error: 'store-no-configurado' });
  }

  try {
    // Solo se incrementa cuando el cliente declara ser una visita nueva de sesión.
    const nueva = req.method === 'POST';
    const total = nueva ? await redis('INCR', CLAVE) : Number(await redis('GET', CLAVE)) || 0;
    return res.status(200).json({ total });
  } catch (e) {
    return res.status(500).json({ error: 'error-store' });
  }
}
