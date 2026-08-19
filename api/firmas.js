import { redis, configurado, tokenValido } from '../lib/store.js';

// Excel y LibreOffice ejecutan como fórmula toda celda que empiece por = + - @
// o por un control. Se antepone una comilla para que quede como texto plano.
function celda(v) {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}

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
      if (!tokenValido(token, admin)) return res.status(401).json({ error: 'no-autorizado' });
      const filas = (await redis('LRANGE', LISTA, '0', '-1')).map((f) => JSON.parse(f));
      const csv = ['fecha,nombre,comuna,email,mensaje']
        .concat(filas.map((f) => [f.fecha, f.nombre, f.comuna, f.email, f.mensaje]
          .map(celda).join(',')))
        .join('\r\n');
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
