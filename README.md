# RentalApp

[![CI](https://github.com/jorgevarelarz/RENTALAPP/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jorgevarelarz/RENTALAPP/actions/workflows/ci.yml)

<p align="left">
  <a href="https://github.com/jorgevarelarz/RENTALAPP/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/jorgevarelarz/RENTALAPP/actions/workflows/ci.yml/badge.svg?branch=main" />
  </a>
</p>

## Cómo probar la demo

1. Copia las variables de entorno:
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```
   Rellena `MONGO_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET` y `CORS_ORIGIN=http://localhost:3001`.

2. Instala dependencias y ejecuta el seed:
   ```bash
   npm ci
   npm run seed
   npm run dev
   ```

3. En otra terminal, arranca el frontend:
   ```bash
   npm --prefix frontend ci
   npm --prefix frontend run dev
   ```

4. En una consola separada escucha los webhooks de Stripe:
   ```bash
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
   ```

   Nota: Stripe CLI mostrará un "Webhook signing secret" (por ejemplo, `whsec_...`).
   - Puedes exportarlo temporalmente: `export STRIPE_WEBHOOK_SECRET=whsec_xxx`
   - O añadirlo a tu `.env`. En producción este valor es obligatorio; si falta, la API devolverá `500 stripe_webhook_secret_missing` para evitar aceptar webhooks sin firma.

5. Flujo manual en el navegador:
   - Regístrate en `/login` y conserva el token.
   - Desde `/dashboard` crea una propiedad publicada.
   - Visita `/` y luego el detalle `/p/:id`.
   - Pulsa **Reservar**, paga con la tarjeta `4242 4242 4242 4242`.
   - Tras el pago se abrirá un contrato PDF con el texto "DEMO – sin validez legal".

## Deploy rápido

### Problemas conocidos con Railway (resueltos)

**Contexto:** Este proyecto está dividido en dos servicios independientes en Railway:
- Backend (API): Servicio RENTALAPP que expone solo rutas `/api/*`
- Frontend (SPA): Servicio separado que apunta al directorio `frontend/`

**Problemas que se presentaron:**

1. **Error 502 Bad Gateway en el backend:**
   - El servicio estaba corriendo pero el dominio público apuntaba a un puerto incorrecto
   - La aplicación escuchaba en un puerto diferente al configurado en Railway
   - **Solución:** Se configuró correctamente el puerto 8080 y se eliminó el dominio mal configurado, creando uno nuevo que detectó automáticamente el puerto correcto

2. **Intento fallido de servir el frontend desde el backend:**
   - Inicialmente se intentó que Express sirviera también el frontend estático
   - Esto generaba errores `ENOENT` buscando `frontend/dist/index.html` que no existía en el contenedor del backend
   - **Solución:** Se separó en dos servicios limpios: backend solo como API (sin servir HTML) y frontend como servicio independiente

3. **Errores de TypeScript en el build del frontend:**
   - El despliegue del frontend fallaba por tipos incompatibles (por ejemplo `tone: 'danger'` donde solo se aceptaba `success | error | info`)
   - Props que no existían en los tipos de componentes
   - **Solución:** Se corrigieron todos los errores de tipos en el código fuente y ahora el build completa correctamente

**Estado actual:**
- Backend: Servicio ACTIVE en Railway, funciona como API pura (puerto 8080)
- Frontend: Servicio ACTIVE en Railway, build exitoso
- **Importante:** Para que funcione correctamente end-to-end:
  - El frontend debe tener `VITE_API_URL` apuntando a la URL pública del backend
  - El backend debe tener `CORS_ORIGIN` configurado para permitir el dominio del frontend



### API (Render/Railway)
Configura las variables:
- `MONGO_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CORS_ORIGIN=https://<vercel-front>`

### Frontend (Vercel)
- `REACT_APP_API_URL=https://<api-deploy>`

## Feature flags de providers (mock vs real)

Para evitar “simular” cobros/firma/SMS en producción, el proyecto expone flags de proveedor:

- `ESCROW_DRIVER`: `mock` | `real`
  - Dev/Test: `mock` crea referencias ficticias.
  - Producción: si está en `mock`, las operaciones críticas (hold/release/deposit) responden 503 y NO cambian estado.
- `SIGN_PROVIDER`: `mock` | `signaturit` | `docusign` (o el que uses)
  - Dev/Test: `mock` permite flujo simulado.
  - Producción: si está en `mock`, bloqueará iniciar firma y la transición a "signed" (503) en callbacks.
- `SMS_PROVIDER`: `mock` | `twilio`
  - `mock`: no envía SMS; registra en consola.
  - `twilio`: requiere `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

Ejemplos de configuración

- Local (desarrollo):
  ```env
  ESCROW_DRIVER=mock
  SIGN_PROVIDER=mock
  SMS_PROVIDER=mock
  ```
- Producción (real):
  ```env
  ESCROW_DRIVER=real
  SIGN_PROVIDER=signaturit
  SMS_PROVIDER=twilio
  ```

Notas
- Si dejas un flag en `mock` en producción, la API devolverá 503 en los puntos críticos para evitar cambios de estado irreversibles.
- Los flags sólo bloquean en `NODE_ENV=production`. En dev/test siguen funcionando los mocks.

## Tenant PRO (solvencia verificada)

Flujo y visibilidad
- Consentimiento y subida: desde el panel del inquilino en `/tenant-pro` el usuario acepta el consentimiento y sube documentación (nómina/contrato/renta/autónomo/otros).
- Estados: `pending` (en revisión), `verified` (badge PRO), `rejected`.
- Badge PRO: se muestra junto al inquilino con “PRO · Hasta {maxRent} €/mes” cuando está verificado.
- Only PRO: las propiedades marcadas como Only PRO muestran una etiqueta en la card y en la ficha. Al aplicar:
  - Si no es PRO, la UI guía al flujo `/tenant-pro` (y el backend también valida el acceso al aplicar).
  - Si es PRO pero su límite es inferior al precio, se informa (puede aplicar, decisión del propietario).

Límites y RGPD
- Tipos de archivo permitidos: PDF, JPG/JPEG, PNG.
- Tamaño máximo: 10 MB por archivo.
- Conservación (TTL): configurable vía `TENANT_PRO_DOCS_TTL_DAYS` (por defecto 365). La API expone `ttlDays` en `GET /api/tenant-pro/me` para mostrar el microcopy en el front.
- Eliminación: desde el perfil, el usuario puede purgar su documentación PRO.

Búsqueda y filtros
- Backend: el listado de propiedades acepta `?onlyTenantPro=true` (alias: `?onlyPro=true`) para devolver solo anuncios Only PRO.
- Frontend: añade/usa el toggle “Solo PRO” cuando proceda (p. ej., gestión de candidaturas del propietario).

API relevante
- `POST /api/tenant-pro/consent` — acepta el consentimiento (requiere rol tenant).
- `POST /api/tenant-pro/docs` — sube documento (rol tenant, `multipart/form-data` con `file` y `type`).
  - Errores normalizados:
    - 400 `{ code: "file_required" | "unsupported_mime" | "bad_type", message }`
    - 413 `{ code: "file_too_large", message: "Archivo demasiado grande (máx 10 MB)." }`
- `GET /api/tenant-pro/me` — devuelve estado PRO y `ttlDays`.

Configuración
- `TENANT_PRO_DOCS_TTL_DAYS`: días de retención de documentos (ej. 365).
- CORS: asegúrate de incluir el origen del front (por defecto `http://localhost:3001`).


## Arranque local con Docker Compose (API + Mongo)

Para levantar la API y Mongo en local sin Nginx ni certificados usa `docker-compose.dev.yml`, que desactiva el proxy y los certificados, publica Mongo en `27017` y fija un `JWT_SECRET` de prueba. **No lo uses en un servidor**: Mongo queda expuesto sin contraseña.

Docker no lo carga solo (no se llama `docker-compose.override.yml` precisamente para que un `docker compose up` sin `-f` en un servidor no lo aplique), así que hay que pasarlo con `-f`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f api
```

> 💡 Si prefieres hot reload con `ts-node-dev`, cambia el `command` del servicio `api` en `docker-compose.dev.yml` por `["npm","run","dev"]`.

Pruebas rápidas:

- API → http://localhost:3000/health (alias: http://localhost:3000/api/health)
- Mongo (opcional) → mongodb://localhost:27017

Cuando termines:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
# si quieres limpiar los datos persistidos de Mongo:
docker volume rm rentalapp_mongo_data
```

> 🔁 Si ya utilizas los puertos `3000` o `27017`, ajusta los mapeos en `docker-compose.dev.yml` (`3001:3000`, `27018:27017`, etc.).

## Staging/Producción con Nginx proxy + HTTPS (Let’s Encrypt)

### Requisitos previos
1. Crea un registro DNS A que apunte al servidor (IP pública):
   - `api.tudominio.com → {IP_DEL_SERVIDOR}`
2. Abre los puertos 80 (HTTP) y 443 (HTTPS) en el servidor.

### 1) Red Docker
Crea una red compartida para el proxy y los servicios:

```bash
docker network create nginx-proxy
```

### 2) `docker-compose.yml` (staging/prod)
Reemplaza el anterior por este (o crea `docker-compose.staging.yml`):

```yaml
version: "3.9"

networks:
  nginx-proxy:
    external: true

volumes:
  mongo_data:
  nginx_certs:
  nginx_vhost:
  nginx_html:
  nginx_acme:

services:
  # Reverse proxy + HTTPS automático
  nginx-proxy:
    image: nginxproxy/nginx-proxy:alpine
    container_name: nginx-proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - nginx_certs:/etc/nginx/certs
      - nginx_vhost:/etc/nginx/vhost.d
      - nginx_html:/usr/share/nginx/html
      - /var/run/docker.sock:/tmp/docker.sock:ro
    networks:
      - nginx-proxy

  acme-companion:
    image: nginxproxy/acme-companion
    container_name: acme-companion
    restart: unless-stopped
    environment:
      DEFAULT_EMAIL: "${LETSENCRYPT_EMAIL}"
    volumes:
      - nginx_certs:/etc/nginx/certs
      - nginx_vhost:/etc/nginx/vhost.d
      - nginx_html:/usr/share/nginx/html
      - nginx_acme:/etc/acme.sh
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - nginx-proxy
    networks:
      - nginx-proxy

  mongo:
    image: mongo:6
    container_name: rental_mongo
    restart: unless-stopped
    expose:
      - "27017"
    volumes:
      - mongo_data:/data/db
    networks:
      - nginx-proxy
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "mongodb://localhost:27017", "--eval", "db.runCommand({ ping: 1 }).ok"]
      interval: 10s
      timeout: 5s
      retries: 10

  api:
    build: .
    container_name: rental_api
    restart: unless-stopped
    depends_on:
      mongo:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      MONGO_URI: "mongodb://rental_mongo:27017/rentalapp"
      JWT_SECRET: "${JWT_SECRET}"
      CLAUSE_POLICY_VERSION: "1.0.0"

      # >>> Config para nginx-proxy + Let's Encrypt
      VIRTUAL_HOST: "${API_HOST}"          # ej: api.tudominio.com
      VIRTUAL_PORT: "3000"
      LETSENCRYPT_HOST: "${API_HOST}"
      LETSENCRYPT_EMAIL: "${LETSENCRYPT_EMAIL}"
      # <<<

    expose:
      - "3000"
    networks:
      - nginx-proxy
    command: ["npm","run","start:prod"]
```

Notas:
- No publicamos el puerto 3000 al host; lo expone Nginx.
- nginx-proxy + acme-companion generan y renuevan certificados automáticamente.

### 3) Variables de entorno
Crea `.env.staging` en la raíz:

```bash
API_HOST=api.tudominio.com
LETSENCRYPT_EMAIL=tu-email@tudominio.com
JWT_SECRET=cambia-esto-por-uno-fuerte
```

> ⚠️ No subas a git este archivo con secretos reales.

### 4) Comandos de despliegue

```bash
# (una vez) crear la red
docker network create nginx-proxy 2>/dev/null || true

# levantar en segundo plano usando el .env.staging
docker compose --env-file .env.staging -f docker-compose.yml up -d --build

# ver logs del proxy y la api
docker compose logs -f nginx-proxy
docker compose logs -f api
```

- La primera vez, Let’s Encrypt tardará ~30–60s en emitir el certificado.
- Prueba: `https://api.tudominio.com/api/health` → `{ ok: true }` en HTTPS.

### 5) Healthcheck opcional para la API (recomendado)
Si tienes un endpoint de salud, añade en `api`:

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
  interval: 15s
  timeout: 5s
  retries: 5
```

### 6) Renovación de certificados
- La renovación es automática por `acme-companion`.
- Para ver el estado: `docker compose logs -f acme-companion`.

### 7) Criterios de aceptación
- `https://api.tudominio.com` sirve la API con candado verde.
- Redirección automática de HTTP → HTTPS.
- Los reinicios del host conservan certificados (`nginx_certs`, `nginx_acme`).
- `mongo` no expone puerto público (solo `expose`, accesible en la red Docker).

## Datos de prueba
Tarjeta: `4242 4242 4242 4242`, fecha futura y CVC cualquiera.

Tarjetas de prueba adicionales: [Stripe testing docs](https://stripe.com/docs/testing).
# RentalApp

## Quickstart

Backend
```
cp .env.example .env
npm ci && npm run dev
curl -s http://localhost:3000/health
```

Frontend
```
cp frontend/.env.example frontend/.env
npm --prefix frontend ci
npm --prefix frontend start
```

Stripe (test)
```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Puertos & URLs
- Backend: http://localhost:3000
- Frontend (CRA): http://localhost:3001
- Webhook Stripe: POST /api/stripe/webhook

## Matriz RBAC (resumen)
- Landlord: crear/editar/publish propiedades; aprobar/validar tickets; iniciar firma contrato.
- Tenant: aplicar a propiedad; pagar/depositar; abrir/resolve ticket; flujo Tenant PRO.
- Pro: cotizar/completar trabajos; solicitar extras.
- Admin: paneles admin (revisión PRO, métricas…).
- Webhooks/callbacks (Stripe, signature): sin auth; firma verificada en Stripe.

## Scripts & Tests
- `npm test` (backend completo)
- `npm run test:rbac`
- `npm run test:frontend`
- `npm run dev:all` (arranca back y front con concurrently -k)

## Firma electrónica (mock vs DocuSign)

Soporte de firma electrónica con proveedor conmutable por flag.

- Flags/ENV:
  ```env
  SIGN_PROVIDER=mock|docusign
  SIGN_EMBEDDED=false
  DOCUSIGN_BASE_URL=https://demo.docusign.net
  DOCUSIGN_INTEGRATOR_KEY=...
  DOCUSIGN_USER_ID=...
  DOCUSIGN_ACCOUNT_ID=...
  DOCUSIGN_AUTH_METHOD=jwt
  DOCUSIGN_PRIVATE_KEY_BASE64=...
  DOCUSIGN_WEBHOOK_SECRET=...
  ```

- Flujo de firma:
  1) Inicio: `POST /api/contracts/:id/signature` (roles: landlord/admin)
  2) Callback Connect: endpoint sin auth, protegido con HMAC `X-DocuSign-Signature-1` → actualiza `signature.status`.
     - Si `completed`: guarda PDF firmado en `storage/contracts-signed/...` y calcula `signature.pdfHash`.
  3) Descarga: `GET /api/contracts/:id/pdf/signed` (solo landlord/tenant del contrato o admin)

- Verificación del PDF:
  ```bash
  shasum -a 256 path/to/signed.pdf
  # Debe coincidir con signature.pdfHash
  ```

- Dev vs Prod:
  - Dev: `SIGN_PROVIDER=mock` (no usa DocuSign).
  - Prod (DocuSign): todas las `DOCUSIGN_*` son obligatorias; si falta alguna, el inicio de firma devuelve `500`.

- Embedded signing (opcional):
  - Activar con `SIGN_EMBEDDED=true`.
  - La respuesta de inicio puede incluir `recipientUrls` para propietario/inquilino.
