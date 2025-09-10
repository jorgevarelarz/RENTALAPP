# RentalApp

## Vertical slice – cómo probarlo

1. Instala dependencias y configura variables de entorno usando `.env.example` y `frontend/.env.example`.
2. Lanza el backend:
   ```bash
   npm run dev
   ```
3. Lanza el frontend:
   ```bash
   npm --prefix frontend run start
   ```
4. En el navegador:
   - Regístrate en `/login` y guarda el token.
   - Desde `/dashboard` crea una propiedad publicada.
   - Visita la lista pública en `/` y entra al detalle `/p/:id`.
   - Pulsa **Reservar** y realiza un pago de prueba con tarjeta `4242 4242 4242 4242` (fecha futura, CVC cualquiera).
   - Tras el pago se abrirá un contrato PDF con el texto "DEMO – sin validez legal".

Tarjetas de prueba adicionales: [Stripe testing docs](https://stripe.com/docs/testing).
