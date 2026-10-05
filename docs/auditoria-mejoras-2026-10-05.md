# Auditoría de mejoras: limpieza, escalabilidad y frontend

- Fecha: 2026-10-05
- Agente: Claude Code (tres agentes de análisis en paralelo, solo lectura)
- Estado: **backlog sin empezar**. Ninguno de estos puntos se ha corregido todavía. Cada hallazgo se comprobó leyendo el código, pero conviene volver a revisarlo antes de tocarlo.
- Esfuerzo: S = pequeño, M = medio, L = grande.

## 1. Fallos reales que se arreglan en minutos (prioridad)

| Área | Dónde | Problema | Esfuerzo |
|------|-------|----------|----------|
| Frontend | `frontend/src/utils/notify.tsx:57`, `TicketCreatePage.tsx:20`, `TicketDetail.tsx:46` | `useNotify()` lanza un error sin `NotificationsProvider`, y ese provider no se monta en ningún sitio: `/tickets/new` y `/tickets/:id` fallan al abrirse. | S |
| Frontend | `frontend/src/api/client.ts:64`, `CopyLinkButton.tsx:13` | `require('react-hot-toast')` dentro de Vite/ESM; el `catch {}` se traga el error, así que el aviso global de errores de la API no aparece nunca. | S |
| Frontend | `TenantProPanel.tsx`, `AdminAuditDashboard.tsx`, `PropertyDetail.tsx` | Usan `toast` de react-hot-toast, pero no hay ningún `<Toaster/>` montado: los avisos no se ven. | S |
| Frontend | `components/PolicyModal.tsx:26` | `type.replace('_','-')` solo cambia el primer `_`: los enlaces de términos y de tratamiento de datos dan 404. | S |
| Frontend | `pages/tickets/TicketCreatePage.tsx:56` | Llama a `POST /api/notify/email`, que es solo para admin: para un inquilino siempre devuelve 403. | S |
| Frontend | `hooks/usePolicyAcceptance.ts:15` | Lee `localStorage.token`, una clave que nunca se escribe. Sin argumento, no comprueba nada. | S |
| Backend | `src/routes/chat.routes.ts:378` | `limit` viene del cliente sin tope. | S |
| Backend | `src/controllers/property.controller.ts:333` | `?page=abc` da `NaN` en `skip`/`limit`. | S |
| Backend | `src/controllers/property.controller.ts:172-182` | Los emails de alerta se envían en serie dentro del PUT y se pasa `userId` como `userEmail` (posible bug funcional). | S |
| Backend | `src/app.ts:420-435` | Con `RUN_SEED=true`, el seed de demo se ejecuta también en producción; `env.ts` no lo bloquea. | S |
| Backend | `src/identity/stripeIdentity.ts` | La verificación KYC es un stub (siempre `verified`) y está montada en producción en `/api/kyc`. | S |

## 2. Escalabilidad

| Dónde | Problema | Duele desde | Esfuerzo |
|-------|----------|-------------|----------|
| `models/payment.model.ts` | Faltan índices en `payer`, `payee` y `contract`. Propuesta: `{payer:1,createdAt:-1}`, `{payee:1,status:1,paidAt:-1}`, `{contract:1,status:1,paidAt:-1}`, y paginar `getMyPayments`. | ~50k pagos | S |
| `models/ticket.model.ts` | Ningún índice. Propuesta: `{ownerId,createdAt}`, `{openedBy,createdAt}`, `{proId,createdAt}`, `{contractId}`. | ~20k tickets | S |
| `models/history.model.ts` | Falta el índice `{contract:1,timestamp:1}`. | ~100k entradas | S |
| `models/contract.model.ts` | Faltan índices `{property,status}`, `{status,startDate}`, `{landlord,createdAt}`, `{tenant,createdAt}`. | ~50k contratos | S |
| `app.ts:396` + `systemEventsRetention.service.ts` | Cada visita hace un `SystemEvent.create` con await y la retención no se ejecuta nunca: la colección crece sin límite. Propuesta: índice TTL de 90 días para `FUNNEL_*` y registrar la visita sin await. | ~100k visitas al mes | S |
| `docker-compose.yml:87` | Solo monta `uploads_data`: **`storage/` (PDFs firmados y de auditoría, documentos Tenant-PRO) se pierde al recrear el contenedor**. `docker-compose.valeris.yml` sí lo monta. Comprobar qué compose se usa en producción. | ya | S |
| `app.ts:149` (node-cron) | Los jobs se ejecutan en cada instancia. Con dos réplicas, `rentGeneration` se ejecuta dos veces y un E11000 aborta el resto del bucle. Propuesta: lock en Mongo o `RUN_JOBS=true` en una sola réplica, y try/catch por contrato. | 2.ª instancia | S-M |
| Ficheros en disco local (`uploads/`, `storage/`) | Con varias instancias, cada una ve solo sus ficheros. Propuesta: S3/R2 con URLs firmadas. | 2.ª instancia | M-L |
| SSE de admin (`auditTrail.events.ts`) y rate limiters en memoria | No funcionan con varias instancias; los Maps del chat nunca borran claves. | 2.ª instancia | M |
| `utils/history.ts:56` | El historial se guarda duplicado: embebido en el contrato (`$push`) y en la colección. Los listados cargan el documento completo. Propuesta: proyectar `-history -signature.events`. | contratos largos | M |
| Generación de PDF y hash en el request (`contract.controller.ts:139`, `admin.controller.ts:203`) | Bloquea el event loop; el ZIP de admin genera hasta 200 PDFs en serie. | decenas de usuarios concurrentes | M |
| `property.controller.ts:313` | Búsqueda con `$regex` sin ancla, `sort` libre del cliente y `countDocuments` en cada búsqueda. | ~20k propiedades | M |
| `rentSuggestion.service.ts:141` | Trae todos los comparables de la ciudad sin límite. | ciudades grandes | S-M |
| `jobs/tenantProRetention.ts` | La purga de documentos Tenant-PRO nunca se programa. | ya (RGPD) | S |
| `bcryptjs` | Hash en JS puro en el hilo principal (~80 ms). Propuesta: `bcrypt` nativo o `argon2`. | ~20 logins/s | S |
| Consultas y CSV sin paginar (`admin.controller.ts:72`, `systemEvents.service.ts:44`, etc.) | Cargan colecciones enteras en memoria. | ~10k registros | S-M |

