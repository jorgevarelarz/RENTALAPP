# Mejora continua de RentalApp 2.3

Registro de las rondas del trabajador autónomo en la rama `claude/mejora-continua`
(worktree `~/.claude-control/worktrees/rentalapp-mejora`, base `claude/practical-planck-wizknd`, PR #46).
Producción no se toca desde aquí.

## Para Jorge

Decisiones que el trabajador no toma y que siguen abiertas:

- **P1 `/pay-rent`**: resuelve al flujo que no transfiere la renta al casero ni paga la comisión de agencia. Hay que elegir el flujo de cobro bueno (`docs/auditoria-seguridad-2026-10-05.md`).
- **D2**: 298 ficheros de usuario en git (`uploads/`, `storage/`), entre ellos una foto HEIC real con EXIF. ¿Quitarlos del índice y limpiar el historial?
- **Escrow con Stripe real (P5)**: hay que rediseñarlo antes de usar dinero real.
- **Firma.dev**: activarlo (`FIRMA_API_KEY`, `FIRMA_WEBHOOK_SECRET` en el servidor).
- **Datos legales** (razón social, NIF), **precios** y **carga de datos en producción**.
- **TTL de `SystemEvent`**: cuántos días se conservan las visitas.
- **Al desplegar la ronda 1**: comprobar que `FRONTEND_URL=https://app.rentalapp.es` está en el entorno de producción; el enlace de recuperación de contraseña depende de ello (sin la variable usaría `APP_URL` o `localhost`). Los tokens de recuperación emitidos antes del despliegue dejan de valer (ahora se guarda su hash); caducan en una hora, así que el efecto es mínimo.
- **Ronda 4, cambio de producto**: la agencia ya no puede «Copiar enlace» de invitación (era justo la vulnerabilidad A4). Si quiere ofrecer un reenvío, habría que añadir un botón «Reenviar invitación» que vuelva a mandar el email al propietario.
- **Al desplegar la ronda 2**: si en producción existen `DEPOSIT_SUCCESS_URL` o `DEPOSIT_CANCEL_URL`, mandan sobre las URLs nuevas (`FRONTEND_URL/contracts/<id>?deposit=success|cancel`); conviene borrarlas o comprobar que apuntan a app.rentalapp.es. El cambio de cobros no necesita migración.
- **Al desplegar la ronda 9**: las consultas a la IA (asistente Clara y descripción de anuncios) quedan limitadas a 30 cada 15 minutos por usuario. Si te parece poco o mucho, se cambia con `AI_RATE_LIMIT_MAX` en el entorno, sin tocar código.
- **Al desplegar la ronda 11**: `/metrics` deja de ser público. Si algo lo lee (Prometheus, un panel), hay que poner `METRICS_TOKEN` en el entorno y mandar `Authorization: Bearer <token>`; sin la variable, `/metrics` da 404. `/health` ya no devuelve `env`. Si en producción no está `STRIPE_IDENTITY_WEBHOOK_SECRET`, el webhook de `/api/kyc` responde 503 (hoy la verificación de identidad es un stub y nadie lo usa).
- **Co-titulares (ronda 12), dos decisiones de producto:**
  - «Firmar como co-titular» solo cambia el estado en la base (`POST /tenants/:partyId/sign`, backend de antes); no es una firma electrónica con proveedor. ¿Vale así o el co-titular debe firmar con Firma.dev como el inquilino principal?
  - Aceptar la invitación exige tener la identidad verificada (`requireVerified` está en toda `/api`). La página lo explica y enlaza a `/tenant/kyc`, pero ¿debe poder unirse antes y verificar después?

### Ronda 1 — 2026-10-11 04:55

**Qué y por qué.** Lote de seguridad de cuentas, lo más grave pendiente que no estaba reservado:

1. **A1, secuestro de cuenta pre-creada** (alto). El registro con contraseña no verifica el correo. Un atacante podía registrarse con el email de la víctima; cuando la víctima entraba con Google, `resolveSocialUser` vinculaba la identidad a esa cuenta y el atacante seguía entrando con su contraseña. Ahora, si la cuenta no tenía `emailVerifiedAt`, al vincular el proveedor se borran `passwordHash`, `resetToken` y `resetTokenExp`. Si la contraseña era del titular legítimo, puede recuperarla con «He olvidado mi contraseña».
2. **Recuperación de contraseña rota e insegura** (P0-06 del plan de apertura, y punto medio de la auditoría). El email apuntaba a `https://frontend/reset`, un dominio escrito a mano, así que el flujo no funcionaba en producción. Además, el token se guardaba en claro y salía en cualquier consulta de usuarios. Ahora:
   - el enlace se construye con `frontendUrl()`, nuevo `src/utils/frontendUrl.ts` compartido con el login OAuth;
   - se guarda solo el SHA-256 del token, con `select:false`, y es de un solo uso;
   - restablecer la contraseña marca el correo como verificado;
   - el email está en español.

**Commits.**
- `2a0fbff` Recuperación de contraseña: enlace con FRONTEND_URL y token guardado como hash
- `9c06e29` OAuth: anular la contraseña de cuentas sin correo verificado al vincular (A1)

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. `tsc -p tsconfig.spec.json` sin errores en los ficheros tocados (corregido de paso un tipado en `reset.test.ts`).
- Jest `--runInBand`:
  - `tests/auth`: 2 suites, 12 tests OK. Casos nuevos: hash guardado y enlace al frontend configurado, un solo uso, el hash no vale como token, contraseña anulada en una cuenta sin verificar, contraseña conservada si el correo ya estaba verificado.
  - `tests/unit/oauthRedirect.test.ts`: 4 OK.
  - `tests/e2e/smoke.e2e.test.ts` (config e2e): 9 OK, incluido el reset completo, que ahora lee el token del email simulado.
- Frontend (sin cambios): `npm --prefix frontend run build` OK; `npm --prefix frontend test` 15 ficheros, 30 tests OK.
- GitNexus: `impact` LOW en `resolveSocialUser`, `requestPasswordReset` y `resetPassword`. `detect_changes` solo afecta al flujo `RequestPasswordReset → DeliverEmail` y a `userSchema` (`select:false`; el único otro uso de `resetToken` en `user.controller` ya lo descartaba).

**Qué queda.**
- A3: el JWT que ya tuviera el atacante sigue valiendo hasta 7 días; no hay revocación. Haría falta un `tokenVersion` en el usuario comprobado en `authenticate`, y eso cambia la ruta caliente de autenticación.
- Contraseña mínima de 6 caracteres, sin límite de intentos en `/reset` y enumeración de cuentas en el login (P1-17).
- `sendEmail` sigue devolviendo éxito aunque falle el SMTP (P0-07).

**Siguiente mejora propuesta.** Cobros duplicados P3 y P4: condición de carrera en el cobro de la renta, `payment_failed` que pasa `PAID` a `FAILED`, y fianza que crea un Checkout nuevo en cada llamada con `successUrl` elegido por el cliente. No dependen del rediseño del escrow (P5) ni de la decisión P1. Si se prefiere algo más corto: A4, el token de invitación de agencia que se devuelve a la propia agencia.

### Ronda 2 — 2026-10-11 05:08

**Qué y por qué.** P3 y P4 de la auditoría de seguridad: cobros duplicados de renta y fianza. Era lo más grave pendiente que no dependía de Jorge (no toca la decisión P1 ni el escrow P5).

1. **Renta** (`/pay-rent` y `/payments/:period/pay`). Dos pulsaciones seguidas o dos pestañas creaban dos PaymentIntent para el mismo mes. Ahora `src/services/rentPaymentAttempt.service.ts` reclama el recibo con un paso atómico `DUE/FAILED → PROCESSING` antes de llamar a Stripe; solo una petición lo consigue. Además:
   - si ya hay un intento abierto, se reanuda y se devuelve su `clientSecret` (antes el inquilino se quedaba sin poder pagar si cerraba la página);
   - si Stripe falla al crear el intento, el reclamo se deshace;
   - un reclamo abandonado más de 5 minutos se puede retomar;
   - el reintento tras un pago fallido daba 500 (E11000 en el índice único de `Payment` por mes); ahora reutiliza el `Payment` del mes.
2. **Recibos** (`/api/payments/:id/pay`, `payReceipt`). El mismo reclamo atómico; la petición que pierde la carrera recibe 409 y la siguiente reanuda el intento.
3. **Webhook de Stripe.** `payment_failed` y `processing` solo afectan al intento vigente (`providerPaymentId`) y nunca a un recibo `PAID`. `payment_failed` marca también el `Payment` como `failed`.
4. **Fianza** (`payDeposit`). Cada llamada abría un Checkout nuevo y las URLs de vuelta las elegía el cliente. Ahora se guarda `depositCheckoutSessionId` (`select:false`) y se reutiliza la sesión mientras siga abierta; si ya se completó responde 409. La creación lleva una clave de idempotencia derivada de la sesión anterior, así que dos peticiones simultáneas reciben la misma sesión. Las URLs salen de `FRONTEND_URL` y el importe se redondea a céntimos.

**Commits.**
- `3abc4f8` Pagos: evitar cobros duplicados de renta, recibos y fianza (P3, P4)

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores; `tsc -p tsconfig.spec.json` sin errores en los ficheros tocados.
- Jest `--runInBand`:
  - nuevo `tests/contracts/payments.duplicates.test.ts`: 7 OK (peticiones simultáneas en los tres flujos, fallo de Stripe, fallo y reintento con webhook firmado, fallo tardío sobre `PAID`, fianza reutilizada, caducada y completada);
  - `tests/contracts` y `tests/jobs`: 16 suites, 57 tests OK;
  - e2e `smoke.e2e.test.ts`: 9 OK, incluido el cobro de renta con webhook firmado.
- Frontend: build OK; 15 ficheros, 30 tests OK. Solo cambia el tipo de respuesta de `payDeposit` (`sessionUrl`).
- GitNexus: `impact` LOW en `depositToEscrow`, `payRentForPeriod`, `createRentPaymentIntent` y `payReceipt` (solo los llaman las rutas). `detect_changes` da riesgo alto por número de símbolos, pero los flujos afectados son los de pago previstos; `initiatePayment`, `getMyPayments` y `depositToAuthority` salen solo por el desplazamiento de líneas.

**Qué queda.**
- El flujo `contract.payments.routes.ts` (tapado por P1) no tiene estos arreglos; se aplicarán cuando Jorge elija el flujo bueno.
- Ningún botón de la interfaz llama a `POST /contracts/:id/deposit`: «Pagar fianza» solo lleva al detalle del contrato. Falta conectar el pago de la fianza en la interfaz.
- Si el `Payment` del mes ya consta como `succeeded` por otro flujo pero el `RentPayment` no está `PAID`, el upsert daría 500. Es un caso raro, sin arreglar.
- `utils/payment.ts` y `utils/stripe.ts` siguen siendo dos clientes Stripe distintos (duplicado de la auditoría de mejoras).
- En tests sin clave de Stripe, la reanudación intenta un `retrieve` real; el error se captura y se responde `PROCESSING`.

**Siguiente mejora propuesta.** Una ronda de interfaz, que llevamos dos rondas sin tocar: conectar «Pagar fianza» en el detalle del contrato (redirigir a `sessionUrl` y mostrar el aviso al volver con `?deposit=success|cancel`). Así se cierra el flujo que esta ronda ha dejado seguro en el backend. Si se prefiere seguridad: A4 (token de invitación de agencia) y P2 (`accept-slot` marca pagada una oferta sin pago).

### Ronda 3 — 2026-10-11 05:16

**Qué y por qué.** Ronda de interfaz: llevábamos dos rondas sin tocarla, y así se cierra el flujo de la fianza que la ronda 2 dejó seguro en el backend. Hasta ahora ningún botón llamaba a `POST /contracts/:id/deposit`: el inquilino no tenía forma de pagar la fianza desde la app. Cambios en `frontend/src/pages/ContractDetail.tsx`:

1. **Pagar fianza.** El inquilino ve el botón «Pagar fianza · 1900,00 €» en la cabecera cuando el contrato está firmado o activo y la fianza no consta como pagada. El botón redirige a la `sessionUrl` de Stripe Checkout. Si el servidor responde con error (por ejemplo, el 409 «se está confirmando»), se muestra su mensaje.
2. **Vuelta desde Stripe.** Con `?deposit=success` aparece un aviso de que se está confirmando el cobro, con botón «Actualizar estado» (sin sondeo automático, como piden los tests de polling). Si el webhook ya llegó, el aviso es «Fianza pagada». Con `?deposit=cancel` el aviso dice «cancelado, sin cargo» y el botón sigue disponible. El parámetro se borra de la URL.
3. **Fallos visibles que había en la misma página:**
   - leía `rentAmount`/`depositAmount`, campos que el API no envía, así que la fianza salía «undefined €»; ahora usa `rent`/`deposit` con formato es-ES;
   - la ciudad estaba fija en «Madrid» y las fechas de las cláusulas salían en ISO crudo;
   - el documento mostraba una firma falsa, una imagen enlazada de Wikimedia; ahora pone «Firmado electrónicamente · fecha» o «Pendiente de firma electrónica»;
   - el botón decía «Firmar con Signaturit» aunque el proveedor sea Firma.dev;
   - las tarjetas «Siguiente acción», «Resumen» e «Intervinientes» no tenían relleno y los botones partían el texto en dos líneas.
4. En `ActiveContractWidget`, el botón «Pagar fianza» del panel tenía un verde fijo (`#16a34a`) fuera del sistema visual; ahora usa el primario.

**Commits.**
- `851d687` Contrato: pagar la fianza desde el detalle y mostrar importes reales

**Verificación (resultados reales).**
- Frontend: `npm run build` OK. `npm test`: 15 ficheros, 34 tests OK. Hay 4 tests nuevos en `ContractDetail.test.tsx`: redirige a Stripe con el importe correcto y sin «undefined»; el propietario no ve el botón, ni el inquilino si ya pagó; aviso de vuelta con limpieza del parámetro; aviso de cancelación.
- Capturas con Playwright en vite local, interceptando `/api/*` con un contrato simulado: estado pendiente, vuelta «confirmando», cancelación, fianza pagada y bloque de firmas. Se ven bien. La cabecera queda algo apretada a 1280 px con los tres elementos, pero cabe.
- Backend sin cambios (no se ejecutó tsc ni Jest).
- GitNexus: `impact` LOW en `ContractDetail` (solo lo usa la ruta). `detect_changes` marca «high» por número de símbolos, pero todos están en la página y el widget tocados.

**Qué queda.**
- La vista previa del contrato en la página sigue siendo un resumen fijo (cuatro cláusulas), no el texto real del PDF.
- `Card` no tiene relleno por defecto y otras 10 páginas pueden tener el mismo problema; no se cambió globalmente para no mover nada sin revisarlo.
- «Duración» del resumen se parte en tres líneas; menor.

**Siguiente mejora propuesta.** Seguridad: A4 (la agencia recibe el token de invitación y puede aceptar ella misma la cuenta del propietario) y P2 (`accept-slot` marca pagada una oferta sin pago confirmado). Son pequeñas, independientes de las decisiones reservadas, y van juntas en una ronda.

### Ronda 4 — 2026-10-11 05:32

**Qué y por qué.** Las dos mejoras de seguridad que propuso la ronda 3. Son pequeñas, no dependen de decisiones reservadas y estaban marcadas como altas en la auditoría.

1. **A4, invitaciones de agencia** (`src/controllers/agencyInvite.controller.ts`). `POST /api/agency/landlords/invite` devolvía `inviteUrl` a la agencia. Con ese enlace, la agencia podía activar ella misma la cuenta del propietario, fijar su contraseña y quedarse con ella. Ahora:
   - el enlace solo viaja en el email al propietario; la respuesta y el panel de la agencia ya no lo incluyen;
   - en BD se guarda el SHA-256 del token, con `select:false`. Las invitaciones antiguas, guardadas en claro con 48 caracteres hex, siguen valiendo; el hash (64 caracteres) no sirve como token;
   - aceptar la invitación marca `emailVerifiedAt`, porque prueba que el propietario controla el correo;
   - el enlace se construye con `frontendUrl()`;
   - nombre, dirección y nombre de agencia se escapan en el HTML del email (nuevo `src/utils/escapeHtml.ts`). Antes una agencia podía meter enlaces de phishing con el remitente de la app.
   - En `AgencyLandlords.tsx`, el aviso «Copiar enlace» pasa a «Invitación enviada a <email>…».
2. **P2, `accept-slot`** (`src/routes/serviceOffers.routes.ts`, `stripe.webhook.ts`). Nada más crear el PaymentIntent, la ruta marcaba la oferta como pagada y confirmada, confirmaba la cita y registraba la `PlatformEarning`; el webhook la volvía a registrar. Ahora:
   - la ruta solo crea el cobro, con un reclamo atómico `scheduled → payment_pending`, y guarda `paymentIntentId`;
   - si ya hay un intento abierto, se reanuda en lugar de crear otro;
   - si Stripe falla, el reclamo se deshace;
   - `sepa` se traduce a `sepa_debit` (Stripe no admite `sepa`), y el `customerId` ya no lo elige el cliente: se usa el `stripeCustomerId` del propietario;
   - el webhook `succeeded` confirma la oferta con un paso atómico, solo con el intento vigente (o cualquiera en ofertas antiguas sin él). Así un evento reenviado no duplica avisos ni ganancia;
   - `payment_failed` devuelve la oferta a `scheduled` para poder reintentar.

**Commits.**
- `d79f830` Agencias: el enlace de invitación solo llega al propietario (A4)
- `31c1d98` Servicios: accept-slot ya no da por pagada una oferta sin cobro (P2)

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores; `tsc -p tsconfig.spec.json` sin errores en los ficheros tocados.
- Jest `--runInBand`:
  - `tests/agency`: 11 OK, 3 nuevos (respuesta sin enlace ni token, hash en BD que no vale como token, correo verificado al aceptar; HTML escapado; invitación antigua en claro);
  - nuevo `tests/chat/serviceOffer.payment.test.ts`: 5 OK (sin confirmar ni ganancia hasta el webhook, con un evento repetido que no duplica; aceptaciones simultáneas → un solo cobro y reanudación; fallo de Stripe y `payment_failed` con reintento; estados y usuarios no válidos; intento ajeno que no confirma);
  - `tests/contracts`, `tests/chat`, `tests/escrow` y `tests/jobs`: 22 suites, 75 tests OK;
  - e2e `smoke.e2e.test.ts`: 9 OK.
- Frontend: `npm run build` OK; `npm test` 15 ficheros, 34 tests OK.
- GitNexus: `impact` LOW en `createLandlordInvite`, `acceptInvite` y `getInviteByToken` (solo los llaman las rutas). `detect_changes`: A4 solo afecta a los flujos de invitación; P2 riesgo bajo, sin flujos afectados.

**Qué queda.**
- Ninguna pantalla llama a `accept-slot`: el pago de ofertas de servicio no tiene interfaz. Cuando la tenga, debe confirmar el `client_secret` con Stripe.js.
- Caso raro sin cubrir: un intento que falla y luego se completa tarde, cuando el propietario ya creó otro intento. Se podrían cobrar los dos; habría que cancelar el intento anterior al crear uno nuevo.
- No hay reenvío de invitación (ver «Para Jorge»).
- `payment_intent.canceled` no se gestiona; un intento cancelado se retoma en el siguiente `accept-slot`.

**Siguiente mejora propuesta.** D3 y D1, despliegue seguro, sin tocar producción: añadir `.env.*`, `uploads/` y `storage/` a `.dockerignore`, para que los secretos no entren en la imagen, y renombrar `docker-compose.override.yml` a `docker-compose.dev.yml`, para que un `docker compose up` sin `-f` no publique Mongo sin contraseña. Son cambios pequeños con mucho riesgo evitado. Después, una ronda de interfaz: el relleno de `Card` en las 10 páginas pendientes.

### Ronda 5 — 2026-10-11 05:42

**Qué y por qué.** Seguridad de despliegue (D1, D3), la propuesta de la ronda 4, y la inyección de fórmulas en los CSV, el punto medio de la auditoría que más fácil era de explotar. Son cambios pequeños, no tocan producción ni decisiones reservadas.

1. **D3, `.dockerignore`.** El contexto de build incluía `.env.valeris` (secretos de producción en el VPS), `uploads/` y `storage/` (ficheros de usuarios). Ahora excluye `.env` y `.env.*` de la raíz, `uploads`, `storage` y los `node_modules`/`dist` de `institution-frontend`. Los `.env` de `frontend/` se mantienen a propósito: `vite.config.ts` los lee en la build y solo llevan `VITE_*` públicas; quitarlos podría cambiar el bundle del VPS sin que yo pueda comprobarlo.
2. **D1, compose de desarrollo.** `docker-compose.override.yml` se cargaba solo con cualquier `docker compose up` sin `-f`, y entonces publicaba Mongo sin contraseña en 27017 con `JWT_SECRET=dev-secret`. Ahora se llama `docker-compose.dev.yml`, lleva una cabecera de aviso y hay que pedirlo con `-f`. `docker-compose.override.yml` queda en `.gitignore`, y el README explica el arranque local con el fichero nuevo. Producción usa `-f docker-compose.valeris.yml`, así que no le afecta.
3. **CSV.** Un texto como `=HYPERLINK("http://evil","Ver")` en el concepto de un pago, un email o un campo de evento se ejecutaba como fórmula al abrir la exportación en Excel o Sheets. Nuevo `src/utils/csv.ts` (`csvCell`/`csvRow`/`csvRows`): pone un apóstrofo delante de las celdas que empiezan por `= + - @`, tabulador o CR, salvo números negativos como `-12.50`. Se aplica en los siete exportadores: ingresos del casero, informe fiscal, auditoría, cumplimiento (admin, servicio `rentalPublic` e institución), eventos del sistema y ganancias de plataforma. Este último no entrecomillaba las celdas; ahora sí.

**Commits.**
- `5e72fdc` Exportaciones CSV: neutralizar fórmulas en las celdas
- `7605b84` Docker: secretos y ficheros de usuario fuera de la imagen; compose de desarrollo explícito (D1, D3)

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores; `tsc -p tsconfig.spec.json` sin errores en los tests nuevos.
- Jest `--runInBand`: `tests/unit/csv.test.ts` (nuevo, 4), `tests/contracts/earnings.export.test.ts` (nuevo, 1: concepto con `=HYPERLINK` neutralizado en el CSV del casero), `tests/admin`, `tests/institution` y `tests/rentalPublic`: 8 suites, 24 tests OK.
- Docker (local, sin tocar el VPS): `docker compose config` sin `-f` ya no publica 27017 (solo 80 y 443 del proxy); con `-f docker-compose.dev.yml` salen `mongo` y `api`. Build desechable con un `.env.zzprueba` en la raíz: el contexto no contiene `.env.*`, `uploads` ni `storage`, y `frontend/.env.development` sigue dentro. Imagen y `busybox` borradas después.
- Frontend (sin cambios): build OK; 15 ficheros, 34 tests OK.
- GitNexus: `impact` LOW en los siete exportadores. `detect_changes` medio por número de símbolos, pero solo afecta a los flujos de exportación (`ExportTaxReportCsv`, `ExportComplianceDashboardCsv`, `ListAuditTrails`); `ADMIN_JWT_SECRET` y `CASEID_SALT` salen por el desplazamiento de líneas del import.

**Qué queda.**
- `exportEarningsReport` lee `contract.propertyAddress` y `contract.tenantName`, que no existen en el modelo `Contract`. El CSV del casero siempre pone «Propiedad» e «Inquilino». Habría que poblar `property` y `tenant`.
- El CSV del casero no lleva `charset=utf-8` ni BOM; Excel puede mostrar mal las tildes.
- Otros medios de la auditoría: HTML sin escapar en `utils/email.ts`, IA sin límite de peticiones, `relatedId` libre en reseñas.

**Siguiente mejora propuesta.** Una ronda de interfaz, que llevamos dos sin tocarla: el relleno de `Card` en las 10 páginas pendientes (ronda 3), revisado página a página con capturas. Si se prefiere seguridad: escapar el HTML de `utils/email.ts`, que permite phishing con el remitente de la app.

### Ronda 6 — 2026-10-11 05:54

**Qué y por qué.** Ronda de interfaz: las rondas 4 y 5 no la tocaron. Primero revisé lo que propuse en la ronda 5, el relleno de `Card` en «10 páginas». Era una estimación mala: casi todas las tarjetas ya llevan `p-*` y solo `ContractWizard` queda justo (`p-2`). Así que hice capturas con Playwright de los inicios del inquilino y del propietario. El panel del propietario, la pantalla principal del cliente que paga, tenía fallos visibles y uno de datos:

1. **Ingresos siempre a 0 €** (backend, `getLandlordStats`). `/api/users/me/stats` filtraba `payee` dentro de un `aggregate()` con el id en texto (`req.user._id` es texto tanto con JWT como con cabeceras de test), y `aggregate` no convierte tipos. Ahora se convierte a `ObjectId` y se rechaza un id no válido. Es la única agregación del backend que filtra por usuario.
2. **«Invalid Date»** en «Últimos pagos». Los pagos sin `paidAt` llegaban sin fecha. El backend usa `createdAt` como respaldo y el frontend oculta las fechas no válidas.
3. **Panel** (`frontend/src/pages/LandlordDashboard.tsx`):
   - se quita la segunda fila de contadores (Total inmuebles, Publicados, Borradores), que repetía la tarjeta «Propiedades»; ahora la tarjeta resume «1 publicada · 1 borrador · 1 alquilada»;
   - importes con formato es-ES («950,00 €/mes»);
   - «Gestión rápida» llevaba «Mis propiedades» al buscador público (`/properties`); ahora es una lista de enlaces a Contratos, Pagos, Visitas e Incidencias;
   - plurales en las alertas («1 borrador pendiente», en `utils/landlordDashboard.ts`) y tildes («Últimos», «Gestión rápida», «Dirección», «estadísticas», «Aún»);
   - el icono del botón «Nueva propiedad» iba en su propia línea;
   - iconos de las cifras en gris, sin los bordes de color (no se veían: el estilo en línea de `Card` los pisaba) ni el pulso animado de «Alquilado»;
   - «Borrar» en rojo de verdad (el color del `Button` pisaba la clase) y confirmación con el nombre de la propiedad, en lugar de «este borrador» también para pisos publicados.

**Commits.**
- `eae2642` Panel del propietario: ingresos reales y fecha en los pagos recientes
- `b11efe8` Panel del propietario: cifras sin duplicar, importes en euros y textos corregidos

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores; `tsc -p tsconfig.spec.json` sin errores en los ficheros tocados. El test nuevo `tests/contracts/landlordStats.test.ts` falló antes del arreglo (`earnings` 0 en lugar de 940) y pasa después. `tests/contracts` + `tests/auth` con `--runInBand`: 19 suites, 68 tests OK.
- Frontend: `npm run build` OK; `npm test` 16 ficheros, 35 tests OK. Test nuevo `LandlordDashboard.test.tsx`: importes es-ES, sin «Invalid Date», plurales, sin la fila duplicada, enlaces de «Gestión rápida».
- Capturas con Playwright (vite local, `/api/*` simulado) a 1280 px y 390 px: el panel se ve ordenado en las dos.
- GitNexus: `impact` LOW en `LandlordDashboard`, `buildLandlordAlerts` y `getLandlordStats`. `detect_changes` marca «high» por número de símbolos, pero solo afecta a los flujos del panel; `toPublicUser` sale por el desplazamiento de líneas del import.

**Qué queda.**
- Inicio del inquilino (`TenantHome`): las cuatro tarjetas de acceso con círculos de colores (azul, verde, morado, naranja) repiten el menú lateral y huelen a plantilla; el saludo es una caja azul grande. El vacío de `ActiveContractWidget` usa un degradado.
- La cabecera dice «Inbox» en inglés.
- Las alertas informativas («1 anuncio publicado») llevan el mismo triángulo de aviso que las advertencias.
- `ContractWizard`: el formulario solo tiene `p-2` dentro de la tarjeta.

**Siguiente mejora propuesta.** Seguir con la interfaz en una ronda corta: el inicio del inquilino (quitar las tarjetas de acceso repetidas, sobrio como el panel del propietario), «Inbox» → «Mensajes» y el relleno de `ContractWizard`. Si se prefiere seguridad: escapar el HTML de `utils/email.ts` (phishing con el remitente de la app).

### Ronda 7 — 2026-10-11 06:08

**Qué y por qué.** La ronda 6 tocó la interfaz, así que esta vuelve a seguridad: dos puntos medios pendientes de la auditoría, independientes de las decisiones reservadas. Al revisar los emails apareció además un flujo roto.

1. **HTML de los emails** (`src/utils/email.ts`). Todas las plantillas metían en el HTML, sin escapar, el título del inmueble, nombres, direcciones y conceptos de pago. Un casero podía titular un piso con un enlace de phishing y la app lo mandaba con su remitente. Ahora todo pasa por `escapeHtml`. Además:
   - los enlaces salen de `frontendUrl()`; el de «contrato pendiente» usaba `FRONTEND_URL || ''`, que daba un enlace relativo roto;
   - importes y fechas van en formato es-ES («1250,50 €», «5 de octubre de 2026») y se corrigen tildes («está», «automático»).
2. **Alertas de precio y disponibilidad** (`property.controller.ts`, flujo roto). Se enviaban a `String(s.userId)`, es decir, al id del usuario como si fuera una dirección de correo; ningún aviso llegaba nunca. El test existente comprobaba justo eso. Ahora se resuelve el email de los suscriptores con una sola consulta.
3. **Reseñas** (`src/routes/review.routes.ts`). `relatedId` era libre: cualquiera podía crear reseñas ilimitadas sobre cualquier usuario con un id distinto cada vez y hundir o inflar su media. Ahora:
   - `tenant`/`owner`: `relatedId` debe ser un contrato `signed`, `active`, `terminated` o `completed` entre las dos partes, y el `roleContext` tiene que ser el papel de quien recibe la reseña;
   - `pro`: una oferta de servicio `paid`/`confirmed`/`done` del profesional al propietario que reseña, o una incidencia `closed` asignada al profesional y abierta por (o del) que reseña;
   - `toUserId`/`relatedId` deben ser texto (no operadores) y `roleContext` del listado también;
   - un envío doble simultáneo responde 409 en vez de 500.
   Ninguna pantalla llama todavía a `POST /api/reviews`, así que la interfaz no cambia.

**Commits.**
- `d900292` Emails: escapar datos de usuario en el HTML y mandar las alertas al email del suscriptor
- `9ec4027` Reseñas: solo entre partes de un contrato firmado o un servicio real

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores; `tsc -p tsconfig.spec.json` sin errores en los ficheros tocados.
- Jest `--runInBand`:
  - nuevos `tests/reviews/review.relation.test.ts` (5) y `tests/unit/email.escape.test.ts` (4), y `tests/properties/property.alerts.test.ts` actualizado (2, ahora exige emails): 11 OK;
  - `tests/properties`, `tests/contracts`, `tests/security`, `tests/chat` y `tests/escrow` juntos: 105 de 106. Falló una vez «pagos por periodo simultáneos crean un solo intento» (`payments.duplicates`, no tocado en esta ronda); pasa 3 de 3 aislado y en una segunda pasada de `tests/contracts` (56/56). Es intermitente.
  - e2e `smoke.e2e.test.ts`: 9 OK.
- Frontend (sin cambios): build OK; 16 ficheros, 35 tests OK.
- GitNexus: `impact` LOW en `sendPriceAlert`, `sendPaymentReceiptEmail` y `update` (property). `detect_changes` da «critical» por número de flujos de email, pero `deliverEmail`, `sendEmail`, los recordatorios, `isGeoPoint` y `findTensionedAreaForProperty` solo salen por desplazamiento de líneas.

**Qué queda.**
- `payments.duplicates` «pagos por periodo simultáneos» es intermitente con la suite larga; conviene mirar si depende del tiempo o de un `retrieve` de Stripe sin clave (ronda 2).
- La media de las reseñas se recalcula con lectura-modificación-escritura; dos reseñas simultáneas sobre el mismo usuario pueden perder una en el contador. Mejor `$inc` o recalcular con `aggregate`.
- El invite de co-titular (`contract.cotenant.controller.ts`) sigue con `FRONTEND_URL || 'http://localhost:3001'` en lugar de `frontendUrl()`.
- Otros medios: IA sin límite de peticiones ni `maxOutputTokens`, `/metrics` público, enumeración de cuentas en el login.

**Siguiente mejora propuesta.** Interfaz (lo propuesto en la ronda 6): el inicio del inquilino (`TenantHome`) sin las tarjetas de acceso repetidas, «Inbox» → «Mensajes» y el relleno de `ContractWizard`. Si se prefiere seguridad: límite de peticiones y `maxOutputTokens` en `/api/ai/*`, y cerrar `/api/ai/health?test=true`.

### Ronda 8 — 2026-10-11 06:17

**Qué y por qué.** Ronda de interfaz, la propuesta de las rondas 6 y 7. La 7 fue de seguridad, y el inicio del inquilino era la pantalla con peor aspecto que quedaba en los flujos principales.

1. **Inicio del inquilino** (`frontend/src/pages/tenant/TenantHome.tsx`), en la línea sobria del panel del propietario de la ronda 6:
   - fuera la caja azul del saludo y las cuatro tarjetas de acceso con círculos de colores (azul, verde, morado, naranja), que repetían el menú lateral;
   - nueva tarjeta «Tu alquiler»: inmueble, dirección, renta en formato es-ES, estado, fianza («1900,00 € pendiente» o «Pagada») y siguiente paso (`getContractActionSummary`). Lleva los botones «Pagar fianza» (al detalle del contrato, donde ya está el pago de la ronda 3), «Ver contrato» y «Pagos». Sin alquiler, un vacío útil con «Buscar pisos» y «Mis solicitudes»;
   - el contador «En trámite» solo contaba `draft` y `pending`; `pending` no existe y se dejaba fuera `generated`, `pending_signature` y `signing`. Ahora cuenta los cuatro estados reales y los lista con su siguiente paso;
   - cifras en gris y enlazadas (Favoritos, Tenant PRO); «Gestión rápida» como lista, igual que el propietario. En móvil el menú lateral no se muestra (`hidden lg:block`), así que esa lista es la única navegación de la pantalla.
2. **«Inbox» → «Mensajes»** en la cabecera, el menú lateral (antes «Conversaciones», que no casaba con la cabecera) y el título de la página.
3. **Asistente de contrato** (`ContractWizard.tsx`):
   - la tarjeta tenía `p-2` y el pie sin relleno lateral; ahora `p-6`;
   - el icono era un dólar y tapaba el número (la clase `auth-input` pisaba el `pl-10`); los campos de renta y fianza pasan a `Input`, como los demás;
   - «1 ano / 2 anos» → «1 año / 2 años», más tildes («Duración», «automáticamente», «será»), mayúsculas de título fuera y «PERMITIDAS/PROHIBIDAS» → «Permitidas/No permitidas»;
   - revisión con importes y fechas es-ES; «Dirección Propiedad» de relleno → «Sin dirección»;
   - cajas de las partes en gris en lugar de azul y verde; los botones «Atrás»/«Siguiente» ya no parten el icono en otra línea; la clase verde del botón final (que `Button` pisaba) se quita y el texto pasa a «Enviar a firma».
4. Miga de pan: «Contrato #NEW» → «Nuevo contrato» (y «Nueva incidencia»); «Ticket #» → «Incidencia #».

**Commits.**
- `600f93a` Inicio del inquilino: alquiler actual con renta, fianza y siguiente paso; sin tarjetas de colores repetidas
- `f0ebec1` Interfaz: «Mensajes» en vez de «Inbox», asistente de contrato con relleno, tildes y euros

**Verificación (resultados reales).**
- Frontend: `npm run build` (incluye `tsc --noEmit`) OK; `npm test` 16 ficheros, 37 tests OK. `TenantHome.test.tsx` pasa de 1 a 3 tests: importes es-ES y fianza pendiente con enlace a «Pagar fianza», recuento de `pending_signature` + `generated`, sin «undefined», y vacío sin alquiler.
- Capturas con Playwright (vite local, `/api/*` simulado): inicio con alquiler a 1280 y 390 px, inicio vacío, asistente pasos 1 y 2 rellenos. Se ven ordenados; el icono ya no tapa el número.
- Backend sin cambios (no se ejecutó tsc ni Jest).
- GitNexus: `impact` LOW en `TenantHome`, `ContractWizard` y `Header`. `detect_changes` medio, solo con los flujos de `TenantHome` y `AppShell`.

**Qué queda.**
- **Móvil sin navegación**: por debajo de 1024 px no hay menú (el lateral se oculta y no existe menú hamburguesa) y «Mensajes» de la cabecera se oculta por debajo de 768 px. Solo se navega desde los enlaces de cada pantalla. Es el fallo de interfaz más grave que queda.
- El asistente avisa «Contrato enviado a firma correctamente», pero no he comprobado si `createContract` lo envía a firma o solo crea el borrador.
- `TenantDashboard.tsx` (con `ActiveContractWidget`) no tiene ruta; parece código muerto.
- Siguen pendientes de la ronda 7: `payments.duplicates` intermitente, media de reseñas sin `$inc`, enlace del co-titular sin `frontendUrl()`.

**Siguiente mejora propuesta.** Navegación en móvil: un menú desplegable en `AppShell` (botón en la cabecera que abre los mismos enlaces de `nav.config.json` en un `Drawer`, que ya existe en `components/ui`), con «Mensajes» dentro. Si se prefiere seguridad: límite de peticiones y `maxOutputTokens` en `/api/ai/*`, y cerrar `/api/ai/health?test=true`.

### Ronda 9 — 2026-10-11 09:27

**Qué y por qué.** Seguridad y coste: la alternativa propuesta en las rondas 7 y 8. La ronda 8 fue de interfaz, así que tocaba seguridad. Cualquier usuario verificado podía llamar a Gemini sin límite (asistente Clara y descripción de anuncios) y gastar en la cuenta de Google de la plataforma. Además, `GET /api/ai/health?test=true` lanzaba una llamada real al modelo para cualquiera. La sesión se cortó a mitad de ronda por la cuota; se retomó sin cambios a medias (el worktree estaba limpio).

1. **Límite de consultas** (`src/middleware/aiRateLimit.ts`): 30 consultas cada 15 minutos por usuario, compartidas entre `/api/ai` y `/api/assistant`, y montadas detrás de `authenticate`, de modo que se cuenta por usuario y no por IP. Se ajusta con `AI_RATE_LIMIT_MAX`. El 429 trae `error` en castellano, porque `Assistant.tsx` y `PropertyFormRHF.tsx` muestran ese campo tal cual, y `code: 'too_many_requests'`.
2. **Tope de salida y tiempo de espera**: `getGeminiModel()` en `ai.service.ts` es ahora el único sitio donde se crea el modelo (antes, tres copias). Lleva `maxOutputTokens` (descripción 2048, asistente 4096, salud 256) y una espera máxima de 30 s. Los topes son holgados a propósito: los modelos con razonamiento cuentan esos tokens dentro de `maxOutputTokens`, y un tope bajo devolvería respuestas vacías.
3. **Salud de la IA**: `?test=true` da 403 a quien no es admin. La comprobación sin `test` sigue abierta a todos los usuarios verificados (no llama al modelo).

**Commits.**
- `4e48d7f` IA: límite de consultas por usuario, tope de tokens y prueba de salud solo para admin

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores; `tsc -p tsconfig.spec.json` sin errores en los ficheros tocados.
- Jest `--runInBand`:
  - nuevo `src/__tests__/ai.limits.test.ts` (2): el modelo se crea con `maxOutputTokens` y `timeout`; la tercera consulta del mismo usuario (mezclando `/api/ai` y `/api/assistant`, con límite 2) da 429 con el mensaje, y otro usuario sigue pasando;
  - `ai.routes.test.ts` (5, antes 3): `?test=true` OK como admin y 403 como propietario; salud básica OK para un inquilino;
  - todo `src/__tests__`: 8 suites, 30 tests OK;
  - e2e `smoke.e2e.test.ts`: 9 OK.
- Frontend (sin cambios): build OK; 16 ficheros, 37 tests OK.
- GitNexus: `impact` LOW en `checkAiHealth`, `answerWithClara` y `generatePropertyDescription`. `detect_changes` sale «high» porque los 7 flujos `queryAssistant` pasan por `answerWithClara`; son justo los flujos que se querían cambiar. `buildPrompt` y las constantes solo aparecen por desplazamiento de líneas.

**Qué queda.**
- El límite vive en memoria, como el resto de limitadores: con varias instancias, cada una cuenta por su lado (ver auditoría de mejoras, «2.ª instancia»).
- No hay tope diario ni de gasto total; si hiciera falta, un contador en Mongo por usuario y día.
- Pendientes de rondas anteriores: navegación en móvil (lo más grave de la interfaz), `payments.duplicates` intermitente, media de reseñas sin `$inc`, enlace del co-titular sin `frontendUrl()`, `/metrics` público y enumeración de cuentas en el login.

**Siguiente mejora propuesta.** Navegación en móvil (propuesta en la ronda 8): botón de menú en la cabecera de `AppShell` que abra los enlaces de `nav.config.json` en el `Drawer` de `components/ui`, con «Mensajes» dentro, revisado con capturas a 390 px. Si se prefiere seguridad: cerrar `/metrics` y quitar `NODE_ENV` de `/health`.

### Ronda 10 — 2026-10-11 09:35

**Qué y por qué.** Navegación en móvil, propuesta en las rondas 8 y 9 y el fallo de interfaz más grave que quedaba. Por debajo de 1024 px el menú lateral se oculta y no había otro menú; «Mensajes» desaparecía de la cabecera por debajo de 768 px. En el móvil solo se podía navegar con los enlaces de cada pantalla.

1. **Menú del móvil** (`frontend/src/layout/AppShell.tsx`):
   - botón de menú a la izquierda de la marca, solo por debajo de `lg`. Abre un panel lateral con los mismos enlaces del lateral de escritorio (`nav.config.json`): «General» con Mensajes y su contador, y la sección del rol. Al pie va el email, que la cabecera oculta en pantallas estrechas;
   - si hay mensajes sin leer, el botón lleva un punto rojo y lo dice en su `aria-label`;
   - se cierra al elegir un enlace (también el de la página actual), al cambiar de ruta, con Escape, con la X o tocando fuera;
   - los enlaces salen de un único componente `NavSections`, compartido por los dos menús;
   - antes `useUnread` se llamaba en la cabecera y en el lateral: dos sondeos de `/api/chat/conversations` cada 30 s. Ahora hay uno solo en `AppShell`;
   - «Inicio» de la agencia (`/agency`) ya no queda marcado como activo en todas sus subpáginas (le faltaba el `end`).
2. **`Drawer`** (`components/ui/Drawer.tsx`; lo usan también los filtros de `PropertiesList` y el detalle de `AdminTenantProPage`):
   - cerrado, el panel seguía en el DOM fuera de la pantalla y sus enlaces recibían el foco con Tab. Ahora queda con `visibility: hidden` y `aria-hidden`; la ocultación espera a que acabe el deslizamiento;
   - al abrir, el foco pasa al panel y el Tab da la vuelta dentro (es `aria-modal`); al cerrar, el foco vuelve al botón que lo abrió;
   - Escape solo se escucha mientras el panel está abierto, y el panel lleva `aria-label`.

**Commits.**
- `9efde15` Drawer: foco dentro del panel, Tab que no se escapa y panel cerrado fuera del orden de tabulación
- `e3f760e` Navegación en móvil: botón de menú en la cabecera con los enlaces del rol y aviso de mensajes sin leer

**Verificación (resultados reales).**
- Frontend: `npm run build` OK. `npm test`: 17 ficheros y 39 tests OK.
- Nuevo `src/layout/__tests__/AppShell.test.tsx` (2 tests):
  - el menú abre con «Abrir menú (2 mensajes sin leer)», muestra Mensajes con su contador y el email, navega a Pagos y se cierra;
  - se cierra con Escape;
  - `listConversations` se llama una sola vez.
- Capturas con Playwright (vite local, `/api/*` simulado, inquilino con 3 mensajes sin leer):
  - a 390 px, menú cerrado y abierto: se ve ordenado, en la línea del lateral de escritorio;
  - a 1280 px el escritorio queda igual que antes.
- Prueba de foco en el navegador real. El primer intento falló: la transición de `visibility` empezaba en «hidden» y `focus()` no entraba en el panel. Corregido. Ahora:
  - al abrir, el foco está en el panel;
  - Tab ×2 llega a «Mensajes»;
  - Shift+Tab ×2 da la vuelta hasta «Perfil y cuenta»;
  - en escritorio, el primer Tab va a la marca y no a enlaces ocultos.
- Backend sin cambios (no se ejecutó tsc ni Jest).
- GitNexus:
  - `impact` LOW en `AppShell`, `useUnread` y `Drawer`;
  - `detect_changes` sale medio y solo afecta a los cuatro flujos de `AppShell` (`ListConversations`, `UseAuth`, `IconFor`, `UnreadBadge`).

**Qué queda.**
- Las páginas públicas (`PublicLayout`) no se han revisado en móvil en esta ronda.
- Sin probar a mano los otros dos usos de `Drawer` (filtros de pisos y detalle de Tenant PRO). Solo heredan el foco y la ocultación, y el build y los tests pasan.
- Pendientes de rondas anteriores:
  - `/metrics` público y `NODE_ENV` en `/health`;
  - enumeración de cuentas en el login;
  - `payments.duplicates` intermitente;
  - media de reseñas sin `$inc`;
  - enlace del co-titular sin `frontendUrl()`.

**Siguiente mejora propuesta.** Seguridad, que esta ronda fue de interfaz: cerrar `/metrics` (solo con un token o desde la red interna) y quitar `NODE_ENV` de `/health`. En la misma ronda, el enlace del co-titular con `frontendUrl()`. Si se prefiere interfaz: revisar en móvil la búsqueda de pisos y la ficha del inmueble (`PublicLayout`) con capturas a 390 px.

### Ronda 11 — 2026-10-11 09:43

**Qué y por qué.** Seguridad, propuesta en la ronda 10 (la anterior fue de interfaz). Son puntos de la auditoría que no dependen de Jorge:

1. **`/metrics` público** (`src/metrics.ts`). Cualquiera veía el volumen de peticiones por método y estado. Ahora exige `Authorization: Bearer <METRICS_TOKEN>`, comparado en tiempo constante. Sin la variable, la ruta da 404. Nada del repositorio lo lee (sin Prometheus en los compose).
2. **`/health` exponía `NODE_ENV`** (`src/app.ts`). Ya no lo devuelve; `ok` y el estado de Mongo siguen igual, así que el smoke y el healthcheck de despliegue no cambian.
3. **Tokens en los logs.** El log estructurado y `morgan` guardaban la URL con la query, incluido el `code` y el `state` del callback de Google y Apple. Ahora los dos registran la ruta sin query (`pathWithoutQuery`). El formato de `morgan` es el mismo que `dev`, sin colores.
4. **Webhook de `/api/kyc` sin firma.** Sin `STRIPE_IDENTITY_WEBHOOK_SECRET`, cualquiera podía crear o marcar como `verified` un `IdentityCheck`. Ahora en producción responde 503; en desarrollo sigue el camino simulado. Hoy nadie lee `IdentityCheck`: es una defensa para cuando se conecte.
5. **Enlace del co-titular** (`contract.cotenant.controller.ts`). Se construía a mano con `localhost:3001` por defecto; ahora usa `frontendUrl()`, como el resto de emails.

**Commits.**
- `adcdc95` Observabilidad: /metrics con token, /health sin entorno, logs sin query y webhook KYC sin secreto rechazado en producción
- `fc15fa5` Co-titular: enlace de invitación con frontendUrl() y test del email

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores; `tsc -p tsconfig.spec.json` sin errores en los ficheros tocados.
- Jest `--runInBand`:
  - nuevo `src/__tests__/observability.test.ts` (7). Comprueba que `/health` no devuelve `env`. `/metrics` da 404 sin token configurado, 401 sin cabecera, con token erróneo o sin `Bearer`, y 200 con el bueno. La query se quita del log. El webhook KYC da 503 en producción sin secreto y sigue funcionando fuera de producción;
  - `contract.cotenant.test.ts` (5, antes 4): el email lleva `https://<FRONTEND_URL>/invites/accept?token=…` y en la base solo queda el SHA-256 del token;
  - `src/__tests__` y co-titular: 10 suites, 43 tests OK;
  - e2e `health` y `smoke`: 10 OK.
- Frontend (sin cambios): build OK; 17 ficheros y 39 tests OK.
- GitNexus: `impact` LOW en `metricsHandler`, `metricsMiddleware` e `inviteCoTenant`. `detect_changes` sale medio y solo afecta al flujo `InviteCoTenant → DeliverEmail`.
- Un detalle del test: con `NODE_ENV=test`, la app monta rutas de prueba que dan 404 a todo `/api` si se cambia a `production` en caliente. Por eso el webhook KYC se prueba con su router montado aparte.

**Qué queda.**
- **Invitación de co-titular rota en el frontend.** El email lleva a `/invites/accept?token=…`, pero esa ruta no existe en `AppRoutes`: solo existe `/invite/:token`, que es de la agencia. Tampoco hay pantalla para invitar ni para firmar como co-titular. El backend está completo (`POST /api/invites/accept`, `/api/me/invites`).
- `contract.cotenant.test.ts` llama de verdad a la API de Stripe en un caso de pago (sale un `StripeAuthenticationError` por consola; el test pasa). Habría que simular `stripe.paymentIntents.retrieve`.
- `POST /api/kyc/start` acepta un `returnUrl` elegido por el cliente. Hoy es un stub; al conectar Stripe Identity hay que limitarlo a `frontendUrl()`.
- Pendientes anteriores: enumeración de cuentas en el login, PII en otros logs, `payments.duplicates` intermitente y media de reseñas sin `$inc`.

**Siguiente mejora propuesta.** Interfaz: página `/invites/accept` para el co-titular. Tiene que leer el token, pedir que inicie sesión o se registre con el email invitado y llamar a `POST /api/invites/accept`. Además, una sección «Co-titulares» en el detalle del contrato para invitar (`/tenants/invite`) y ver el estado. Así se cierra un flujo que hoy acaba en una página que no existe. Si se prefiere seguridad: enumeración de cuentas en el login y contraseña mínima de 8 caracteres.

### Ronda 12 — 2026-10-11 10:05

**Qué y por qué.** Flujo roto, propuesto en la ronda 11: la invitación de co-titular acababa en una página que no existía (`/invites/accept`). Revisando el backend salió que, aunque existiera, el co-titular tampoco podía ver el contrato después de aceptar: `getContract` solo dejaba pasar al casero, al inquilino principal y al admin.

1. **Backend.**
   - `GET /api/invites/preview?token=` es público, porque el invitado puede no tener cuenta. Devuelve el email invitado, el inmueble, quién invita y si ha caducado. El token va en la query, que no llega a los logs (ronda 11). Se monta antes de los routers de `/api` que exigen sesión.
   - `POST /api/invites/accept` devuelve también `contractId`.
   - `getContract` y `getContractPDF` admiten al co-titular `JOINED` o `SIGNED` con el nuevo `isActiveCoTenant` (`utils/contractAccess.ts`). No he tocado `ensureCanReadContract`: GitNexus da MEDIUM y lo usan terminar, renovar y avisos, que el co-titular no debe hacer.
   - De paso, `getContractPDF` respondía 500 cuando no había acceso; ahora da 403 o 404.
2. **Página `/invites/accept`** (`pages/CoTenantInviteAccept.tsx`, dentro de `AuthLayout`). Muestra la vivienda, la dirección, quién invita y el correo invitado. Según el caso:
   - sin sesión: «Iniciar sesión» y «Crear cuenta», que vuelven a la invitación; el registro precarga el email;
   - con otra cuenta: «Cambiar de cuenta»;
   - con la cuenta invitada: «Aceptar invitación», que abre el contrato;
   - mensajes para enlace no válido, caducado, correo distinto y falta de verificación de identidad (con enlace a `/tenant/kyc`).
3. **Tarjeta «Co-titulares»** en el detalle del contrato (`components/contracts/CoTenantsCard.tsx`). Lista cada persona con su estado («Invitación enviada», «Pendiente de firma», «Firmado»…). El inquilino principal puede invitar por email; el co-titular ve «Firmar como co-titular» cuando el contrato está pendiente de firma. «Firmar contrato» y «Pagar fianza» quedan solo para el inquilino principal: un co-titular también tiene rol `tenant` y antes los habría visto.
4. **Redirecciones.** Login y registro aceptan `?redirect=` solo con rutas internas (`safeInternalPath`: fuera `//…`, `/\…` y URLs absolutas). Los enlaces entre login y registro conservan la vuelta.

**Commits.**
- `952f2f9` Co-titular: vista previa pública de la invitación, acceso de lectura al contrato y PDF tras aceptar
- `b0f0c84` Co-titular: página /invites/accept y sección «Co-titulares» en el detalle del contrato

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - `contract.cotenant.test.ts`: 7 OK (1 nuevo). Comprueba la vista previa sin sesión (400 sin token, 404 con uno desconocido, 200 con datos), 403 al contrato y al PDF antes de aceptar, `contractId` al aceptar, 200 al contrato (sin `ibanEncrypted`) y al PDF después, y 404 en la vista previa de una invitación ya usada;
  - `tests/contracts`: 17 suites, 58 tests OK;
  - `src/__tests__`: 37 OK; e2e smoke: 9 OK.
- Frontend: build OK; `npm test` 20 ficheros y 49 tests OK (antes 17 y 39). Nuevos:
  - `CoTenantInviteAccept.test.tsx` (5): sin sesión, aceptar y abrir el contrato, falta de verificación, otra cuenta, enlace no válido o caducado;
  - `CoTenantsCard.test.tsx` (3);
  - `coTenants.test.ts` (`safeInternalPath`);
  - un caso más en `ContractDetail.test.tsx`: el co-titular no ve firmar ni pagar.
- Capturas con Playwright (vite local, `/api/*` simulado) a 390 y 1280 px: invitación sin sesión, con la cuenta invitada y la tarjeta en el contrato. En móvil el correo largo se partía a mitad («ejemplo.e / s»); el estado va ahora debajo del nombre.
- GitNexus: `impact` LOW en `getContract`, `ContractDetail` y `RegisterPage`; MEDIUM en `ensureCanReadContract`, que por eso no se tocó. `detect_changes`: el backend sale LOW; el frontend sale MEDIUM y solo afecta a los flujos de `AppRoutes`, `ContractDetail` y el registro.

**Qué queda.**
- Las dos decisiones de «Para Jorge» (firma real del co-titular y verificación previa).
- «Mis contratos» (`GET /api/contracts`) no lista los contratos en los que el usuario es co-titular; solo llega a ellos por el enlace. Lo mismo `/api/me/invites`, que no tiene pantalla.
- El email de invitación no dice quién invita ni qué vivienda es.
- Pendientes anteriores: enumeración de cuentas en el login y contraseña mínima de 8, `payments.duplicates` intermitente, media de reseñas sin `$inc`, `returnUrl` libre en `/api/kyc/start` y la llamada real a Stripe en `contract.cotenant.test.ts`.

**Siguiente mejora propuesta.** Seguridad, que esta ronda fue de interfaz: enumeración de cuentas en el login («Esta cuenta utiliza Google o Apple») y contraseña mínima de 8 caracteres en registro y reset, alineada con la invitación de agencia. Si se prefiere seguir con el co-titular: listar sus contratos en «Mis contratos» y enriquecer el email de invitación.

### Ronda 13 — 2026-10-11 10:18

**Qué y por qué.** Seguridad, propuesta en la ronda 12 (que fue de interfaz). Es el punto P1-17 del plan de apertura y el último pendiente de «Contraseñas» en la auditoría:

1. **Enumeración de cuentas en el login** (`auth.controller.ts`). Una cuenta creada con Google o Apple respondía «Esta cuenta utiliza Google o Apple», así que cualquiera podía saber qué correos estaban registrados. Además, una cuenta inexistente respondía antes, porque no hacía bcrypt. Ahora los tres casos (no existe, solo social, contraseña errónea) dan la misma respuesta (`INVALID_CREDENTIALS`) y hacen un bcrypt, contra un hash señuelo cuando no hay contraseña.
2. **Contraseña mínima de 8** en `/register` y `/reset` (antes 6), con un máximo de 200, igual que la invitación de agencia. Las cuentas con contraseñas antiguas más cortas siguen entrando: el login no aplica la política.
3. **Límite de intentos en `/api/auth/reset`**. Ya estaba en login, registro y request-reset, pero no en el reset. Entra en el mismo límite por IP (20 cada 15 minutos).
4. **Interfaz.**
   - Registro y reset comprueban los 8 caracteres antes de enviar, con un mensaje en español; antes llegaba `validation_error` del backend. El registro ya decía «Mínimo 8», pero el backend aceptaba 6.
   - El login añade «Si creaste la cuenta con Google o Apple, entra con ese botón» solo al error de credenciales, no a otros errores como el límite de intentos. Así no se pierde la ayuda que daba el mensaje antiguo.
   - `ResetPassword` usa los avisos `auth-alert` del resto de pantallas de acceso (antes cajas Tailwind rojas y verdes y un enlace índigo). Al terminar muestra «Contraseña actualizada» con un botón «Iniciar sesión».
   - El error de token caducado dice «El enlace no es válido o ha caducado. Pide uno nuevo.»

**Commits.**
- `2541239` Auth: login sin enumeración de cuentas, contraseña mínima de 8 y límite de intentos en /reset (P1-17)
- `6c9c69a` Interfaz de acceso: mínimo de 8 caracteres en registro y reset, pista de Google o Apple en el login y pantalla final del restablecimiento

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores; `tsc -p tsconfig.spec.json` sin errores en los ficheros tocados.
- Jest `--runInBand`:
  - nuevo `tests/auth/login-policy.test.ts` (4): misma respuesta en los tres casos y login correcto; registro con 7 caracteres rechazado y con 8 aceptado; reset con contraseña corta rechazado sin gastar el token; 429 al insistir en `/reset`;
  - `tests/auth`: 3 suites, 16 OK. En `reset.test.ts`, el caso del token caducado usaba `newpass` (7 caracteres): ahora fallaría por la validación y no por el token, así que pasa a `newpassword`;
  - `src/__tests__` y `tests/security`: 11 suites, 48 OK;
  - e2e smoke: 9 OK.
- Frontend: build OK; `npm test` 21 ficheros y 54 tests OK (antes 20 y 49). Nuevo `pages/auth/__tests__/passwordPolicy.test.tsx` (5): reset corto sin llamada a la API, pantalla final del reset, registro corto bloqueado, y pista en el login solo ante credenciales incorrectas.
- Capturas con Playwright (vite local, `/api/*` simulado) a 390 y 1280 px: error de login, reset con contraseña corta y reset terminado. En la primera captura el botón «Iniciar sesión» del final salía estrecho; se puso a todo el ancho.
- GitNexus: `impact` LOW en `login`, `RegisterPage` y `ResetPassword`. `detect_changes` sale medio y solo afecta a los flujos de login, registro y reset.

**Qué queda.**
- `request-reset` envía el email dentro de la petición, así que tarda más si la cuenta existe (enumeración por tiempo). Arreglarlo es mandar el email sin esperar, y eso choca con P0-07 (`sendEmail` que oculta fallos).
- El registro sigue revelando si un correo existe; es inevitable sin verificar el correo antes de crear la cuenta.
- El email no se normaliza a minúsculas: «Ana@x.es» y «ana@x.es» son cuentas distintas, y el login distingue mayúsculas. Normalizarlo exige migrar los usuarios de producción (comprobar antes duplicados por mayúsculas).
- A3: sin revocación de JWT (7 días).
- Pendientes anteriores: `payments.duplicates` intermitente, media de reseñas sin `$inc`, `returnUrl` libre en `/api/kyc/start`, la llamada real a Stripe en `contract.cotenant.test.ts`, «Mis contratos» sin los contratos de co-titular.

**Siguiente mejora propuesta.** Interfaz, que esta ronda fue de seguridad: «Mis contratos» con los contratos en los que el usuario es co-titular, y la lista de `/api/me/invites` con sus invitaciones pendientes. Así el co-titular no depende del enlace del email. Si se prefiere seguridad: `tokenVersion` en el usuario (A3), que invalida los JWT al cambiar o restablecer la contraseña.
