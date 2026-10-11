# Auditoría de seguridad, fugas de datos, pagos y producto

- Fecha: 2026-10-05.
- Agente: Claude Code, con cinco agentes de análisis en paralelo y solo lectura.
- Revisión: los hallazgos críticos y altos se comprobaron leyendo el código antes de corregirlos.
- Estados:
  - **corregido**: arreglado en `claude/practical-planck-wizknd`, con test cuando aplica.
  - **pendiente**: sin tocar todavía.
  - **decisión**: necesita que Jorge elija.

## Críticos y altos

| # | Dónde | Problema | Estado |
|---|-------|----------|--------|
| S1 | `src/routes/ticket.routes.ts` `/validate` | Cualquier usuario verificado liberaba el escrow de cualquier ticket, y podía repetirlo creando ganancias duplicadas. | corregido. Solo el propietario, con el trabajo completado, y con paso atómico `held → releasing` (una sola liberación). |
| S2 | `ticket.routes.ts`: quote, extra, extra/decide, complete, assign, unassign, GET /:id | No se comprobaba que quien llama fuera parte del ticket. Un pro podía re-presupuestar un ticket ajeno y quedarse con él. | corregido (`loadTicketFor`). El profesional es parte del ticket solo cuando el propietario lo selecciona (`/assign`); solo entonces puede presupuestar. El presupuesto queda bloqueado tras el hold. `request-close` tenía el rol cambiado (landlord en vez de pro). |
| S3 | `ticket.routes.ts` POST / | `ownerId` y `propertyId` llegaban en el body: un inquilino abría tickets y chats con cualquier usuario y podía meter texto en el asistente de la víctima. | corregido. Ahora salen del contrato del inquilino. |
| S4 | `ticket.routes.ts` `/approve` | El `customerId` de Stripe venía en el body: se podía cargar el hold al cliente del inquilino. | corregido. Se usa el cliente Stripe del propietario; el del body solo se acepta con el driver mock, que está bloqueado en producción. |
| S5 | `src/routes/policy.routes.ts` | Cualquier usuario podía publicar o caducar versiones de las políticas legales y desactivar `requirePolicies` para todos. | corregido (`requireAdmin`). |
| S6 | `contract.terminate.controller.ts`, `contract.lifecycle.controller.ts` | Cualquier usuario verificado podía terminar o activar contratos ajenos. | corregido (`ensureCanReadContract`). |
| S7 | `GET /api/contracts` y `GET /api/contracts/:id` | Devolvían los enlaces de firma de las dos partes (permitía firmar como la otra) y `ibanEncrypted`. | corregido (`toContractView`). |
| S8 | `requestSignature` (Signaturit/DocuSign) | No comprobaba que el arrendador fuera el del contrato, y DocuSign devolvía los dos enlaces. | corregido. |
| S9 | `GET /api/properties` | `q` sin escapar en `$regex` (ReDoS en ruta pública), operadores Mongo en `city` y `sort` libre. Borradores y archivados visibles para todos. | corregido. Regex escapada, valores forzados a string y lista blanca de `sort`. El anónimo ve solo activos; el usuario con sesión, también los suyos. |
| S10 | `src/routes/pro.routes.ts` | `city` sin escapar en `RegExp` y `service` admitía operadores. | corregido. |
| S11 | `services/pdfGenerator.ts` + `requestSignature` | El PDF con DNI quedaba en `/uploads` (público) si fallaba Signaturit. | corregido. Se genera en el directorio temporal y se borra en `finally`. |
| S12 | `nginx/vhost.d/default` | nginx servía `/uploads/contracts/*` saltándose el bloqueo de Express. | corregido (`location ^~ /uploads/contracts/`). Producción usa `docker-compose.valeris.yml`, que no lleva nginx. |
| S13 | `property.controller.ts` `listApplications` | El arrendador recibía el expediente Tenant PRO completo de cada candidato (documentos, auditoría). | corregido. Solo recibe `status`, `maxRent` e `isActive`. |
| S14 | `oauth.service.ts` `sanitizeOAuthRedirect` | `?redirect=/%09/evil.com` era una redirección abierta tras el login. | corregido (rechaza caracteres de control y `\`). |
| S15 | `contract.actions.ts` `initiatePayment` | El importe lo elegía el cliente (`req.body.amount`). | corregido. Siempre se usa `contract.rent`. |
| P1 | `contract.routes.ts:58` tapa a `contract.payments.routes.ts` | `/:id/pay-rent` resuelve en el flujo sin transferencia al casero: las rentas se quedan en la cuenta de la plataforma y la comisión de agencia nunca se paga. | **decisión**: hay que decidir cuál es el flujo de cobro bueno. |
| P2 | `routes/serviceOffers.routes.ts` `accept-slot` | Marca la oferta como pagada y confirmada sin que el pago se haya confirmado. La ganancia se cuenta dos veces con el webhook. | corregido (2026-10-11, `claude/mejora-continua`). `accept-slot` solo crea el cobro (reclamo atómico `scheduled → payment_pending`); el webhook confirma la oferta y registra la ganancia una vez, con el intento vigente. |
| P3 | `contract.payment.controller.ts` (`createRentPaymentIntent`, `payRentForPeriod`), `payReceipt` | Doble cobro de renta por condición de carrera. `payment_failed` pasa `PAID` a `FAILED`. | corregido (2026-10-11, `claude/mejora-continua`). Reclamo atómico del recibo antes del PaymentIntent y reanudación del intento abierto; el webhook solo toca el intento vigente y nunca un `PAID`. Sigue pendiente el flujo `contract.payments.routes.ts` (tapado, ver P1). |
| P4 | `payDeposit` | Cada llamada crea un Checkout nuevo (fianza cobrada dos veces). `successUrl` y `cancelUrl` los elige el cliente. | corregido (2026-10-11). Se reutiliza la sesión abierta (`depositCheckoutSessionId` + clave de idempotencia) y las URLs las fija el servidor. |
| P5 | `utils/payment.ts` (escrow con Stripe real) | SEPA no admite `capture_method: manual`. La captura usa `application_fee` sin `transfer_data`. Al pro nunca se le transfiere. | pendiente. Hay que rediseñar el escrow antes de usarlo con dinero real. |
| A1 | `oauth.service.ts:213` | Secuestro de cuenta pre-creada: el registro no verifica el email y el login con Google se vincula a la cuenta del atacante. | corregido (2026-10-11, `claude/mejora-continua`). Si el correo no estaba verificado, al vincular se borran contraseña y token de recuperación. Queda el JWT ya emitido al atacante (hasta 7 días, ver A3). |
| A2 | `contract.controller.ts` create | Un landlord puede crear contratos con un inmueble o un propietario ajenos. | pendiente. Toca muchos tests que crean contratos con datos arbitrarios. |
| A3 | JWT | Sin revocación (7 días en `localStorage`). Rol y `isVerified` salen del token. | pendiente. |
| A4 | `agencyInvite.controller.ts` | La agencia recibe el token de invitación y puede aceptar ella misma la cuenta del propietario. | corregido (2026-10-11). El enlace solo va en el email; el token se guarda como SHA-256 y aceptar marca el correo como verificado. |
| D1 | `docker-compose.override.yml` | Con `docker compose up` sin `-f` publica Mongo sin contraseña, usa `JWT_SECRET=dev-secret` y `NODE_ENV=development`. | corregido el 2026-10-11: ahora es `docker-compose.dev.yml` y hay que pedirlo con `-f`; `docker-compose.override.yml` está en `.gitignore`. |
| D2 | `uploads/`, `storage/` en git | 298 ficheros commiteados pese al `.gitignore`, entre ellos una foto HEIC real de iPhone con EXIF. | **decisión**: borrarlos del índice y, si son datos reales, limpiar el historial. |
| D3 | `.dockerignore` | No excluye `.env.valeris`, `.env.*`, `uploads/` ni `storage/`: los secretos de producción entran en la imagen de build. | corregido el 2026-10-11 (`.env`, `.env.*` de la raíz, `uploads`, `storage`). Los `.env` de `frontend/` se mantienen: solo llevan `VITE_*` públicas. |

## Medios y bajos (pendientes)

- **Emails:** HTML con datos de usuario sin escapar (`utils/email.ts`; ~~invitaciones de agencia~~ corregido el 2026-10-11 con `utils/escapeHtml.ts`). Permite phishing con el remitente de la app.
- ~~**Exportaciones CSV:** inyección de fórmulas (`=HYPERLINK(...)`) en los CSV de ganancias, fiscal, admin e institución.~~ Corregido el 2026-10-11 con `utils/csv.ts` en los siete exportadores.
- **IA:** asistente y `/api/ai/*` sin límite de peticiones ni `maxOutputTokens`. `/api/ai/health?test=true` está abierto a cualquier usuario verificado.
- **Reseñas:** `relatedId` libre, así que se puede manipular la reputación de cualquiera.
- **Stripe, eventos:** reembolsos y disputas sin gestionar. `payment_intent.processing` puede devolver el estado a `PROCESSING`. Importes sin `Math.round` (`deposit.ts`).
- **Contraseñas:** ~~token de reset en claro en la BD y sin `select:false`; enlace a `https://frontend/reset`~~ corregido el 2026-10-11 (hash SHA-256, `select:false`, `FRONTEND_URL`). Sigue pendiente: enumeración de cuentas en el login ("Esta cuenta utiliza Google o Apple") y contraseña mínima de 6 caracteres.
- **Ficheros:** adjuntos de chat y avatares públicos y sin caducidad. El nombre se genera con `Math.random` y no se borra el EXIF.
- **Observabilidad:** `/metrics` es público y `/health` expone `NODE_ENV`. Hay PII en logs (emails y body de webhooks).
- **Mongo:** no hay `sanitizeFilter` global (`?status[$ne]=x`). El impacto es bajo porque los filtros ya están acotados al usuario.
- **Dependencias y plataforma:**
  - `npm audit` encuentra 8 avisos en la raíz (4 altos), 14 en el frontend (11 altos) y 2 en el portal institucional.
  - Node 20 y MongoDB 6 ya no tienen soporte.
  - `multer` 1.x y `@google/generative-ai` están obsoletos.
  - CI no tiene Dependabot, CodeQL ni `docker build`, y no corre en ramas.

## Producto: huecos detectados

| Área | Estado | Esfuerzo |
|------|--------|----------|
| Devolución de la fianza | No existe: el pago de la fianza no se guarda como `Payment`, así que no se puede reembolsar. | L |
| Depósito de la fianza ante la comunidad autónoma | Sin campos ni justificante. Solo cubre 3 comunidades y el texto de Madrid cita el IVIMA. | M |
| Actualización de renta por IPC/IRAV | No existe. | M-L |
| Vencimiento, prórroga y preavisos | Ningún job revisa `endDate`, así que se siguen generando recibos después del fin. `/renew` solo envía un email. | M-L |
| Recibos PDF de renta | No existen, aunque el art. 17.4 de la LAU los exige. `receiptUrl` usa `intent.charges`, que es un campo obsoleto. | S-M |
| Impagos | No hay estado `OVERDUE` ni recordatorios automáticos. | S-M |
| Notificaciones dentro de la app | No existen. Ni el pago de la renta ni el de la fianza avisan al arrendador. | M |
| Cambio de contraseña desde la cuenta | No implementado. | S |
