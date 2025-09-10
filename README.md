# RentalApp

## Cómo probar la demo

1. Copia las variables de entorno:
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```
   Rellena `MONGO_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET` y `CORS_ORIGIN=http://localhost:5173`.

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
   stripe listen --forward-to localhost:4000/api/stripe/webhook
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
- `VITE_API_URL=https://<api-deploy>`

## Datos de prueba
Tarjeta: `4242 4242 4242 4242`, fecha futura y CVC cualquiera.
