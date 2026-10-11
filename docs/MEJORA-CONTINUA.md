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
