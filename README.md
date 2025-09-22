# RentalApp


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

5. Flujo manual en el navegador:
   - Regístrate en `/login` y conserva el token.
   - Desde `/dashboard` crea una propiedad publicada.
   - Visita `/` y luego el detalle `/p/:id`.
   - Pulsa **Reservar**, paga con la tarjeta `4242 4242 4242 4242`.
   - Tras el pago se abrirá un contrato PDF con el texto "DEMO – sin validez legal".

## Deploy rápido

### API (Render/Railway)
Configura las variables:
- `MONGO_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CORS_ORIGIN=https://<vercel-front>`

### Frontend (Vercel)
- `REACT_APP_API_URL=https://<api-deploy>`

## Arranque local con Docker Compose (API + Mongo)

Para levantar la API y Mongo en local sin Nginx ni certificados, crea un `docker-compose.override.yml` junto al `docker-compose.yml` con el siguiente contenido. Docker lo cargará automáticamente al ejecutar `docker compose` y sobrescribirá los servicios necesarios para desarrollo:

```yaml
version: "3.9"

services:
  # Desactiva proxy y acme en local
  nginx-proxy:
    profiles: ["disabled"]
  acme-companion:
    profiles: ["disabled"]

  mongo:
    ports:
      - "27017:27017"   # acceso local opcional (Studio 3T, mongosh)
    volumes:
      - mongo_data:/data/db

  api:
    environment:
      NODE_ENV: development
      PORT: 3000
      MONGO_URI: "mongodb://mongo:27017/rentalapp"
      JWT_SECRET: "dev-secret"
      CLAUSE_POLICY_VERSION: "1.0.0"
      # quita variables de Nginx/LE si existen
      VIRTUAL_HOST: ""
      LETSENCRYPT_HOST: ""
      LETSENCRYPT_EMAIL: ""
    ports:
      - "3000:3000"     # http://localhost:3000
    command: ["npm","run","start:prod"]
```

> 💡 Si prefieres hot reload con `ts-node-dev`, cambia la línea del `command` por `command: ["npm","run","dev"]` (el script `dev` ya existe en el `package.json`).

Con el override guardado, arranca y observa los servicios con:

```bash
docker compose up -d --build
docker compose logs -f api
```

Pruebas rápidas:

- API → http://localhost:3000/health (alias: http://localhost:3000/api/health)
- Mongo (opcional) → mongodb://localhost:27017

Cuando termines:

```bash
docker compose down
# si quieres limpiar los datos persistidos de Mongo:
docker volume rm rentalapp_mongo_data
```

> 🔁 Si ya utilizas los puertos `3000` o `27017`, ajusta los mapeos en el override (`3001:3000`, `27018:27017`, etc.).

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
