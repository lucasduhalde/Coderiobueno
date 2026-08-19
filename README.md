# coderiobueno.cl

Sitio MVP de la **Corporación para el Desarrollo de Río Bueno**.
HTML/CSS/JS estático + funciones serverless de Vercel. Sin build.

## Estructura
- `index.html` — landing completa (misión, visión, ejes, formulario de firmas).
- `api/visitas.js` — contador de visitas (`POST` incrementa, `GET` solo lee).
- `api/firmar.js` — registro de adhesiones (validación, honeypot, rate limit, deduplicación por email).
- `api/firmas.js` — total + últimas adhesiones anonimizadas. Con `?token=ADMIN_TOKEN` devuelve el CSV completo.
- `og.png` — imagen de previsualización (degradado sin texto; placeholder, el texto del preview viene de `og:title`).
- `lib/store.js` — adaptador Redis (fuera de `api/` para que Vercel no lo trate como endpoint).

## Estado actual: firmas y contador EN PAUSA

`index.html` lleva `<body data-funciones="pausa">`. Con esa marca:
- no se muestran los contadores de visitas ni de adhesiones,
- el formulario se reemplaza por un aviso de "abre pronto",
- **no se hace ninguna llamada a `/api`**.

Para reactivarlo: cambiar ese atributo a `data-funciones="activas"` y provisionar el almacén (paso 2 de abajo). El código de `api/` y `lib/` queda intacto y dormido; sin almacén responde 503.

## Despliegue

Con las funciones en pausa **no hace falta ningún almacén**: basta subir el sitio.

```bash
npx vercel login          # una sola vez
npx vercel                # primer despliegue (preview)
npx vercel --prod         # despliegue a producción
```

En el primer `npx vercel` responder: *Link to existing project?* **no** · *Project name* **coderiobueno** · *Framework* **Other** · *Build command* **vacío** · *Output directory* **por defecto**.

### Cuando se reactiven las firmas
1. Cambiar `data-funciones` a `activas` en `index.html`.
2. **Crear el almacén**:
   Vercel → Storage → **Upstash Redis** → Connect to Project.
   Esto inyecta `KV_REST_API_URL` y `KV_REST_API_TOKEN` (o las variantes `UPSTASH_REDIS_REST_*`); el código lee ambas.
3. Añadir la variable de entorno `ADMIN_TOKEN` con un valor secreto (para descargar el CSV).
4. Redeploy.

Sin almacén configurado el sitio **no falla**: el contador muestra `—` y el formulario avisa que el sistema aún no está disponible.

## Descargar las firmas
`https://coderiobueno.cl/api/firmas?token=TU_ADMIN_TOKEN` → CSV.

## Dominio
En Vercel → Settings → Domains → añadir `coderiobueno.cl` y apuntar los nameservers/registros en NIC.cl según indique Vercel.