## 3. Limpieza del backend

- **Errores 5xx que exponen `error.message` (unos 60 sitios)** y saltan `middleware/errorHandler.ts`. Propuesta: `asyncHandler` + `next(err)`, fichero a fichero, empezando por `admin` y `verification`. Unificar el formato de error como `{error, message?, requestId}`. M, riesgo medio porque el frontend lee esos textos.
- **Código muerto:**
  - `middleware/validation.middleware.ts`;
  - `createContractAction` (`services/contract.actions.ts:33-199`);
  - `depositToAuthority`, `getPendingContracts`, `readDecryptedTP`, `sendSMS` (alias);
  - `models/signatureRequest.model.ts`;
  - `middleware/auth.ts` (alias usado solo en `policy.routes.ts`).
- **Duplicados:**
  - dos clientes Stripe (`utils/payment.ts` y `utils/stripe.ts`);
  - `requireAdmin` frente a `authorizeRoles('admin')`;
  - paginación copiada unas 8 veces (crear un helper `parsePagination`);
  - `user?._id || user?.id` a mano en lugar de `getUserId`;
  - dos generadores de PDF de contrato (`services/pdfGenerator.ts` y `utils/pdfGenerator.ts`).
- **Logs:** unas 110 llamadas a `console.*` en lugar del logger pino; `morgan('dev')` está activo en producción.
- **Dependencias:**
  - `@aws-sdk/client-s3` sin uso;
  - `@types/helmet` obsoleto;
  - `@types/archiver` debería ir en devDependencies.
- **Refactor:** `taxReport.controller.ts:204` usa un `fakeRes` para reutilizar el handler. Mejor extraer `buildTaxReport()`.

## 4. Limpieza del frontend

- **Tres sistemas de toast.** Dejar solo `ToastContext` + un helper `notifyError(err)` basado en `formatApiError`.
- **El token se lee de cuatro formas** (interceptor, `axios.defaults`, parámetro `token` en los services, `localStorage.token`). Dejar solo el interceptor.
- **Código muerto:** unas 1.340 líneas sin importar ni enrutar (`Layout`/`NavBar`/`Sidebar`/`Footer`, `AppLayout`, varias páginas y pasos del wizard antiguos, `utils/format`, `utils/jwt`, `reportWebVitals`). También hay funciones de services sin uso y dos endpoints que ya no existen (`/tickets/:id/dispute`, `/dev-verify`).
- **Cabeceras:** `x-admin` y `x-user-id` se envían, pero el backend no las usa.
- **Llamadas a la API dentro de las páginas** (`Applications.tsx` repite la misma tres veces, `LandlordDashboard`, `AdminAuditDashboard`, `Earnings`). Moverlas a `services/` o a hooks de react-query.
- **Componentes grandes:** `PropertyFormRHF` (590 líneas), `LandlordDashboard` (499), `AdminAuditDashboard` (433)…
- **Ruta de testing:** `/testing/inbound` está enrutada en producción aunque el backend no la monta.
- **Dependencias:**
  - `@headlessui/react`, `clsx` y `web-vitals` sin uso;
  - librerías de test y de build en `dependencies`;
  - el lint es un `echo`, así que no hay ESLint.
- **`institution-frontend/src/App.tsx`:** todo en un solo archivo, no trata el 401 y usa React 18 frente a React 19 en `frontend`. El build no ejecuta `tsc`.
