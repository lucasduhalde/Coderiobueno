import { redis, configurado } from '../lib/store.js';

const LISTA = 'crb:firmas';
const TOTAL = 'crb:firmas:total';

// Público: solo el total y los nombres abreviados de las últimas adhesiones.
// Privado (?token=ADMIN_TOKEN): CSV completo.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configurado) return res.status(503).json({ error: 'store-no-configurado' });

  const admin = process.env.ADMIN_TOKEN;
  const token = req.query?.token;

  try {
    if (token) {
      if (!admin || token !== admin) return res.status(401).json({ error: 'no-autorizado' });
      const filas = (await redis('LRANGE', LISTA, '0', '-1')).map((f) => JSON.parse(f));
      const csv = ['fecha,nombre,comuna,email,mensaje']
        .concat(filas.map((f) => [f.fecha, f.nombre, f.comuna, f.email, f.mensaje]
          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')))
        .join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="firmas-riobueno.csv"');
      return res.status(200).send(csv);
    }

    const total = Number(await redis('GET', TOTAL)) || 0;
    const ultimas = (await redis('LRANGE', LISTA, '-12', '-1'))
      .map((f) => JSON.parse(f))
      .reverse()
      .map(({ nombre, comuna }) => {
        const p = nombre.split(/\s+/);
        const inicial = p.length > 1 ? ` ${p[p.length - 1][0].toUpperCase()}.` : '';
        return { nombre: `${p[0]}${inicial}`, comuna };
      });
    return res.status(200).json({ total, ultimas });
  } catch (e) {
    return res.status(500).json({ error: 'error-store' });
  }
}
