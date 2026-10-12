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
- **Ronda 4, cambio de producto**: la agencia ya no puede «Copiar enlace» de invitación (era justo la vulnerabilidad A4). Desde la ronda 18 tiene «Reenviar invitación» en «Propietarios», que manda un enlace nuevo al propietario.
- **Al desplegar la ronda 18**: crear una invitación de agencia espera ahora al SMTP (antes se enviaba en segundo plano), así que la respuesta tarda lo que tarde el correo. Si en producción no hay SMTP configurado, las pantallas de invitación lo dirán («el correo no salió»).
- **Al desplegar la ronda 2**: si en producción existen `DEPOSIT_SUCCESS_URL` o `DEPOSIT_CANCEL_URL`, mandan sobre las URLs nuevas (`FRONTEND_URL/contracts/<id>?deposit=success|cancel`); conviene borrarlas o comprobar que apuntan a app.rentalapp.es. El cambio de cobros no necesita migración.
- **Al desplegar la ronda 9**: las consultas a la IA (asistente Clara y descripción de anuncios) quedan limitadas a 30 cada 15 minutos por usuario. Si te parece poco o mucho, se cambia con `AI_RATE_LIMIT_MAX` en el entorno, sin tocar código.
- **Al desplegar la ronda 11**: `/metrics` deja de ser público. Si algo lo lee (Prometheus, un panel), hay que poner `METRICS_TOKEN` en el entorno y mandar `Authorization: Bearer <token>`; sin la variable, `/metrics` da 404. `/health` ya no devuelve `env`. Si en producción no está `STRIPE_IDENTITY_WEBHOOK_SECRET`, el webhook de `/api/kyc` responde 503 (hoy la verificación de identidad es un stub y nadie lo usa).
- **Al desplegar la ronda 15**: cada petición autenticada hace una consulta más a Mongo (`tokenVersion` del usuario, por `_id`). Los JWT ya emitidos siguen valiendo (cuentan como versión 0); no hace falta migración. Quien restablezca la contraseña cierra todas sus sesiones abiertas, también la del propio dispositivo.
- **Al desplegar la ronda 17**: rol e `isVerified` salen de la base en cada petición, no del token. Un administrador degradado o una cuenta a la que se retira la verificación lo nota en la siguiente petición. No hay migración ni consulta extra (es la misma de `tokenVersion`).
- **Al desplegar la ronda 20**: crear un contrato exige ser el propietario del inmueble, su agencia gestora (`agencyAccess: 'manage'`) o administrador, y que el arrendador sea el dueño del inmueble. Quien antes creaba contratos con IDs a mano sobre inmuebles ajenos recibirá 403/400. Conviene comprobar también, con una consulta de solo lectura, que en producción existe el índice único `contractId_1_period_1` de `rentpayments`. Si había recibos duplicados, Mongoose no lo habrá podido crear, y la protección contra el doble cobro de la renta (P3) depende de él.
- **Al desplegar la ronda 22**: conviene comprobar en producción, con una consulta de solo lectura, si hay cuentas cuyo correo solo se diferencia en mayúsculas (`db.users.aggregate([{$group:{_id:{$toLower:'$email'},n:{$sum:1},emails:{$push:'$email'}}},{$match:{n:{$gt:1}}}])`). Si las hay, quien entra con el correo exacto llega a la suya, pero con otras mayúsculas entra en una cualquiera de las dos; habría que decidir cuál se conserva. Además, el token de una cuenta borrada deja de valer en la siguiente petición.
- **Al desplegar la ronda 23**: las visitas que el casero propuso antes desde «Solicitudes» se guardaron con la hora desplazada (el servidor leía «10:00» como UTC: 2 h tarde en verano y 1 h en invierno). No se corrigen solas. Si hay visitas futuras en producción, conviene revisarlas con una consulta de solo lectura (`db.applications.find({proposedBy:'landlord', proposedDate:{$gt:new Date()}})`) y avisar a los afectados. Además, `POST /api/contracts` toma ya la región del inmueble y rechaza con 400 `region_mismatch` una región distinta en el cuerpo.
- **Recibos tras el fin del contrato (ronda 24)**: el job sigue generando recibos mientras el contrato esté `active`, también después de `endDate`, y ningún proceso lo pasa a terminado ni amplía `endDate`. Con la prórroga obligatoria de la LAU puede ser lo correcto, pero hay que decidir: ¿prórroga automática (ampliar `endDate` por años) o terminar el contrato al vencer salvo que se renueve? No se ha cambiado.
- **Al desplegar la ronda 24**: `POST /api/contracts/:id/payments/:period/pay` solo acepta meses desde el inicio del contrato hasta el mes en curso (hora de Madrid) y contratos `active` o `signed`. Si alguien pagaba por adelantado meses futuros, recibirá 400 `period_in_future`. Conviene comprobar con una consulta de solo lectura si hay recibos fuera de rango (`period` posterior al mes actual o anterior al inicio) o de importe 0.
- **Al desplegar la ronda 26**: en el panel de Stripe, el endpoint del webhook (`/api/stripe/webhook`) tiene que tener suscrito `charge.refunded`; si no, las devoluciones no llegan y nada cambia. Dos decisiones abiertas: (1) cuando se devuelve una renta entera, ¿hay que revertir la transferencia de la parte de la agencia (`PartnerEarning`)? Ahora no se revierte. (2) Un mes devuelto queda `REFUNDED` y el inquilino no puede volver a pagarlo (409 `rent_refunded`). ¿Debe poder volver a pagarse, o una devolución significa que ese mes no se debe?
- **Al desplegar la ronda 27**: la agencia que gestiona un inmueble (`agencyAccess: 'manage'`) ve ya sus candidatos (nombre, correo, mensaje y si tienen la solvencia verificada), propone y acepta visitas en nombre del propietario y prepara el contrato. Antes solo podía el propietario. Al traspasar el inmueble (`status_only`) pierde todo eso. Si el propietario debe dar su visto bueno antes de que la agencia vea a los candidatos, hay que decidirlo.
- **Al desplegar la ronda 28**: `POST /api/auth/request-reset` responde `{ ok: true }` antes de buscar la cuenta, y el correo sale después. Si el SMTP falla, solo queda en el log (la respuesta ya era la misma con o sin cuenta). Además, la agencia gestora ve ya «Contratos» en su menú, abre el detalle y descarga el borrador de los contratos de inmuebles que gestiona, y ve los co-titulares sin poder tocarlos. El administrador, que antes veía «Contratos» vacío, ve ahora todos.
- **Al desplegar la ronda 30**: en el panel de Stripe, el webhook (`/api/stripe/webhook`) tiene que tener suscritos `charge.dispute.created`, `charge.dispute.updated` y `charge.dispute.closed`. Si no, las disputas no llegan. Tres decisiones abiertas: (1) una disputa no tiene más aviso que el historial del contrato y un `console.error` en el log, porque no hay canal de alertas para el administrador; ¿correo a soporte, al casero, o un panel? (2) Si se pierde una disputa de renta, el recibo sigue `PAID`: ¿el mes vuelve a deberse? (3) Una fianza devuelta en Stripe deja `depositPaid: true` y anota `depositRefundedAt`: ¿la devolución al terminar el contrato es así, o debe cambiar algo más (estado del contrato, aviso)?
- **Al desplegar la ronda 34**: los mensajes de chat solo admiten adjuntos subidos a nuestro `/uploads` (relativos o bajo `APP_URL`, `FRONTEND_URL` o `UPLOADS_BASE_URL`). Si en producción `APP_URL` no es el dominio que devuelve la subida, los adjuntos darán 400 `attachment_domain_not_allowed`; conviene comprobar que `APP_URL` está puesto. Los mensajes antiguos con enlaces externos no se tocan. Además, ¿deben los adjuntos del chat ser privados (URL firmada que caduca)? Hoy son públicos para quien tenga el enlace, aunque el nombre ya no se puede adivinar.
- **Incidencias (ronda 35), dos decisiones:** (1) el coste extra que aprueba el propietario se suma a lo que se libera al profesional (`releaseTicketEscrow`), pero el hold de Stripe solo retuvo el presupuesto, así que la captura pediría más de lo retenido. Va con el rediseño del escrow (P5); no se ha tocado. (2) Tanto el propietario («Validar») como el inquilino («Confirmar que está arreglado») liberan el pago del propietario al profesional. Desde la ronda 35, los dos solo después de que el profesional marque el trabajo terminado. ¿Debe poder liberarlo el inquilino, que no es quien paga?
- **Recibos de renta (ronda 38)**: el PDF dice «Justificante del pago emitido por RentalApp en nombre del arrendador (art. 17.4 LAU)» y lleva nombres de arrendador y arrendatario, vivienda, periodo, fecha, importe y referencia de Stripe, sin DNI/NIF (no se guardan, ver ronda 21) ni los datos legales de RentalApp. Conviene que alguien con criterio legal revise ese texto y decida si el recibo debe llevar NIF de las partes y la razón social de RentalApp.
- **Al desplegar la ronda 40**: las fianzas cobradas antes no tienen pago guardado, así que no tienen recibo ni salen en «Cobros y recibos». `npx ts-node scripts/backfill_deposit_payments.ts` cuenta las que faltan sin escribir nada; con `--apply` las crea (una vez por PaymentIntent, con la devolución si la hubo). Las que no tengan `depositPaymentIntentId` las lista aparte para revisarlas en Stripe. Ejecutarlo en producción es decisión tuya.
- **Avisos de cobro (ronda 42)**: al cobrarse una renta o una fianza, el correo va al inquilino que paga y al propietario. ¿Debe recibirlo también la agencia gestora (`agencyAccess: 'manage'`), o en lugar del propietario? Sin SMTP en producción, estos correos solo quedan en el log.
- **Al desplegar la ronda 44**: `POST /api/pros` solo admite cuentas `pro` (desde la ronda 45, tampoco se pueden asignar a una incidencia perfiles de cuentas que no sean `pro`). Los perfiles profesionales que ya hubieran creado inquilinos o caseros siguen en la base y en el directorio. Conviene buscarlos con una consulta de solo lectura (los `pros` cuyo `userId` no sea de un usuario con `role: 'pro'`) y decidir si se desactivan (`active: false`). Además, los nombres y ciudades guardados antes no se han limpiado.
- **Opiniones de profesionales (ronda 48)**: al cerrarse una incidencia, el propietario y el inquilino que la abrió pueden valorar al profesional (1 a 5 y comentario). La opinión sale en su ficha pública con el nombre y la inicial del apellido («Laura M.»). Tres decisiones: (1) ¿vale ese formato de nombre o debe ser anónima? (2) No hay forma de denunciar ni de retirar una opinión, ni de que el profesional responda; ¿hace falta moderación antes de abrir? (3) Pueden opinar los dos (propietario e inquilino) sobre la misma incidencia; ¿solo quien paga?
- **Contratos fuera de Madrid, Galicia y Cataluña (ronda 21)**: el catálogo de cláusulas solo tiene esas tres comunidades (`src/policies/clauses/catalog.v1.ts`). Para un inmueble de cualquier otra, el asistente avisa y no deja crear el contrato. Ampliarlo exige el texto legal de la fianza de cada comunidad. De paso: la cláusula de Madrid cita el «IVIMA», que desde 2017 es la Agencia de Vivienda Social; conviene revisar ese texto.
- **DNI de las partes en el contrato (ronda 21)**: el asistente pedía DNI/NIF del casero y del inquilino, pero el backend no los guardaba ni los ponía en el PDF. Se han quitado del formulario. Si el contrato debe identificarlos, hay que decidir de dónde salen (¿perfil verificado, KYC, Firma.dev?).
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

### Ronda 14 — 2026-10-11 10:31

**Qué y por qué.** Interfaz, propuesta en la ronda 13 (que fue de seguridad). El co-titular solo llegaba a su contrato por el enlace del email: «Mis contratos» no lo listaba y sus invitaciones pendientes no salían en ninguna pantalla. Además, «Mis contratos» era de las pantallas con peor aspecto que quedaban: estilos en línea, un `<select>` sin estilo, «aun» y «aparecera» sin tilde y estados de carga y error en texto suelto.

1. **Backend** (`listContracts`). `GET /api/contracts?include=cotenant` añade los contratos en los que el usuario es co-titular `JOINED` o `SIGNED`. Una invitación sin aceptar no da acceso. Cada contrato lleva `myRole` (`landlord`, `tenant` o `cotenant`). Es opcional a propósito: sin el parámetro todo sigue igual. Así el alta de incidencias, que lista los contratos activos, no ofrece contratos con los que el backend luego respondería 403. De paso, `status` solo se acepta como texto (`?status[$ne]=x` llegaba a Mongo como operador).
2. **«Mis contratos»** (`pages/MyContracts.tsx`), en la línea de `TenantHome`:
   - una lista en tarjeta, con una fila enlazada por contrato: inmueble, dirección, renta en es-ES, la otra parte, vigencia, estado y siguiente paso. En móvil el estado va arriba;
   - la etiqueta «Co-titular» en los contratos compartidos. En ellos, si la fianza está pendiente, el siguiente paso es «El inquilino principal confirma la fianza» y no «Confirmar fianza», porque el co-titular no puede pagarla;
   - un filtro con recuento («Todos», «En trámite», «Vigentes», «Cerrados») en lugar del `<select>`, que además no tenía los estados `generated`, `pending_signature`, `signing` ni `terminated`;
   - la tarjeta «Invitaciones pendientes» (`/api/me/invites`, solo para inquilinos): vivienda, arrendador, caducidad y «Acepta desde el enlace que enviamos a…». No hay botón de aceptar: aceptar exige el token del email, que es lo que demuestra que el correo es suyo. El registro no verifica el correo, así que aceptar solo con la sesión permitiría a alguien registrado con el correo de otra persona unirse a su contrato. Si la petición falla (por ejemplo, identidad sin verificar), la lista de contratos se muestra igual;
   - un vacío que menciona la invitación de co-titular, sin repetir «Buscar pisos» en la cabecera.
3. **Inicio del inquilino**: también pide los contratos de co-titular, para que el co-titular vea su alquiler, pero sin «Pagar fianza».
4. **Cabecera en móvil**: «KYC verificado» se partía en dos líneas junto al logo; ahora se oculta por debajo de 640 px, como el email.

**Commits.**
- `704b6c9` Contratos: GET /api/contracts?include=cotenant lista también los contratos del co-titular, con myRole y status solo como texto
- `630d99a` Mis contratos: contratos de co-titular marcados, invitaciones pendientes, filtro por estado y lista con el sistema visual; el co-titular no ve «Pagar fianza» en el inicio

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`: `contract.cotenant.test.ts` 8 OK (1 nuevo). El caso nuevo comprueba que sin `include` el co-titular no ve nada, que con `include` ve el contrato con `myRole: 'cotenant'` y sin `ibanEncrypted`, que el invitado sin aceptar no lo ve, que el inquilino principal tiene `myRole: 'tenant'` y que `status[$ne]` se ignora. Sigue saliendo en el log la llamada real a Stripe que ya estaba anotada; no hace fallar el test.
- Frontend: build OK; `npm test` 22 ficheros y 60 tests OK (antes 21 y 54). Nuevo `pages/__tests__/MyContracts.test.tsx` (5): co-titular marcado con su siguiente paso, filtro con recuento, invitaciones vigentes y caducadas, vacío y casero sin petición de invitaciones, y fallo de invitaciones que no rompe la lista. `TenantHome.test.tsx` suma 1: co-titular sin «Pagar fianza».
- Capturas con Playwright (vite local, `/api/*` simulado) a 390 y 1280 px, con lista e invitación y vacía. En la primera pasada salían dos «Buscar pisos» en el vacío y el estado al final de la fila en móvil; corregido. El badge de KYC partido en la cabecera de móvil también se corrigió.
- GitNexus: `impact` LOW en `listContracts`. `detect_changes` sale LOW en el backend. En el frontend sale «alto» por número de flujos, pero son solo los de `MyContracts`, `TenantHome` y `AppShell` (`NavItem`, por desplazamiento de líneas).

**Qué queda.**
- `/api/me/invites` enseña las invitaciones a cualquiera que se registre con ese correo, aunque no sea suyo (vivienda y nombre del arrendador). Es una fuga pequeña que ya existía; se cierra cuando se verifique el correo al registrarse.
- El email de invitación sigue sin decir quién invita ni qué vivienda es.
- El inquilino principal no puede reenviar una invitación caducada desde la tarjeta «Co-titulares» (habría que dar de baja y volver a invitar).
- Pendientes anteriores: A3 (sin revocación de JWT), `request-reset` con enumeración por tiempo, email sin normalizar a minúsculas, `payments.duplicates` intermitente, media de reseñas sin `$inc`, `returnUrl` libre en `/api/kyc/start`.

**Siguiente mejora propuesta.** Seguridad, que esta ronda fue de interfaz: `tokenVersion` en el usuario (A3), comprobado en `authenticate`, que invalida los JWT al restablecer la contraseña y al anular la contraseña de una cuenta vinculada (A1). Toca la ruta caliente de autenticación, así que necesita una ronda propia con tests. Si se prefiere interfaz: un email de invitación de co-titular con quién invita y qué vivienda es, y «Reenviar invitación» en la tarjeta «Co-titulares».

### Ronda 15 — 2026-10-11 10:54

**Qué y por qué.** Seguridad, propuesta en la ronda 14 (que fue de interfaz): A3, el JWT sin revocación. Era lo último pendiente de A1. Si alguien creó una cuenta con el correo de otra persona, o tenía la contraseña antigua, conservaba el token hasta 7 días aunque la víctima restableciera la contraseña o vinculara Google.

1. **Backend.**
   - `tokenVersion` en el usuario (por defecto 0).
   - Todos los JWT de sesión se firman en un solo sitio, `signAuthToken` (`src/utils/authToken.ts`), con `tv`. Antes había tres copias del payload (login y registro, OAuth e invitación de agencia).
   - `authenticate` pasa a ser asíncrono: lee `tokenVersion` y, si no coincide, responde 401 con `code: 'session_expired'`. Un token mal formado o caducado sigue dando 401, ahora con `code: 'invalid_token'`.
   - Los tokens sin `tv` cuentan como 0, así que los ya emitidos siguen valiendo y no hay migración.
   - Si el usuario no existe o Mongo no está conectado, no se comprueba nada (comportamiento de antes).
   - `optionalAuthenticate` trata un token revocado como anónimo, para que el listado público no falle.
   - Suben `tokenVersion`: `resetPassword` y la anulación de contraseña de A1 en `resolveSocialUser`. `updateUser` lo ignora.
2. **Interfaz.** Antes, un token caducado o revocado dejaba la app llena de errores sin salida. Ahora el interceptor de respuesta de `api/client.ts` (`handleSessionLost`) borra la sesión guardada ante esos dos códigos y vuelve a `/login?session=expired&redirect=<página>`. El login muestra un aviso neutro, «Tu sesión ha caducado o se cerró al cambiar la contraseña», y al entrar devuelve a la página de origen.

**Commits.**
- `c66b753` Auth: revocación de sesiones con tokenVersion (A3); restablecer la contraseña y vincular una cuenta sin verificar cierran los JWT abiertos
- `e3adfd0` Interfaz: al perder la sesión se borra y se vuelve al login con aviso y destino conservado

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`, suite completa: 64 suites y 254 tests OK. e2e: 2 suites y 10 tests OK.
- Nuevo `tests/auth/session-revocation.test.ts` (5 tests):
  - tras el reset, el token viejo da 401 `session_expired` y el nuevo (`tv: 1`) funciona;
  - un token antiguo sin `tv` sigue valiendo;
  - vincular Google a una cuenta sin verificar invalida el token del que la creó;
  - un token revocado en `/api/properties` se trata como anónimo (200);
  - `tokenVersion` no se puede cambiar por `PATCH /api/users/:id`.
- Frontend: build OK; `npm test` 23 ficheros y 66 tests OK (antes 22 y 60). Nuevos `api/__tests__/sessionLost.test.ts` (4) y 2 casos del aviso en `passwordPolicy.test.tsx`.
- Playwright (vite local, `/api/*` respondiendo 401 `session_expired`) a 390 y 1280 px: al abrir `/contracts` con sesión guardada, se borra y se llega a `/login?session=expired&redirect=%2Fcontracts` con el aviso.
- GitNexus: `impact` LOW en `authenticate`, `resetPassword` y `resolveSocialUser`. El índice no ve el `app.use`, así que en la práctica `authenticate` afecta a todas las rutas; por eso se pasó la suite completa. `detect_changes` sale alto por número de flujos, pero solo afecta a login, registro, OAuth, middleware y `LoginPage`.

**Qué queda.**
- Rol e `isVerified` siguen saliendo del token: un cambio de rol o de verificación no se aplica hasta volver a entrar. Ahora que `authenticate` ya consulta al usuario, se podrían leer de la base, pero muchos tests fabrican tokens con `isVerified` que no está en la base. Merece una ronda propia.
- Sin «Cerrar sesión en todos los dispositivos» ni cambio de contraseña con sesión iniciada (no existe el endpoint). Ambos se apoyan ya en `tokenVersion`.
- Un usuario borrado conserva su token (no se rechaza si no existe, para no romper tests con identificadores inventados).
- Pendientes anteriores: `request-reset` con enumeración por tiempo, email sin normalizar a minúsculas, `payments.duplicates` intermitente, media de reseñas sin `$inc`, `returnUrl` libre en `/api/kyc/start`, email de invitación de co-titular sin quién invita ni qué vivienda.

**Siguiente mejora propuesta.** Interfaz, que esta ronda fue de seguridad: el email de invitación de co-titular con quién invita y qué vivienda es (con `escapeHtml`), y «Reenviar invitación» en la tarjeta «Co-titulares» para invitaciones caducadas. Si se prefiere seguridad: `returnUrl` libre en `/api/kyc/start` (redirección abierta) y normalizar el email a minúsculas en el registro y el login (sin migrar producción).

### Ronda 16 — 2026-10-11 11:12

**Qué y por qué.** Interfaz y flujo del co-titular, propuesta en la ronda 15 (que fue de seguridad). El email de invitación decía solo «Has sido invitado como co-titular en un contrato de alquiler», sin quién invitaba ni qué vivienda: parecía phishing. Además, una invitación caducada no tenía arreglo: volver a invitar al mismo correo daba `already_invited`. Al probarlo salió un fallo más grave.

1. **Fallo: la tarjeta «Co-titulares» se quedaba vacía** en cuanto había una invitación pendiente. `getContractParties` hacía `String(p.userId)` antes de filtrar, y una invitación sin aceptar no tiene `userId`. La cadena `"undefined"` rompía la consulta de usuarios (500) y la interfaz lo ocultaba como lista vacía. Desde la ronda 12, el inquilino que invitaba a alguien dejaba de ver la tarjeta entera, incluido él mismo. Ahora se filtra antes de convertir.
2. **Email de invitación** (`coTenantInviteEmail` y `sendCoTenantInviteEmail` en `utils/email.ts`):
   - quién invita, qué vivienda (título y dirección), qué podrá hacer el co-titular y cuándo caduca el enlace;
   - todo el texto del usuario pasa por `escapeHtml`, y el nombre de quien invita se deja en una línea y con tope de longitud antes de ir al asunto;
   - el HTML se genera en una función pura, que se prueba sin SMTP.
3. **Reenviar invitación**:
   - endpoint `POST /api/contracts/:id/tenants/:partyId/resend`. Solo el inquilino principal, solo invitaciones `INVITED` de ese contrato y nunca en un contrato cerrado;
   - genera un token nuevo con 48 horas de validez, y el enlace anterior deja de valer;
   - si la invitación sigue vigente, como mucho un reenvío cada 10 minutos (429 `resend_too_soon`), para que no sirva para mandar correo en bucle;
   - `GET /parties` devuelve `expiresAt` y `expired` en las invitaciones pendientes.
4. **Tarjeta «Co-titulares»**: cada invitación pendiente muestra «Invitación enviada · caduca el 13 oct, 12:30» o «Invitación caducada» (ámbar), con la acción de texto «Reenviar invitación» debajo. Solo la ve el inquilino principal. Los errores salen explicados en el aviso.

**Commits.**
- `af8c60e` Co-titular: email de invitación con quién invita y qué vivienda, reenvío de invitaciones y lista de partes que no falla con invitaciones pendientes
- `8586cad` Co-titulares: caducidad de cada invitación pendiente y «Reenviar invitación» para el inquilino principal

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - `contract.cotenant.test.ts`: 11 OK (3 nuevos). Cubren el reenvío de una invitación caducada (el token viejo da 404 en la vista previa y el nuevo es válido), el límite de 10 minutos, y que el reenvío solo lo hace el inquilino principal y solo con invitaciones pendientes de ese contrato (403, 404 y 400). El test del enlace ahora comprueba también quién invita y qué vivienda;
  - nuevo `tests/unit/coTenantInviteEmail.test.ts`: 3 OK (contenido, escapado de HTML y asunto sin saltos de línea, y sin datos opcionales);
  - `tests/contracts` y `tests/unit` juntos: 93 tests, 92 OK. El que falla es `payments.duplicates`, el intermitente ya anotado. Suelto pasa 7 de 7 dos veces.
- El fallo de `getContractParties` salió con el primer test nuevo (500 «Cast to ObjectId failed for value "undefined"») y desapareció con el arreglo.
- Frontend: build OK; `npm test` 23 ficheros y 69 tests OK (antes 66). `CoTenantsCard.test.tsx` suma 3: reenviar una invitación caducada, el error `resend_too_soon` explicado, y que el co-titular no ve «Reenviar».
- Playwright (vite local, `/api/*` simulado) a 390 y 1280 px, y captura del email. En la primera pasada, el botón «Reenviar» a la derecha partía el correo en tres líneas en la columna estrecha de escritorio. Pasó a ser una acción de texto debajo del estado.
- GitNexus: `impact` LOW en `inviteCoTenant` y `getContractParties` (solo los usa la ruta). `detect_changes` sale medio y solo afecta al controlador de co-titulares (flujo `InviteCoTenant → DeliverEmail`).

**Qué queda.**
- `sendEmail` sigue sin avisar si el SMTP falla (P0-07): «Invitación reenviada» sale aunque el correo no llegue.
- La invitación de co-titular no tiene «Cancelar invitación». Solo existe la baja con aprobación del administrador (`remove-request`), que es excesiva para una invitación que nadie ha aceptado.
- Pendientes anteriores: rol e `isVerified` leídos del token, `request-reset` con enumeración por tiempo, email sin normalizar a minúsculas, `payments.duplicates` intermitente, media de reseñas sin `$inc`, `returnUrl` libre en `/api/kyc/start`.

**Siguiente mejora propuesta.** Seguridad, que esta ronda fue de interfaz: `returnUrl` libre en `/api/kyc/start` (redirección abierta, se arregla con `frontendUrl()`), y que `authenticate` lea rol e `isVerified` de la base, ya que ahora consulta al usuario (ajustando los tests que fabrican tokens). Si se prefiere fiabilidad: P0-07, que `sendEmail` devuelva si el envío falló, para que las pantallas lo digan.

### Ronda 17 — 2026-10-11 11:40

**Qué y por qué.** Seguridad, propuesta en la ronda 16 (que fue de interfaz). Dos fallos pequeños pero reales:

1. **Redirección abierta en `/api/kyc/start`.** El destino de vuelta tras verificar la identidad era `req.body.returnUrl` tal cual, así que cualquiera podía generar una sesión de verificación con la marca de la app que acababa en un dominio ajeno. Ahora `kycReturnUrl` (`src/routes/identity.routes.ts`) solo acepta rutas internas (`/…`, sin `//`, barras invertidas ni caracteres de control), las construye con `frontendUrl()` y comprueba al final que el origen es el del frontend (`/..//otro.dominio` se normaliza a `//otro.dominio`). Lo demás vuelve a `/tenant/kyc`. Hoy el frontend no llama a este endpoint, así que no cambia nada visible.
2. **Rol e `isVerified` leídos del token.** Un administrador degradado seguía siéndolo hasta 7 días, y una verificación retirada (o concedida) no se aplicaba hasta volver a entrar. `authenticate` ya consultaba al usuario desde la ronda 15 para `tokenVersion`; ahora esa misma consulta trae también `role` e `isVerified`, que mandan sobre el token. Si la cuenta no existe (tests con identificadores inventados), se usan los datos del token como antes. El atajo de tests (`ALLOW_UNVERIFIED`) sigue considerando verificado un token sin la marca.

**Commits.**
- `b56a625` KYC: returnUrl de /api/kyc/start limitado a rutas del frontend (redirección abierta)
- `1231d5c` Auth: rol e isVerified se leen de la base en cada petición; un cambio de rol o de verificación no espera a que caduque el token

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` y `tsc -p tsconfig.spec.json` sin errores.
- Jest `--runInBand`, suite completa con el cambio de `authenticate`: 65 suites y 260 tests OK (no hizo falta ajustar ningún test que fabrica tokens). `tests/auth`: 5 suites y 34 tests OK, con el nuevo `tests/auth/session-claims.test.ts` (13): administrador degradado que pierde `GET /api/users` con el mismo token y ve `role: tenant` en `/me`, verificación retirada (403) y concedida (200) sin volver a entrar, 8 casos de `kycReturnUrl` (absoluta, `//`, `/\`, `javascript:`, objeto, ruta con consulta), `/..//` que no sale del dominio, y `POST /api/kyc/start` con una URL ajena que acaba en `/tenant/kyc`.
- e2e: 2 suites y 10 tests OK.
- Frontend (sin cambios): build OK; `npm test` 23 ficheros y 69 tests OK.
- GitNexus: `impact` LOW en `authenticate` e `identity.routes.ts` (el índice no ve los `app.use`, por eso la suite completa). `detect_changes` LOW: solo `auth.middleware.ts` e `identity.routes.ts`.

**Qué queda.**
- El frontend guarda el rol del login: tras un cambio de rol, el menú sigue siendo el viejo hasta volver a entrar (el backend ya responde con el rol nuevo). Se arreglaría refrescando `/api/users/me` al arrancar.
- Un usuario borrado conserva su token (no se rechaza si no existe).
- Pendientes anteriores: P0-07 (`sendEmail` no avisa si el SMTP falla), «Cancelar invitación» de co-titular, `request-reset` con enumeración por tiempo, email sin normalizar a minúsculas, `payments.duplicates` intermitente, media de reseñas sin `$inc`.

**Siguiente mejora propuesta.** Fiabilidad e interfaz juntas: P0-07, que `sendEmail` devuelva si el envío falló y que las pantallas que dependen del correo (reenviar invitación de co-titular, recuperación de contraseña en el lado del administrador, invitación de agencia) lo digan en vez de mostrar éxito. Si se prefiere solo interfaz: refrescar el usuario con `/api/users/me` al arrancar la app, para que rol y verificación de la interfaz coincidan con los del backend.

### Ronda 18 — 2026-10-11 14:45

**Qué y por qué.** Fiabilidad e interfaz juntas, propuesta en la ronda 17: P0-07. `sendEmail` se tragaba los fallos de SMTP, así que «Invitación enviada» salía aunque el correo no llegara. Encima, la agencia no podía hacer nada: sin «Copiar enlace» (A4, ronda 4) ni reenvío, una invitación cuyo correo fallaba quedaba bloqueada 30 días (`invite_already_pending`).

1. **`deliverEmail` devuelve el resultado**, `'sent' | 'not_configured' | 'failed'`, y sigue sin lanzar. Los que ya lo llamaban lo ignoran, así que nada más cambia (GitNexus lo marca CRITICAL por los 24 dependientes; por eso se pasó la suite completa). `sendCoTenantInviteEmail` y `/api/notify/email` devuelven también el estado.
2. **Co-titular.**
   - `inviteEmailStatus` en `ContractParty`. Invitar y reenviar devuelven `emailStatus`; `/parties` marca `emailFailed`.
   - Si el último correo falló, se puede reenviar sin los 10 minutos de espera.
   - Tarjeta «Co-titulares»: aviso «Invitación guardada, pero el correo a … no salió» y estado ámbar «No se pudo enviar el correo».
3. **Agencia.**
   - El envío se espera (antes iba en segundo plano). Se guardan `emailStatus` y `emailSentAt`, la respuesta lleva `emailStatus` y la lista lleva `emailFailed`.
   - Nuevo `POST /api/agency/landlords/invites/:id/resend`:
     - solo la agencia dueña y solo invitaciones sin aceptar (vigentes o caducadas);
     - enlace nuevo con 30 días, y el anterior deja de valer;
     - espera de 10 minutos si el último correo salió bien;
     - si la invitación estaba caducada, comprueba otra vez que el propietario no tenga cuenta ni otra invitación vigente.
   - Las rutas de agencia pasan por `asyncHandler`: con Express 4, un error en esos handlers dejaba la petición colgada.
   - En «Propietarios», cada invitación sin aceptar tiene la acción de texto «Reenviar invitación», el estado «No se pudo enviar el correo» si falló, y un aviso verde, ámbar o rojo según el resultado.
4. La recuperación de contraseña no cambia a propósito: decir si el correo salió permitiría saber qué cuentas existen.

**Commits.**
- `d995447` Email: sendEmail devuelve si el correo salió (P0-07); las invitaciones de co-titular y de agencia guardan y devuelven el resultado, y la agencia puede reenviar su invitación
- `6d9a223` Interfaz: las invitaciones de co-titular y de agencia avisan si el correo no salió; la agencia puede reenviar invitaciones pendientes o caducadas desde «Propietarios»

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` y `tsc -p tsconfig.spec.json` sin errores.
- Jest `--runInBand`:
  - lo tocado, 4 suites y 30 tests OK. Casos nuevos:
    - co-titular con correo fallido: `emailFailed`, reenvío inmediato y vuelta de la espera cuando el correo sale;
    - agencia: correo fallido y reenvío (token viejo 404, nuevo 200, 429 después), caducada renovada a 30 días, y reenvío rechazado si es ajena (404), si lo pide un inquilino (403), si el propietario ya tiene cuenta (409) o si ya la aceptó (400);
    - `tests/unit/emailDelivery.test.ts`: sin SMTP devuelve `not_configured`.
  - Suite completa con `--forceExit`: 67 suites y 278 tests OK, en 539 s. El primer intento sin `--forceExit` se quedó sin terminar a los 10 minutos del límite de la herramienta y no dio resultado.
- Frontend: build OK; `npm test` 24 ficheros y 73 tests OK (antes 23 y 69). Nuevos: `AgencyLandlords.test.tsx` (3) y un caso en `CoTenantsCard.test.tsx`.
- Playwright (vite local, `/api/*` simulado), página `/agency/landlords` a 1280 y 390 px: lista con una invitación fallida, una caducada y una activa, y aviso ámbar tras reenviar. La acción y el estado caben en una línea en móvil.
- GitNexus: `impact` CRITICAL en `deliverEmail` (cambio solo aditivo, cubierto con la suite completa) y LOW en `createLandlordInvite`. `detect_changes`, con el índice del repo canónico, sale alto por desplazamiento de líneas; los cambios reales están en `email.ts`, los controladores de co-titular y agencia, los dos modelos y `notify.routes.ts`.

**Qué queda.**
- Los demás correos (contrato listo para firmar, recibos, recordatorios) siguen sin decir a nadie si fallaron; solo queda el log.
- Sin «Cancelar invitación» de co-titular ni de agencia.
- El frontend guarda el rol del login: tras un cambio de rol, el menú no cambia hasta volver a entrar.
- La suite completa de Jest tarda unos 9 minutos; conviene lanzarla en segundo plano con `--forceExit`.
- Pendientes anteriores: usuario borrado que conserva su token, `request-reset` con enumeración por tiempo, email sin normalizar a minúsculas, media de reseñas sin `$inc`.

**Siguiente mejora propuesta.** Interfaz: refrescar el usuario con `/api/users/me` al arrancar la app, para que rol, verificación y la insignia KYC coincidan con el backend (desde la ronda 17 el backend ya los lee de la base). En la misma ronda, «Cancelar invitación» de co-titular para invitaciones sin aceptar. Si se prefiere seguridad: rechazar en `authenticate` el token de un usuario borrado, ajustando los tests que usan identificadores inventados.

### Ronda 19 — 2026-10-11 15:02

**Qué y por qué.** Interfaz, propuesta en la ronda 18. Dos huecos que dejaban la interfaz desfasada respecto al backend:

1. **Sesión refrescada al arrancar.** Desde la ronda 17 el backend lee rol e `isVerified` de la base en cada petición, pero la interfaz seguía con los del login guardados en `localStorage`. Un administrador degradado seguía viendo el menú de administración, y una cuenta verificada después del login no veía la insignia «KYC verificado» hasta volver a entrar.
   - `refreshStoredUser` (`frontend/src/services/auth.ts`), llamado por `AuthProvider` al montar, pide `/api/users/me` y actualiza `email`, `role`, `isVerified` y `tenantPro` sin tocar el token.
   - Si la respuesta es 403 `owner_not_verified` (verificación retirada), marca `isVerified: false`.
   - Si falla la consulta, no hay sesión o la sesión guardada cambió mientras llegaba la respuesta (logout u otro login), no toca nada. Las sesiones caducadas siguen yendo al login por el interceptor de la ronda 15.
   - `/api/users/me` no devolvía `isVerified`. Ahora lo devuelve: `toMeUser` lo saca de la base, y `getMe` lo da también por verificado si `requireVerified` le dejó pasar por una `Verification` aprobada.
2. **«Cancelar invitación» de co-titular.** Antes, una invitación enviada al correo equivocado solo podía quitarse con la baja con aprobación del administrador.
   - Nuevo `POST /api/contracts/:id/tenants/:partyId/cancel`: solo el inquilino principal y solo invitaciones `INVITED` de ese contrato.
   - La invitación pasa a `REMOVED` y se borran el token y la caducidad, así que el enlace deja de valer (la vista previa y la aceptación exigen `INVITED`). El mismo correo puede invitarse otra vez y se reutiliza la misma fila.
   - En la tarjeta «Co-titulares», junto a «Reenviar invitación», está la acción de texto gris «Cancelar invitación». Pide confirmación en línea («El enlace dejará de valer. Sí, cancelar · No»), sin diálogo nativo.

**Commits.**
- `105414c` Sesión: al arrancar, la interfaz refresca rol y verificación con /api/users/me; /me devuelve isVerified
- `cd9419e` Co-titulares: «Cancelar invitación» para invitaciones sin aceptar

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - `contract.cotenant.test.ts`: 14 OK (2 nuevos). Cubren que cancelar invalida el enlace (vista previa 404), borra el token y deja volver a invitar el mismo correo con la misma fila. También que solo cancela el inquilino principal (otro inquilino 403, el casero 403), que da 404 con una invitación de otro contrato o con un id inválido, y 400 `not_invited` con alguien que ya se unió, sin cambiarle el estado.
  - `session-claims.test.ts`: 13 OK, ahora con `isVerified` en `/me`.
  - `tests/auth` y `tests/contracts` juntos con `--forceExit`: 22 suites y 99 tests OK.
- Frontend: build OK; `npm test` 25 ficheros y 81 tests OK (antes 24 y 73).
  - Nuevo `services/__tests__/refreshStoredUser.test.tsx` (6): actualiza rol y verificación conservando el token, no consulta sin sesión, no toca nada si falla, 403 `owner_not_verified` → no verificado, no pisa una sesión que cambió, y `AuthProvider` pasa de `admin` a `tenant` al arrancar.
  - `CoTenantsCard.test.tsx` suma 2: cancelar tras confirmar, y que «No» no cancela. Además, el co-titular no ve «Cancelar».
- Playwright (vite local, `/api/*` simulado) en el detalle de contrato a 390 y 1280 px, tarjeta normal y en confirmación (`/tmp/ra-shots19`). Las dos acciones caben en una línea en móvil y en dos en la columna estrecha de escritorio. Con una sesión guardada sin verificar y `/me` verificado, la cabecera muestra «KYC verificado» y el `localStorage` conserva el token.
- GitNexus: `impact` LOW en `toMeUser` y `AuthProvider`. `detect_changes` sale medio frente a `d2f3031`: solo afecta al flujo `AppRoutes → GetStoredUser` (paso `AuthProvider`). Lo demás son símbolos desplazados de línea en los dos controladores.

**Qué queda.**
- La sesión se refresca solo al cargar la app, no al volver a la pestaña. Un cambio de rol con la pestaña abierta se ve al recargar.
- La agencia sigue sin «Cancelar invitación» de propietario.
- Un usuario borrado conserva su token (no se rechaza si no existe).
- Pendientes anteriores: correos de contrato, recibos y recordatorios sin aviso si fallan; `request-reset` con enumeración por tiempo; email sin normalizar a minúsculas en registro y login; media de reseñas sin `$inc`.

**Siguiente mejora propuesta.** Seguridad, que esta ronda fue de interfaz: rechazar en `authenticate` el token de un usuario que ya no existe (401 `session_expired`), ajustando los tests que usan identificadores inventados con el atajo de cabeceras. En la misma ronda, normalizar el email a minúsculas y sin espacios en registro, login y recuperación, sin migrar producción. Habría que comprobar antes con una consulta de solo lectura en local si el código asume mayúsculas en algún sitio. Si se prefiere interfaz: «Cancelar invitación» para la agencia en «Propietarios», con el mismo patrón.

### Ronda 20 — 2026-10-11 15:29

**Qué y por qué.** Seguridad. La ronda 19 proponía rechazar tokens de usuarios borrados y normalizar emails, pero al releer la auditoría quedaba pendiente algo más grave: **A2**. Cualquier casero o agencia podía crear un contrato sobre un inmueble ajeno, a nombre de otro propietario y con cualquier inquilino. Estaba aplazado porque «toca muchos tests», y resultaron ser solo 7 ficheros. Al verificar salió además la causa del test intermitente `payments.duplicates`.

1. **A2 en `create` (`src/controllers/contract.controller.ts`).** Nueva función `checkContractParties`, que se ejecuta antes de crear nada:
   - el inmueble tiene que existir (404 `property_not_found`);
   - solo pueden crearlo el dueño del inmueble, la agencia que lo gestiona con `agencyAccess: 'manage'` o un administrador (403 `forbidden`). Una agencia con el inmueble ya traspasado (`status_only`) no puede;
   - el arrendador del contrato tiene que ser el dueño (400 `landlord_not_owner`), y el inquilino, otra cuenta que exista (400 `tenant_not_found` y `tenant_is_landlord`);
   - los IDs se pasan a minúsculas al validar, para que la comparación con el dueño no falle por mayúsculas. La atribución a la agencia captadora reutiliza el inmueble ya leído.
2. **Asistente de contratos** (`WizardStep3Review.tsx`): cada uno de esos códigos se muestra con un mensaje en español en vez del código en crudo.
3. **Test intermitente `payments.duplicates`.** Hoy fallaba incluso suelto (2 de 7). El índice único `(contractId, period)` de `RentPayment` se crea en segundo plano al conectar. Con la máquina cargada, el primer test de concurrencia corría antes de que existiera, y dos `upsert` simultáneos creaban dos recibos y dos PaymentIntent. El test espera ahora a `RentPayment.init()` y `Payment.init()`. El código no cambia, pero en producción la protección P3 depende de que ese índice exista (anotado en «Para Jorge»).

**Commits.**
- `7dd24b8` Contratos: solo el propietario del inmueble, su agencia gestora o un administrador pueden crearlos (A2)
- `842a53e` Tests: payments.duplicates espera a los índices únicos antes de probar la concurrencia (era el intermitente)

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - nuevo `tests/contracts/create-contract.authz.test.ts`: 9 OK. Cubre dueño (201), IDs en mayúsculas, otro casero (403, sin contrato creado), administrador con arrendador que no es el dueño (400), inquilino inexistente o igual al arrendador (400), inmueble inexistente (404), agencia gestora (201, con `agencyId`), agencia ajena o `status_only` (403), administrador (201) e inquilino (403);
  - los 6 ficheros que crean contratos, ajustados con el helper `tests/utils/contractParties.ts` (siembra casero, inquilina e inmueble): 7 suites y 32 tests OK, incluido `agencyReferral`;
  - suite completa con `--forceExit`: 68 suites y 289 tests, 288 OK. El que falló fue `payments.duplicates`; suelto falló dos veces (1 y 2 tests) y, tras el arreglo, pasó 7 de 7 tres veces seguidas;
  - e2e (`jest.config.e2e.js`): 10 OK.
- Frontend: build OK. `npm test`: 26 ficheros y 83 tests, 82 OK. El que falló fue `AppShell` (menú móvil, 2,7 s, con la suite de Jest corriendo a la vez); suelto pasa 2 de 2. Nuevo `WizardStep3Review.test.tsx` (2).
- GitNexus: `impact` LOW en `create` y `WizardStep3Review`. `detect_changes` sale medio: solo afecta a `create`, `createContractSchema` y al asistente.

**Qué queda.**
- La región del contrato no se contrasta con la del inmueble.
- El asistente `/contracts/new` sigue pidiendo IDs a mano y muestra un JSON en la revisión. Además, tras crear el contrato manda un correo de prueba a `notificaciones@rental-app.test` por `/api/notify/email`.
- Lo propuesto en la ronda 19 sigue pendiente: token de usuario borrado y email sin normalizar a minúsculas. También la agencia sin «Cancelar invitación».

**Siguiente mejora propuesta.** Interfaz, que hace tres rondas que no hay una solo de interfaz: rehacer el asistente de contratos con el sistema visual RentalApp 2026. Que elija el inmueble entre los propios (o los gestionados, si es agencia) y busque al inquilino por email en vez de pedir IDs, que la revisión sea un resumen legible en vez de JSON y que se quite el correo de prueba. Si se prefiere seguridad: rechazar el token de un usuario borrado y normalizar el email.

### Ronda 21 — 2026-10-11 15:40

**Qué y por qué.** Interfaz, como proponía la ronda 20. Al revisar el asistente de contratos apareció un flujo roto: el asistente que de verdad está enrutado en `/contracts/new` (`ContractWizard.tsx`) enviaba `propertyId`, `tenantId`, `rentAmount`, `landlordIdDoc`… Pero `POST /api/contracts` exige `landlord`, `tenant`, `property`, `region`, `rent`, `deposit`, las fechas y `clauses`. **Crear un contrato desde la interfaz daba siempre 400 `invalid_payload`**, también en producción (el esquema es el mismo en `726bf6f`). En la ronda 20 los mensajes de error se habían puesto en `WizardStep3Review`, que era código muerto de un asistente antiguo sin ruta. Aunque se hubieran corregido los nombres, habría fallado igual por `region_not_supported`: la región del inmueble es texto libre («Comunidad de Madrid») y el catálogo solo conoce `madrid`, `galicia` y `catalunya`.

1. **`frontend/src/pages/contracts/contractDraft.ts`** (lógica pura y probada):
   - `buildContractPayload`: el arrendador es el dueño del inmueble (`GET /api/properties/:id`), el inquilino es el candidato elegido, y las opciones del formulario se convierten en cláusulas del catálogo: `duracion_prorroga` (años × 12, prórroga anual), `uso_vivienda`, `mascotas` (con límite de 1 a 3), `subarriendo`, `retraso_pago` (días de margen) y `fianza_autonomica`;
   - `contractRegion` traduce la región libre a la clave del catálogo, sin tildes;
   - `contractCreateError` traduce los errores del backend al español (los de A2 y también `region_not_supported`, `invalid_date_range` e `invalid_payload`).
2. **Asistente rehecho** con los componentes de la app (`Card`, `Input`, `Button`) y el azul `--ra-blue`, sin iconos decorativos ni el aviso amarillo:
   - tres pasos en pestañas de texto: Condiciones, Cláusulas y Revisar;
   - la revisión es una lista de datos legible: inmueble, inquilino con email, fechas, importes, cláusulas y organismo de la fianza;
   - se quitan los campos que se pedían y luego se descartaban: DNI del casero (era obligatorio), DNI del inquilino, «gastos incluidos» y «día de pago»;
   - la fianza propone una mensualidad;
   - sin candidato (al entrar directamente en `/contracts/new`) explica que se crea desde los candidatos de un inmueble;
   - con una comunidad no soportada avisa y desactiva «Crear contrato»;
   - al crear abre el detalle del contrato en vez de volver al panel.
3. **Limpieza**: se borran `WizardStep1Basics`, `WizardStep2Clauses`, `WizardStep3Review` y `ClausesStep` (sin ruta ni importaciones), y con ellos el correo de prueba a `notificaciones@rental-app.test`.

**Commits.**
- `5a71430` Contratos: el asistente /contracts/new manda el cuerpo que espera el backend (antes siempre daba 400) y se rehace

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` `create-contract.authz.test.ts`: 10 OK. El caso nuevo manda el cuerpo exacto del asistente, con las seis cláusulas, y recibe 201 con el contrato en `pending_signature`.
- Frontend: build OK; `npm test` 27 ficheros y 90 tests OK (antes 26 y 83; se quitan 2 del asistente antiguo y se suman 9). Nuevos:
  - `contractDraft.test.ts` (5): regiones, fecha de fin, cuerpo completo, dueño poblado y errores;
  - `ContractWizard.test.tsx` (4): sin candidato, creación completa con navegación al detalle, comunidad no soportada y error `forbidden` en español.
- Playwright (vite local, `/api/*` simulado, sesión de casero) a 390 y 1280 px, los tres pasos (`/tmp/ra-shots21`). En los dos tamaños, el cuerpo capturado en `POST /api/contracts` es el que acepta el backend y la página acaba en `/contracts/c77`.
- GitNexus: `impact` LOW en `ContractWizard`. `detect_changes` LOW: solo cambia `ContractWizard` y no afecta a ningún flujo.

**Qué queda.**
- Solo se llega al asistente desde «Crear contrato» en los candidatos de un inmueble (`ApplicantsModal`, panel del casero). La agencia no tiene ruta (`/contracts/new` es solo para `landlord` y `admin`), aunque el backend se lo permite con `agencyAccess: 'manage'`.
- La región del contrato no se contrasta en el backend con la del inmueble; el asistente la deriva del inmueble.
- Comunidades fuera del catálogo y DNI de las partes: anotado en «Para Jorge».
- Pendientes anteriores: token de usuario borrado, email sin normalizar a minúsculas y «Cancelar invitación» para la agencia.

**Siguiente mejora propuesta.** Seguridad, que esta ronda fue de interfaz: rechazar en `authenticate` el token de un usuario que ya no existe (401 `session_expired`) y normalizar el email a minúsculas en registro, login y recuperación. Si se prefiere seguir con contratos: que el backend derive la región del inmueble en vez de fiarse del cuerpo, y abrir `/contracts/new` a la agencia gestora desde su panel.

### Ronda 22 — 2026-10-11 16:06

**Qué y por qué.** Seguridad, como proponían las rondas 19 y 21. Dos huecos de cuentas:

1. **Correo sensible a mayúsculas.** El registro guardaba el correo tal cual y el índice único lo distingue, así que «Ana@x.com» y «ana@x.com» eran dos cuentas. Entrar con otras mayúsculas daba «Usuario o contraseña incorrectos» y la recuperación no encontraba la cuenta. Peor: Google y Apple entregan el correo en minúsculas, de modo que una cuenta con mayúsculas no se vinculaba al entrar con Google y se creaba una segunda. Las comprobaciones de «ya tiene cuenta» de las invitaciones de agencia y del alta por administrador también fallaban.
   - Nuevo `src/utils/userEmail.ts`: `normalizeEmail`, `findUserByEmail` y `emailInUse`. Busca primero la forma en minúsculas (usa el índice) y, si no está, una cuenta antigua con otras mayúsculas (`collation` con `strength: 2`). No hace falta migrar producción.
   - Usado en `register` (guarda en minúsculas; rechaza un correo ya usado con otras mayúsculas, con el mismo 400 de antes), `login`, `requestPasswordReset`, `resolveSocialUser`, `createUser` y las tres comprobaciones de `agencyInvite.controller.ts`.
2. **Token de una cuenta borrada.** `authenticate` dejaba pasar el token de un usuario que ya no existía, con el rol del token. Ahora `loadSessionUser` lo trata como revocado: 401 `session_expired`, y la interfaz manda al login con el interceptor de la ronda 15. `optionalAuthenticate` lo trata como anónimo.
   - Once ficheros de tests firmaban tokens con identificadores inventados. El nuevo `tests/utils/sessionToken.ts` (`sessionToken` y `bearer`) crea la cuenta con el rol y la verificación del token antes de firmarlo.

**Commits.**
- `46fe929` Auth: el correo de la cuenta no distingue mayúsculas en registro, login, recuperación, Google y altas de agencia/admin
- `20552e6` Auth: el token de una cuenta borrada deja de valer (401 session_expired)

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. `tsc -p tsconfig.spec.json` solo da un error en los ficheros tocados, `escrow.release.recovery.test.ts:145` (índice de una tupla del mock de Stripe), y ya estaba antes.
- Jest `--runInBand`:
  - antes de ajustar los tests, el cambio de `authenticate` rompía 11 ficheros; tras el ajuste, esos 13 ficheros dan 40 tests OK;
  - `tests/auth`: 6 suites y 40 tests OK. Nuevo `email-case.test.ts` (6): registro en minúsculas, duplicado con otras mayúsculas rechazado, login con otras mayúsculas (cuenta antigua y nueva), recuperación de una cuenta antigua, Google que vincula la cuenta antigua sin crear otra, y token de cuenta borrada que da 401 `session_expired`;
  - suite completa con `--forceExit`: 69 suites y 296 tests OK, en 724 s;
  - e2e: 2 suites y 10 tests OK.
- Frontend (sin cambios): build OK; `npm test` 27 ficheros y 90 tests OK.
- GitNexus: `impact` LOW en `login`, `resolveSocialUser` y `createLandlordInvite`. `loadSessionUser` no está en el índice (es de la ronda 15), por eso se pasó la suite completa. `detect_changes` sale alto: afecta a los flujos de registro, login, recuperación de contraseña e invitación de agencia, que son los que se querían cambiar.

**Qué queda.**
- Posibles cuentas duplicadas por mayúsculas en producción: anotado en «Para Jorge».
- `request-reset` sigue con enumeración por tiempo (con cuenta tarda lo que tarda el SMTP).
- La región del contrato no se contrasta en el backend con la del inmueble.
- La agencia no tiene `/contracts/new` ni «Cancelar invitación» de propietario.

**Siguiente mejora propuesta.** Contratos, que dejó pendientes la ronda 21: que `POST /api/contracts` derive la región del inmueble en vez de fiarse del cuerpo, y abrir el asistente a la agencia gestora desde su panel. Si se prefiere interfaz pura: «Cancelar invitación» para la agencia en «Propietarios», con el patrón de co-titulares.

### Ronda 23 — 2026-10-11 16:22

**Qué y por qué.** Contratos, como proponía la ronda 22, y el modal de candidatos, que es la única entrada al asistente:

1. **La región del contrato sale del inmueble.** `POST /api/contracts` aceptaba la `region` del cuerpo sin compararla con la del inmueble. Quien creaba el contrato podía elegir otra comunidad y, con ella, otra cláusula de fianza autonómica (otro organismo de depósito) y otro texto en el PDF.
   - Ahora el backend traduce la región libre del inmueble a la clave del catálogo con `contractRegionKey` (`src/policies/clauses/index.ts`, misma regla que `contractRegion` del asistente) y usa esa.
   - El cuerpo puede omitir `region`. Si la manda y es otra, da 400 `region_mismatch` (con `propertyRegion`). Si el inmueble está fuera del catálogo, da `region_not_supported`.
   - La comprobación de quién crea el contrato (A2) va antes que la de las cláusulas. Un inmueble ajeno da 403 aunque el cuerpo tenga además otros errores.
   - El asistente traduce `region_mismatch` al español.
2. **Modal «Solicitudes» del casero (`ApplicantsModal`)**, tres fallos:
   - **Candidato inventado**: si fallaba `GET /properties/:id/applications`, mostraba un «Carlos Inquilino» falso con `tenant_1`, y «Crear contrato» llevaba al asistente con ese id. Ahora dice «No se pudieron cargar los candidatos» y ofrece «Reintentar».
   - **Hora de la visita desplazada**: mandaba el valor de `datetime-local` sin zona («2026-10-16T18:00») y el servidor, en UTC, lo guardaba como 18:00 UTC: 2 h tarde en verano. Ahora manda el instante en ISO. El backend rechaza una fecha inválida con 400 `invalid_visit_date` (antes daba 500 al guardar).
   - **Errores tragados**: proponer una visita avisaba de éxito aunque el servidor fallara, y aceptarla no capturaba el error. Ahora los dos muestran el error en español y recargan la lista desde el servidor.
   - Apariencia, con el estilo de las rondas 12 y 21: estado en una línea de texto de color («El candidato propone visita el…», «Visita el…», «Sin visita») en lugar de pastillas con icono, «Solvencia verificada» en lugar de la pegatina «SOLVENTE», el mensaje sin cursiva ni comillas, botones en minúscula inicial («Crear contrato» ya no aparece medio transparente) y scroll dentro del modal para listas largas en móvil.

La agencia gestora sigue sin acceso al asistente. Al revisarlo, su panel no tiene ni lista de inmuebles gestionados ni de candidatos, y `GET /properties/:id/applications` es solo del dueño. Es una funcionalidad entera, no un enlace; queda como propuesta.

**Commits.**
- `fed0cfe` Contratos: la región (y la fianza autonómica) sale del inmueble; una región distinta en el cuerpo da 400 region_mismatch
- `73a89fd` Candidatos: el modal no inventa un candidato si falla la carga, la visita se manda en ISO y los errores se muestran; el backend rechaza fechas inválidas con 400

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - `tests/contracts`: 18 suites y 80 tests OK. Nuevos en `create-contract.authz.test.ts` (5): sin región usa la del inmueble; «A Coruña, Galicia» da `galicia`; región distinta da `region_mismatch`; inmueble en Andalucía da `region_not_supported`; región inexistente da `region_not_supported`. Ajustado `contract.integration.test.ts`, que no sembraba el inmueble.
  - `tests/agency/agencyReferral.test.ts` (también crea contratos): 14 OK.
  - Nuevo `tests/applications/visit-proposal.test.ts` (4): instante ISO guardado tal cual, fecha inválida da 400 sin tocar la solicitud, falta de fecha, y casero ajeno da 403.
  - e2e: 2 suites y 10 tests OK.
- Frontend: build OK; `npm test` 28 ficheros y 94 tests OK (antes 27 y 90). Nuevo `ApplicantsModal.test.tsx` (4): sin candidatos falsos y reintento, fecha en ISO con error `forbidden` en español, aceptar visita y recargar, y «Crear contrato» que abre el asistente.
- Playwright (vite local, `/api/*` simulado, sesión de casero, `TZ=Europe/Madrid`) a 390 y 1280 px (`/tmp/ra-shots23`): lista de tres candidatos y formulario de visita. Las 18:00 de Madrid llegan al servidor como `2026-10-16T16:00:00.000Z`.
- GitNexus: `impact` LOW en `create`, `proposeVisit` y `ApplicantsModal`. `detect_changes` sale alto en la primera parte solo por el desplazamiento de líneas en `index.ts` (`getCatalogByRegion` no cambia); en la segunda sale medio, limitado al flujo `ApplicantsModal → GetPropertyApplications`.

**Qué queda.**
- Visitas ya guardadas con la hora desplazada en producción: anotado en «Para Jorge».
- La agencia gestora no puede ver candidatos ni crear contratos desde la interfaz.
- `LandlordDashboard` sigue enviando a mano `Authorization` en varias llamadas, aunque ya lo pone el cliente; es redundante, no un fallo.
- Pendientes anteriores: enumeración por tiempo en `request-reset` y «Cancelar invitación» de propietario para la agencia.

**Siguiente mejora propuesta.** Agencia: `GET /api/agency/properties` con los inmuebles que gestiona (`agencyAccess: 'manage'`), abrir `GET /properties/:id/applications` y la propuesta de visitas a esa agencia, y una página «Inmuebles» en su panel que reutilice `ApplicantsModal` y lleve al asistente (abriendo `/contracts/new` al rol `agency`). Si se prefiere algo más corto: «Cancelar invitación» de propietario en «Propietarios», con el patrón de co-titulares.


### Ronda 24 — 2026-10-11 16:32

**Qué y por qué.** Fallos de cobro, que tienen prioridad sobre la funcionalidad de agencia que proponía la ronda 23. Al revisar el hueco de la auditoría «se siguen generando recibos después del fin», aparecieron tres fallos más claros en el cobro de la renta:

1. **`POST /api/contracts/:id/payments/:period/pay` cobraba cualquier mes.** Solo validaba el formato `YYYY-MM`. Un inquilino podía pagar (y crear el recibo de) `2099-12`, `1999-01` o cualquier mes anterior al inicio, y además en un contrato `terminated`, `draft` o `cancelled`: no se comprobaba el estado. Ahora:
   - el mes tiene que estar entre el de inicio del contrato y el mes en curso: 400 `period_before_start` o `period_in_future`;
   - el contrato tiene que estar `active` o `signed` (como en `/pay-rent`): 400 `contract_not_active`;
   - una renta no positiva da 400 `invalid_rent`.
2. **`/pay-rent` cobraba antes de empezar.** Con un contrato `signed` que empieza el mes que viene, cobraba la renta de este mes. Ahora da `period_before_start`. El mes y el concepto salen de la hora de Madrid (antes, de la zona del servidor).
3. **El job diario de recibos (`runRentGeneration`) se paraba entero.** Hacía `findOne` y luego `create` dentro de un único `try`. Si el inquilino creaba el recibo a la vez (E11000 del índice único) o un contrato daba error, el resto de contratos se quedaba sin recibo ese día. Además creaba recibos de 0 € para contratos sin renta. Ahora:
   - `upsert` atómico por contrato, con un error aislado por contrato;
   - sin recibos de importe no válido ni de meses anteriores al inicio;
   - el periodo, en hora de Madrid;
   - devuelve `{ period, created, failed }`.

Todo sale del nuevo `src/utils/rentPeriod.ts` (`rentPeriodOf`, `checkRentPeriod`, `billableRent`). No se corta en `endDate`: con la prórroga de la LAU eso es una decisión (anotada en «Para Jorge»).

No se ha tocado `contract.payments.routes.ts` (`pay-rent-saved`), que es el flujo pendiente de la decisión P1.

**Commits.**
- `f8c1f8f` Renta: solo se cobran meses del contrato (desde el inicio hasta el mes en curso) y de contratos vigentes; el job de recibos no se detiene si falla un contrato

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - nuevo `tests/contracts/rent-periods.test.ts` (7):
    - mes en hora de Madrid en el cambio de mes;
    - rango del inicio al mes en curso;
    - mes pasado del contrato cobrado;
    - futuro, anterior al inicio y `1999-01` rechazados sin recibo ni PaymentIntent;
    - contrato terminado rechazado;
    - `/pay-rent` de un contrato que aún no empieza, rechazado;
    - job con un recibo ya pagado, uno sin renta, uno sin empezar, uno terminado y uno válido (crea solo ese, con 950 €, y repetirlo no crea nada).
  - `contract.cotenant.test.ts` usaba el mes fijo `2026-01` con un contrato que empieza hoy; ahora usa el mes en curso. `payments.duplicates` calcula el mes con `rentPeriodOf`.
  - `tests/contracts`: 19 suites y 87 tests OK. e2e: 2 suites y 10 tests OK (incluye el job dos veces y el pago con webhook).
- Frontend (sin cambios; no hay llamadas a `/pay-rent` ni a `/payments/:period/pay`): build OK; `npm test` 28 ficheros y 94 tests OK.
- GitNexus: `impact` LOW en `payRentForPeriod` y `runRentGeneration`. `detect_changes` sale alto porque marca `initiatePayment` por el desplazamiento de líneas tras el import; el código de esa función no cambia.

**Qué queda.**
- Recibos después de `endDate` y vencimiento del contrato: decisión anotada en «Para Jorge».
- No hay estado `OVERDUE` ni recordatorios de impago.
- La agencia gestora sigue sin ver candidatos ni crear contratos desde la interfaz (propuesta de la ronda 23).

**Siguiente mejora propuesta.** La de la ronda 23, que es de interfaz y lleva tres rondas sin tocarse: «Inmuebles» en el panel de la agencia gestora. Incluye `GET /api/agency/properties` con `agencyAccess: 'manage'`, abrir los candidatos y la propuesta de visitas a esa agencia y llevar al asistente reutilizando `ApplicantsModal`. Si se prefiere algo más corto: «Cancelar invitación» de propietario en «Propietarios».

### Ronda 25 — 2026-10-11 16:42

**Qué y por qué.** Seguridad de cuentas e interfaz, que llevaba dos rondas sin tocarse. La auditoría tenía pendiente «Cambio de contraseña desde la cuenta». El botón «Cambiar contraseña» del perfil solo llevaba a `/forgot-password`: había que pedir un correo de recuperación para cambiarla. Además, no había forma de echar a alguien que tuviera la contraseña sin pasar por ese correo. La funcionalidad de agencia que proponía la ronda 24 es más larga y queda para otra ronda.

1. **`POST /api/auth/change-password`** (`changePassword` en `auth.controller.ts`):
   - exige sesión (`authenticate`) pero no identidad verificada, y usa el limitador de login (20 cada 15 minutos);
   - pide la contraseña actual (400 `wrong_password`) y aplica la política de la nueva (8 a 200 caracteres); repetir la actual da 400 `same_password`;
   - sube `tokenVersion`, así que se cierran todas las sesiones, y devuelve un token nuevo para que el dispositivo actual siga dentro; anula también un token de recuperación pendiente;
   - una cuenta de Google o Apple sin contraseña recibe 400 `password_not_set` (la elige por correo, que demuestra que controla el buzón);
   - avisa al titular por correo («si no has sido tú, recupera tu cuenta»), sin esperar al SMTP.
2. **Perfil (`/profile`)**:
   - nueva tarjeta `ChangePasswordCard`: contraseña actual, nueva y repetida, errores en español en la propia tarjeta y aviso de que se cierran las otras sesiones; el token nuevo se guarda con `changePassword` de `AuthContext`;
   - la página adopta el estilo de las rondas 12 y 21: sin la banda con degradado azul, con la cabecera en una línea de texto («Inquilino · Identidad verificada») en lugar de las pegatinas en mayúsculas «KYC VERIFICADO»;
   - la puntuación ya no sale duplicada en la cabecera y la tarjeta;
   - las secciones de solvencia y perfil profesional ya no van en cajas azul y naranja;
   - se han puesto tildes y eñes («Teléfono», «Puntuación», «Fontanería»…), y la etiqueta «Nombre personal (verificado)», que se mostraba aunque no lo estuviera, ahora es «Nombre».

**Commits.**
- `55ebdaa` Auth: cambiar la contraseña con la sesión iniciada (pide la actual, cierra las demás sesiones y avisa por correo)
- `2120eca` Perfil: cambiar la contraseña desde la cuenta (antes enviaba a la recuperación por correo) y la página sin degradado, con tildes y sin pegatinas

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand` `tests/auth`: 7 suites y 45 tests OK. El nuevo `change-password.test.ts` tiene 5 casos:
  - el cambio revoca los tokens de los dos dispositivos y el token devuelto sigue valiendo;
  - la contraseña actual incorrecta no toca ni el hash ni `tokenVersion`;
  - la contraseña corta y la repetida se rechazan;
  - una cuenta de Google recibe `password_not_set`;
  - sin sesión da 401.
- Frontend: build OK; `npm test` 29 ficheros y 98 tests OK (antes 28 y 94). El nuevo `ChangePasswordCard.test.tsx` tiene 4 casos: guarda el token nuevo; no envía una contraseña corta ni una que no coincide; muestra `wrong_password` en español sin tocar la sesión; y la cuenta de Google ve el enlace a `/forgot-password`.
- Playwright (vite local, `/api/*` simulado, sesión de inquilina) a 390 y 1280 px (`/tmp/ra-shots25`): perfil completo, error de contraseña actual y cambio correcto. El token guardado pasa a ser el nuevo.
- GitNexus: `impact` LOW en `ProfilePage` y `resetPassword`. `detect_changes` sale bajo en los dos commits, sin flujos afectados.

**Qué queda.**
- La barra superior (`AppShell`) sigue mostrando la pegatina «KYC VERIFICADO» en mayúsculas.
- El perfil no deja cambiar el correo; las cuentas de Google y Apple no pueden añadir contraseña desde la cuenta, solo por correo.
- Pendientes anteriores: «Inmuebles» de la agencia gestora, enumeración por tiempo en `request-reset` y «Cancelar invitación» de propietario para la agencia.

**Siguiente mejora propuesta.** La de las rondas 23 y 24: «Inmuebles» en el panel de la agencia gestora, con `GET /api/agency/properties` filtrado a `agencyAccess: 'manage'`, candidatos y propuesta de visitas abiertos a esa agencia y `ApplicantsModal` hasta el asistente. Si se prefiere algo corto: quitar la pegatina «KYC VERIFICADO» de la barra superior y cerrar la enumeración por tiempo de `request-reset` enviando el correo sin esperar.

### Ronda 26 — 2026-10-11 16:57

**Qué y por qué.** Fallos de cobro en el webhook de Stripe, apuntados como pendientes en la auditoría de seguridad («Stripe, eventos»). La interfaz se tocó en la ronda 25, así que tocaba un fallo.

1. **Las devoluciones no se registraban.** Si se devolvía una renta desde Stripe, el pago seguía `succeeded` y el recibo `PAID`, y el arrendador y los informes fiscales la contaban como cobrada. Ahora el webhook gestiona `charge.refunded`:
   - si la devolución es total, `Payment` pasa a `refunded` (con `amountRefunded` y `refundedAt`) y `RentPayment` a `REFUNDED`, un estado nuevo;
   - si es parcial, solo se anota `amountRefunded`;
   - en los dos casos queda en el historial del contrato (`paymentRefunded` o `paymentPartiallyRefunded`);
   - una devolución que no corresponde a ningún pago se registra en el log y se responde 200.
2. **Un mes devuelto no se vuelve a cobrar solo.** `claimRentPayment` devuelve `refunded`, y `/pay-rent` y `/payments/:period/pay` responden 409 `rent_refunded`. Si debe poder volver a pagarse es una decisión, anotada en «Para Jorge».
3. **Eventos tardíos.** `payment_intent.succeeded`, `processing` y `payment_failed` ya no pisan un pago o un recibo devuelto.
4. **La URL del recibo nunca se guardaba.** Se leía de `intent.charges`, que no existe en la API `2022-11-15` con la que se crea el cliente. Ahora sale de `latest_charge` (con `charges.retrieve` si viene solo el ID) y se guarda también `stripeChargeId`. Si Stripe falla al leer el cargo, el pago se confirma igual, sin recibo.

`deposit.ts` ya redondeaba los céntimos, así que esa parte del pendiente estaba hecha.

**Commits.**
- `c18c8e5` Stripe: las devoluciones (charge.refunded) marcan el pago y el recibo de renta como devueltos, y la URL del recibo sale de latest_charge

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`, nuevo `tests/contracts/payments.refunds.test.ts` (5 casos):
  - `latest_charge` da el cargo y la URL del recibo;
  - si falla la lectura del cargo, el pago se confirma sin recibo;
  - una devolución parcial solo anota el importe;
  - una devolución total marca pago y recibo como devueltos, resiste `succeeded`, `processing` y `failed` tardíos y bloquea las dos rutas de cobro (409) sin crear PaymentIntent;
  - una devolución desconocida da 200 sin cambiar nada.
- Jest `--runInBand` de `tests/contracts`, `tests/chat` y `tests/escrow`: 26 suites y 110 tests OK. e2e: 2 suites y 10 tests OK.
- Frontend (sin cambios; ya trataba `refunded`): build OK. `npm test` dio una vez 97/98 mientras Jest corría a la vez; al repetirlo, 29 ficheros y 98 tests OK.
- GitNexus: el índice es el de la copia canónica y no tiene `claimRentPayment`, así que los llamadores (los dos controladores de renta) se comprobaron con grep. `detect_changes` da riesgo medio. Marca `maybePayAgencyRentFeeShare` solo porque `chargeReceipt` se añadió encima y desplaza sus líneas; su código no cambia.

**Qué queda.**
- Disputas (`charge.dispute.created` y `closed`): no se gestionan.
- Devolución de la fianza: el Checkout no pone `contractId` en el PaymentIntent, así que `charge.refunded` no la reconoce.
- Revertir la parte de la agencia al devolver una renta: decisión anotada en «Para Jorge».
- Pendientes anteriores: «Inmuebles» de la agencia gestora, la pegatina «KYC VERIFICADO» de `AppShell` y la enumeración por tiempo en `request-reset`.

**Siguiente mejora propuesta.** Ronda de interfaz: quitar la pegatina «KYC VERIFICADO» de la barra superior (`AppShell`) y empezar «Inmuebles» en el panel de la agencia gestora (`GET /api/agency/properties` con `agencyAccess: 'manage'`). Si se prefiere seguir con pagos: `payment_intent_data.metadata` en el Checkout de la fianza y `charge.dispute.*`.

### Ronda 27 — 2026-10-11 17:10

**Qué y por qué.** Ronda de interfaz, la que proponían las rondas 23 a 26. La agencia gestora no tenía dónde ver sus inmuebles. Podía crear contratos (backend, ronda 20), pero no llegaba a los candidatos ni al asistente. Además, la barra superior seguía con la pegatina «KYC verificado».

1. **Backend: la agencia gestora actúa por el propietario.**
   - Nuevo `src/utils/propertyAccess.ts` con `isManagingAgency(user, property)`: la agencia es `agencyId` y el inmueble sigue en `agencyAccess: 'manage'`.
   - `GET /properties/:id/applications`, `POST /applications/:id/propose` y `POST /applications/:id/accept` admiten el rol `agency` si gestiona el inmueble. Sus propuestas cuentan como del propietario (`proposedBy: 'landlord'`), así que no puede aceptarse a sí misma; acepta las del candidato.
   - Otra agencia o un inmueble ya traspasado dan 403.
   - `GET /api/agency/properties` añade el nombre del propietario, la región, y, solo mientras lo gestiona, precio, fianza y solicitudes abiertas (sin las descartadas, contadas con un `aggregate`).
2. **Frontend: página «Inmuebles» (`/agency/properties`)**, en el menú de la agencia entre «Inicio» y «Propietarios».
   - Lista los gestionados con el estado en texto (Publicado, Borrador, Alquilado, Archivado), el precio, el propietario y el último cobro, más el número de solicitudes y el botón «Candidatos». Ese botón abre el `ApplicantsModal` de siempre, con precio y fianza para el asistente.
   - Los traspasados van aparte y sin acciones.
   - Hay estados de carga, error con «Reintentar» y vacío (con enlace a «Propietarios»).
   - `/contracts/new` se abre al rol `agency`. El asistente, sin candidato o al terminar sin ID, lleva a `/agency/properties` en vez de a `/landlord`.
   - El aviso `forbidden` del modal menciona a la agencia.
3. **Cabecera (`AppShell`)**: fuera la pegatina «KYC verificado». El estado está en «Verificación» y en el perfil (ronda 25).

**Commits.**
- `932b3ba` Agencia: la agencia gestora ve los candidatos de sus inmuebles y propone o acepta visitas; su listado trae propietario, precio, fianza y solicitudes abiertas
- `aa03557` Agencia: página «Inmuebles» con los que gestiona (candidatos, visitas y asistente de contratos) y los traspasados; la cabecera deja la pegatina «KYC verificado»

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand` de `tests/agency`, `tests/applications` y `tests/properties/property.routes.test.ts`: 4 suites y 32 tests OK. El nuevo `tests/agency/agencyManagedProperties.test.ts` tiene 5 casos:
  - el listado trae propietario, precio y solicitudes abiertas (sin contar la descartada);
  - tras el traspaso no hay precio y los candidatos y las visitas dan 403;
  - la gestora ve los candidatos;
  - otra agencia recibe 403;
  - la gestora propone (queda como `landlord`), no puede aceptar su propia propuesta y acepta la del candidato.
- Frontend: build OK. `npm test`: 30 ficheros y 101 tests OK (antes 29 y 98). El nuevo `AgencyProperties.test.tsx` tiene 3 casos: secciones y apertura del modal con precio y fianza, estado vacío y reintento tras un error. Se ha actualizado el texto esperado en `ApplicantsModal.test.tsx`.
- Playwright (vite local, `/api/*` simulado, sesión de agencia) a 390 y 1280 px (`/tmp/ra-shots27`): la página, el modal de candidatos y «Crear contrato», que llega a `/contracts/new` con la dirección, la renta y la fianza rellenas. La cabecera sale sin la pegatina.
- GitNexus: `impact` LOW en `listApplications`, `proposeVisit` y `listAgencyProperties`. `detect_changes` sale medio porque el índice es el de la copia canónica y en `services/agency.ts` las funciones solo se desplazan. Los flujos tocados son los esperados (`AppRoutes` y `ApplicantsModal`).

**Qué queda.**
- La agencia no tiene «Contratos» en su menú. El backend ya le lista los suyos (`listContracts` filtra por `agencyId`), pero falta comprobar que `MyContracts` y `ContractDetail` se ven bien con ese rol. La miga «Contratos» del asistente lleva a `/contracts`.
- En el modal, una visita que propuso el propietario sale como «Has propuesto» también para la agencia.
- La agencia no puede crear ni editar inmuebles desde su panel; la API ya admite `agency` en `PUT /properties/:id`.
- Pendientes anteriores: disputas de Stripe, `contractId` en el PaymentIntent de la fianza, enumeración por tiempo en `request-reset` y «Cancelar invitación» de propietario.

**Siguiente mejora propuesta.** Terminar el circuito de la agencia: «Contratos» en su menú, revisando `MyContracts` y `ContractDetail` con el rol `agency` (qué ve y qué acciones le corresponden). Si se prefiere seguridad: cerrar la enumeración por tiempo de `request-reset` enviando el correo sin esperar.

### Ronda 28 — 2026-10-11 19:40

**Qué y por qué.** Un fallo de seguridad corto, pendiente desde la ronda 13, y terminar el circuito de la agencia que proponía la ronda 27. Al revisar ese circuito salieron dos fallos que lo dejaban roto.

1. **Enumeración de cuentas por tiempo en `request-reset`.** La ruta esperaba a guardar el token y al SMTP solo si la cuenta existía, así que tardaba más con un correo registrado. Ahora responde `{ ok: true }` en cuanto valida el cuerpo, y la búsqueda, el token y el correo van en `issuePasswordReset`, sin esperar. Un SMTP caído o lento ya no se nota en la respuesta. Lo que la ronda 13 temía (P0-07) no aplica: la respuesta ya era idéntica tanto si el envío salía bien como si fallaba.
2. **La agencia gestora no podía abrir sus contratos.**
   - Backend: `getContract` comprobaba que la agencia gestionaba el inmueble y, unas líneas más abajo, la rechazaba con 403 por no ser arrendador, inquilino ni administrador. `GET /:id/parties` tampoco la admitía. Ahora entra la agencia que sigue gestionando el inmueble y es la `agencyId` del contrato. Los co-titulares son de solo lectura. Otra agencia, o la gestora tras el traspaso, reciben 403. El PDF ya pasaba por `ensureCanReadContract`, que sí la admitía.
   - Frontend: `/contracts` y `/contracts/:id` no admitían el rol `agency`, de modo que el asistente, al crear el contrato, la mandaba a una página prohibida. Además, `MyContracts` descartaba los contratos en los que el usuario no era parte, y la lista salía siempre vacía para la agencia y también para el administrador.
3. **«Contratos» en el menú de la agencia** (entre «Inmuebles» y «Propietarios»). Cada fila dice «Propietario: … · Inquilino: …». El subtítulo y el estado vacío hablan de «los inmuebles que gestionas», con el botón «Ver inmuebles». En un borrador, el siguiente paso para la agencia es «Revisar los datos con el propietario, que lo envía a firma», porque enviarlo a firma es cosa del propietario (`ensureLandlordOrAdmin`).

**Commits.**
- `8d447c1` Auth: request-reset responde antes de buscar la cuenta y enviar el correo (sin enumeración por tiempo)
- `a194622` Contratos: la agencia gestora abre el detalle y los co-titulares de sus contratos (getContract la dejaba pasar y luego daba 403)
- `338c7fd` Agencia: «Contratos» en su menú, con propietario e inquilino en cada fila; la lista ya no descarta los contratos en los que la agencia o el admin no son parte

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - `tests/auth`: 7 suites y 46 tests OK. El caso nuevo en `reset.test.ts` usa un SMTP que no responde nunca: la petición contesta en menos de 1 s y el token se genera igual. Los tests que leen el correo esperan ahora al envío en segundo plano.
  - e2e (`jest.config.e2e.js`): 2 suites y 10 tests OK, incluido el reset completo.
  - `tests/contracts` y `tests/agency`: 22 suites y 113 tests OK. Dos casos nuevos en `agencyManagedProperties.test.ts`: la gestora lista, abre el detalle (sin `ibanEncrypted`) y ve los co-titulares; otra agencia, o la gestora tras el traspaso, reciben 403. Con los controladores de antes, el primero falla (comprobado).
- Frontend: build OK y `npm test` con 30 ficheros y 102 tests OK (antes 101). El caso nuevo de `MyContracts.test.tsx` comprueba, con el rol de agencia, la fila con propietario e inquilino, el siguiente paso y «Ver inmuebles». Falló con el filtro anterior, y así salió el segundo fallo del frontend.
- Playwright (vite local, `/api/*` simulado, sesión de agencia) a 390 y 1280 px (`/tmp/ra-shots28`): «Contratos» en el menú, la lista con los dos contratos y el detalle de un borrador, que se abre al pulsar la fila.
- GitNexus: `impact` LOW en `requestPasswordReset`. `detect_changes` sale medio, con los flujos esperados (`RequestPasswordReset → DeliverEmail`, `AppRoutes` y `MyContracts`). `resetPassword` y `redactEmail` aparecen solo porque el índice es de la copia canónica y sus líneas se desplazan; no cambian.

**Qué queda.**
- El detalle del contrato (`ContractDetail`) conserva el estilo antiguo: banda de color, «Timeline legal» y «Resumen Económico» en mayúsculas y el contrato en serif. En móvil, el botón «Descargar borrador» se sale de la tarjeta de cabecera.
- En el modal de candidatos, la visita que propuso el propietario sale como «Has propuesto» también para la agencia.
- La agencia no puede crear ni editar inmuebles desde su panel.
- Pendientes anteriores: disputas de Stripe, `contractId` en el PaymentIntent de la fianza y «Cancelar invitación» de propietario.

**Siguiente mejora propuesta.** Interfaz: pasar `ContractDetail` al sistema «RentalApp 2026»: cabecera sin banda de color, sin etiquetas en mayúsculas ni «ID Referencia», botones que no se salgan en móvil y la vista previa del contrato sin serif ni cursiva. Es la pantalla que más ven inquilinos, caseros y agencias. Si se prefiere pagos: `payment_intent_data.metadata.contractId` en el Checkout de la fianza, para que `charge.refunded` la reconozca.

### Ronda 29 — 2026-10-11 19:51

**Qué y por qué.** Ronda de interfaz, la que proponía la ronda 28. El detalle del contrato es la pantalla que más ven inquilinos, caseros y agencias, y seguía con el estilo antiguo: banda de color en la cabecera, «ID Referencia», etiquetas en mayúsculas («Timeline legal», «Resumen Económico»), la vista previa en serif con cursiva y una marca de agua «BORRADOR» girada. Además, en móvil el botón de descarga se salía de la tarjeta. No cambia ninguna lógica: permisos, firma, pago de la fianza y vuelta de Stripe siguen igual.

1. **Cabecera.** El título es el inmueble (título o dirección), con la insignia de estado al lado y la dirección y la ciudad debajo. Ya no muestra el ID ni una banda de color. Las acciones («Firmar contrato», «Pagar fianza», «Descargar…») ocupan el ancho completo en móvil y se alinean a la derecha en escritorio. La miga «Contratos / Contrato #…» ya la pone `AppShell`, así que no hay enlace de vuelta duplicado.
2. **«Siguiente paso»**: la acción, el detalle y el bloqueo, este sin el prefijo «Bloqueo actual:».
3. **«Estado del contrato»**: los cinco pasos sin cajas de color. Es una línea de progreso (verde si está hecho, negra si está en curso, gris si está pendiente), horizontal en escritorio y vertical en móvil, con `aria-current="step"`.
4. **«Condiciones» y «Partes»**: listas `dl` sin mayúsculas ni círculos de colores. La duración queda como «Inicio» y «Fin». La tarjeta de co-titulares (`CoTenantsCard`) sigue el mismo estilo de título.
5. **Vista previa**: en la tipografía de la app, con «Reunidos» y «Acuerdan» como subtítulos y las condiciones como lista numerada (son cláusulas reales, no numeración decorativa). Una frase aclara si es borrador y que el texto completo está en el PDF.
6. **Contrato que no carga**: tarjeta «No encontramos este contrato» con «Volver a contratos», en vez de un texto rojo suelto. El modal de firma se titula «Firma electrónica» (antes «Firma Segura - Signaturit»).

**Commits.**
- `c6ebec1` Contratos: el detalle pasa al sistema RentalApp 2026

**Verificación (resultados reales).**
- Backend: sin cambios.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 30 ficheros y 104 tests OK (antes 102). Hay dos casos nuevos en `ContractDetail.test.tsx`: la cabecera con la agencia (título y dirección del inmueble, sin el ID y sin botones de firmar o pagar) y el estado «No encontramos este contrato». Los tests existentes se han adaptado a los textos nuevos y al `Link` del router simulado.
- Playwright (vite local, `/api/*` simulado) con el inquilino (contrato firmado y fianza sin pagar) y la agencia (borrador), a 390 y 1280 px (`/tmp/ra-shots29`). No hay desbordamiento horizontal en ninguno de los cuatro casos (comprobado con `scrollWidth`). En móvil, los botones ocupan el ancho y quedan dentro de la tarjeta.
- GitNexus: `impact` LOW en `ContractDetail`. `detect_changes` sale medio, con los flujos esperados (`ContractDetail → WithAuth` y `→ FormatTimelineDate`; este último aparece solo porque sus líneas se desplazan).

**Qué queda.**
- La insignia de estado (`Badge`, compartida) sigue en mayúsculas en toda la app. Cambiarla afecta a muchas pantallas y conviene hacerlo en una ronda propia.
- `getContractActionSummary` mantiene textos poco claros («pendiente de activación operativa», «Faltan pasos previos antes de firma»).
- El paso «Contrato activo» muestra la fecha de inicio aunque esté pendiente, y «PDF preparado» muestra `updatedAt` en un borrador.
- Pendientes anteriores: la visita del propietario sale como «Has propuesto» para la agencia, la agencia no puede crear ni editar inmuebles, disputas de Stripe, `contractId` en el PaymentIntent de la fianza y «Cancelar invitación» de propietario.

**Siguiente mejora propuesta.** Volver a pagos y seguridad: `payment_intent_data.metadata.contractId` en el Checkout de la fianza, para que `charge.refunded` reconozca su devolución, y gestionar `charge.dispute.created` (marcar el pago como disputado y avisar). Si se sigue con la interfaz: textos de `getContractActionSummary` y la insignia `Badge` sin mayúsculas.

### Ronda 30 — 2026-10-11 20:13

**Qué y por qué.** Pagos y seguridad, como proponía la ronda 29. Quedaban dos huecos en el webhook de Stripe, anotados como pendientes en la auditoría:

1. **Las devoluciones de la fianza no se reconocían.** El Checkout de la fianza ponía `contractId` en la sesión, pero no en el PaymentIntent. El cargo que llega en `charge.refunded` no traía nada, y la fianza no tiene `Payment`, así que la devolución acababa en «devolución sin pago asociado».
   - `depositToEscrow` añade `payment_intent_data.metadata` (`contractId`, `deposit`, `type: 'deposit'`).
   - `checkout.session.completed` guarda `depositPaymentIntentId` en el contrato.
   - `charge.refunded`, si no es un pago ni un recibo de renta, busca el contrato de la fianza. Lo hace por `depositPaymentIntentId`, después por los metadatos del cargo y, para fianzas cobradas antes de este cambio, por la sesión de Checkout de ese intent (`checkout.sessions.list({ payment_intent })`). Anota `depositAmountRefunded`, `depositRefundedAt` (solo si es total) y el historial `depositRefunded` o `depositPartiallyRefunded`. `depositPaid` no cambia (decisión para Jorge).
2. **Las disputas (contracargos) no se gestionaban.**
   - `charge.dispute.created`, `.updated` y `.closed` guardan la disputa (id, estado, motivo, importe y fechas) en `Payment.dispute`, `RentPayment.dispute` o `Contract.depositDispute`. Es un subesquema nuevo y compartido, `src/models/paymentDispute.schema.ts`.
   - Si la disputa no trae `payment_intent`, se lee del cargo.
   - El historial del contrato recoge `paymentDisputed` al abrirse y `paymentDisputeClosed` (ganada o perdida) al cerrarse. Además, queda un `console.error` en el log.
   - Los estados de cobro no cambian, y un evento tardío o reenviado no reabre una disputa cerrada.

**Commits.**
- `f749a8d` Stripe: devoluciones de la fianza y disputas (contracargos) en el webhook

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - El nuevo `tests/contracts/payments.disputes.test.ts` tiene 5 casos: la fianza pagada guarda el intent y una devolución total queda en el contrato; una fianza antigua se reconoce por su sesión de Checkout (devolución parcial); la disputa de la fianza se abre y se cierra (`lost`) sin que un `updated` tardío la reabra, con una sola entrada de historial de cada tipo; la disputa de la renta, sin `payment_intent`, se guarda en el pago y en el recibo, que siguen `succeeded` y `PAID`; y un cobro desconocido no toca nada. Con el webhook anterior fallan 4 de los 5 (comprobado).
  - `payments.duplicates.test.ts` comprueba ya los metadatos del PaymentIntent de la fianza.
  - `tests/contracts`, `tests/chat`, `tests/escrow` y `tests/agency`: 29 suites y 136 tests OK. e2e (`jest.config.e2e.js`): 2 suites y 10 tests OK.
- Frontend (sin cambios): build OK y `npm test` con 30 ficheros y 104 tests OK.
- GitNexus: `impact` LOW en `depositToEscrow` (solo lo llama `payDeposit`). `detect_changes` sale medio. Los flujos que marca son los de `maybePayAgencyRentFeeShare`, que solo aparecen porque sus líneas se desplazan al añadir los helpers encima; la función no cambia.

**Qué queda.**
- No hay aviso al usuario de la disputa ni de la fianza devuelta. Tampoco se ven en la interfaz (detalle del contrato, pagos del casero).
- Al perder una disputa no se revierte la parte de la agencia (`PartnerEarning`), igual que en las devoluciones (ronda 26).
- Pendientes de interfaz de la ronda 29: textos de `getContractActionSummary` e insignia `Badge` en mayúsculas.
- Pendientes anteriores: la visita del propietario sale como «Has propuesto» para la agencia, la agencia no puede crear ni editar inmuebles, y falta «Cancelar invitación» de propietario.

**Siguiente mejora propuesta.** Interfaz: en el detalle del contrato, mostrar «Fianza devuelta» (con importe y fecha) y un aviso discreto si hay una disputa abierta sobre la fianza o la renta. De paso, los textos de `getContractActionSummary` y la insignia `Badge` sin mayúsculas.

### Ronda 31 — 2026-10-11 20:26

**Qué y por qué.** Interfaz, como proponía la ronda 30. Desde esa ronda el webhook guarda las devoluciones de la fianza y las disputas (contracargos), pero nadie las veía. Además, el «Siguiente paso» del contrato usaba jerga interna («pendiente de activación operativa», «Faltan pasos previos antes de firma», «Confirmar fianza o pago inicial») y daba la misma instrucción a todas las partes.

1. **Fianza devuelta.** En «Condiciones» aparece la fila «Fianza devuelta», con el importe y la fecha, o «Fianza devuelta (parcial)» solo con el importe. El paso «Pago de fianza» del estado dice «Fianza devuelta» con la fecha, o «Pagada; devueltos X €». De paso, «Fianza marcada como pagada» y «Pendiente de pago o conciliación» pasan a «Fianza pagada» y «Pendiente de pago».
2. **Aviso de disputa.** Si hay una disputa sin resolver sobre la fianza o sobre algún recibo de renta, sale un aviso discreto en ámbar bajo la cabecera, con el mismo estilo que el de «Pago de la fianza cancelado». Explica que el titular de la tarjeta ha reclamado el cargo a su banco y que, mientras Stripe lo revisa, el cobro sigue registrado. Lista cada cobro: «Fianza» o «Renta de diciembre de 2026», con el importe, el motivo traducido si se conoce y la fecha. Las disputas cerradas (`won`, `lost`, `warning_closed`) no salen.
   - Backend: `GET /api/contracts/:id` añade `rentDisputes`, los recibos de renta con disputa (`period`, `amount` y los datos de la disputa), con una consulta por `contractId`, que ya tiene índice. La disputa de la fianza ya venía en el contrato (`depositDispute`). Lo ven quienes ya podían ver el contrato.
3. **«Siguiente paso» por parte** (`getContractActionSummary`, compartido con «Contratos» y el panel del casero):
   - Borrador: el casero lee «Revisa los datos y envíalo a firmar», la agencia «Revisa los datos con el propietario, que es quien lo envía a firmar» y el inquilino «El propietario lo enviará a firmar cuando esté listo». El bloqueo redundante desaparece.
   - Pendiente de firma: el inquilino lee «Revisa y firma el contrato» y los demás «Esperar a que firmen las partes».
   - Firmado sin fianza: el inquilino lee «Paga la fianza» y el casero «Esperar a que el inquilino pague la fianza».
   - Firmado con fianza: «No tienes que hacer nada más. Se activa solo el 1/11/2026». Es lo que hace `contractActivation.job`, que activa los contratos firmados con la fianza pagada en su fecha de inicio.
   - Cerrado: «Este contrato ya no está en vigor».
   - El co-titular, en «Contratos», lee «El inquilino principal paga la fianza».

**Commits.**
- `7ed4d84` Contratos: el detalle muestra la fianza devuelta y avisa de las disputas abiertas
- `7a653ea` Contratos: el «Siguiente paso» dice a cada parte qué le toca

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` con `payments.disputes.test.ts`, `contract.integration.test.ts` y `contract.cotenant.test.ts`: 3 suites y 21 tests OK. El caso de la disputa de la renta comprueba ya que `GET /api/contracts/:id` devuelve `rentDisputes`.
- Frontend: `npm --prefix frontend run build` OK (incluye `tsc --noEmit`). `npm --prefix frontend test`: 30 ficheros y 107 tests OK (antes 104). Hay tres casos nuevos:
  - fianza devuelta y aviso con la disputa de la renta abierta, sin la de la fianza cerrada;
  - sin disputas abiertas no hay aviso;
  - textos del resumen por parte.
  Se han adaptado tres tests a los textos nuevos.
- Playwright (vite local, `/api/*` simulado) con el casero (contrato activo, devolución parcial, una disputa de la renta) y el inquilino (fianza devuelta, disputa de la fianza y de la renta), a 390 y 1280 px (`/tmp/ra-shots31`). No hay desbordamiento horizontal en ninguno de los cuatro casos. El aviso se lee bien en móvil.
- GitNexus: `impact` HIGH en `getContractActionSummary` (3 llamadores directos: `MyContracts`, `LandlordDashboard` y `ContractDetail`). Solo cambian textos; la firma, los campos y los tonos (`LandlordDashboard` filtra por `tone`) siguen igual. `impact` LOW en `buildContractTimeline` y `getContract`. `detect_changes` sale alto, pero solo marca los flujos esperados de esas tres pantallas.

**Qué queda.**
- El aviso no distingue quién ve qué: el inquilino lee «el titular de la tarjeta ha pedido…» aunque sea él. Es neutro a propósito, porque no sabemos si el titular es el inquilino.
- Sigue sin haber aviso fuera de la app (correo o panel de administración) para las disputas; es la decisión (1) de la ronda 30.
- La insignia `Badge` sigue en mayúsculas («FIRMADO», «ACTIVO») en toda la app.
- El paso «Contrato activo» muestra la fecha de inicio aunque esté pendiente, y «PDF preparado» muestra `updatedAt`.
- Pendientes anteriores: la visita del propietario sale como «Has propuesto» para la agencia, la agencia no puede crear ni editar inmuebles y falta «Cancelar invitación» de propietario.

**Siguiente mejora propuesta.** Interfaz compartida: la insignia de estado (`Badge` y `ContractStatusBadge`) sin mayúsculas ni letra espaciada, en minúscula como en Stripe o Airbnb, revisando las pantallas que la usan con capturas. Si se prefiere seguridad: PII en los logs (correos y cuerpo de los webhooks), pendiente en la auditoría.

### Ronda 32 — 2026-10-11 20:42

**Qué y por qué.** Seguridad, después de tres rondas de interfaz. Lo último pendiente de «Observabilidad» en la auditoría eran los datos personales en los logs. Cada correo enviado dejaba la dirección completa (`email_sent`, `email_mock`, `email_error`), cada SMS el teléfono, y el webhook de firma, si llegaba sin ID, volcaba el cuerpo entero. Además, los errores 500 guardaban `req.url` con la query (tokens, códigos OAuth), y los errores de SMTP, Twilio o Mongo (E11000 `dup key: { email: … }`) traen el correo en el mensaje.

1. **Enmascarado central en el logger** (`src/utils/logger.ts`, nuevo `src/utils/redact.ts`). Así no hay que tocar `deliverEmail`, que GitNexus marca CRITICAL porque pasa por él todo el correo.
   - Pino `redact`, en las claves `to`, `email`, `phone`, `phoneNumber` e `iban` (en el primer nivel y uno por debajo): `ana@example.org` → `a***@example.org` (se conserva el dominio para depurar la entrega), `+34600123456` → `***456` y el IBAN → `ES91****1332`. `password`, `passwordHash`, `token`, `authorization` y `cookie` salen como `[oculto]`.
   - Serializador `err`: la misma limpieza sobre el mensaje, el stack y los campos del error (`response` de nodemailer, por ejemplo). El stack sigue saliendo.
   - El mensaje del log también se limpia (`hooks.logMethod`).
   - Los teléfonos solo se reconocen con prefijo internacional (`+`), para no tocar importes, fechas ni IDs.
2. **`errorHandler`** guarda la ruta sin la query (`pathWithoutQuery`, la misma que el log de peticiones).
3. **Webhook de firma sin ID**: registra solo las claves del cuerpo, no los valores.
4. **`user.controller`**: los dos `console.error` al actualizar el usuario o el perfil (un E11000 lleva el correo) pasan al logger.

**Commits.**
- `9e132fd` Logs: el logger enmascara correos, teléfonos e IBAN y oculta secretos; el manejador de errores guarda la ruta sin la query y el webhook de firma ya no vuelca el cuerpo

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - El nuevo `tests/unit/logRedaction.test.ts` tiene 3 casos: enmascarado en texto libre, sin tocar importes, fechas ni IDs de Stripe o Mongo; los logs de correo, de SMS y de un objeto anidado no dejan ni la dirección ni el teléfono completos; y contraseña, cabecera `Authorization`, mensaje y error E11000 con `response` de SMTP sin el correo, con el stack conservado.
  - `tests/unit`, `tests/auth`, `tests/contracts` y `src/__tests__`: 46 suites y 215 tests OK. e2e (`jest.config.e2e.js`): 2 suites y 10 tests OK.
- Frontend (sin cambios): build OK y `npm test` con 30 ficheros y 107 tests OK.
- GitNexus: `impact` LOW en `errorHandler`; CRITICAL en `deliverEmail`, que por eso no se ha tocado. `detect_changes` sale medio: `signatureWebhook` (solo el log), `errorHandler` y `logger`. Los símbolos de `user.controller` aparecen solo porque sus líneas se desplazan.

**Qué queda.**
- Los `console.*` sueltos (unos 100) no pasan por pino ni se enmascaran. Hoy ninguno escribe correos ni cuerpos, pero algunos vuelcan errores enteros (`console.error('…', err)`). Lo ideal sería pasarlos al logger por módulos.
- El enmascarado de pino `redact` solo mira las claves listadas hasta un nivel de profundidad. Una clave nueva con otro nombre (`recipient`, `mail`) quedaría sin enmascarar, salvo en el mensaje y en los errores, que sí se limpian siempre.
- Pendientes de interfaz: insignia `Badge` en mayúsculas, el paso «Contrato activo» con la fecha aunque esté pendiente, y la visita del propietario como «Has propuesto» para la agencia.

**Siguiente mejora propuesta.** Interfaz compartida: la insignia de estado (`Badge` y `ContractStatusBadge`) sin mayúsculas ni letra espaciada, revisando con capturas las pantallas que la usan. Si se prefiere seguridad: `sanitizeFilter` global de Mongo (`?status[$ne]=x`) o los adjuntos de chat y avatares públicos sin caducidad.

### Ronda 33 — 2026-10-11 21:20

**Qué y por qué.** Un punto de seguridad pendiente en la auditoría y la insignia de estado que proponían las rondas 31 y 32.

1. **Operadores de Mongo en query y cuerpo** (auditoría, «Mongo: no hay `sanitizeFilter` global»). Express 4 convierte `?status[$ne]=x` en `{ status: { $ne: 'x' } }` y un cuerpo JSON puede traer `{"email":{"$gt":""}}`. Hasta ahora cada controlador se defendía a mano (`String(...)`), y uno nuevo que se olvidara quedaba expuesto. No he encontrado ningún controlador explotable hoy, así que es una defensa en profundidad.
   - Nuevo `src/middleware/rejectMongoOperators.ts`, montado en `app.ts` tras los parsers y `hpp`: si la query o el cuerpo traen una clave que empieza por `$` (a cualquier profundidad, también en listas), responde 400 `invalid_input`. Los valores con `$` (`?q=$100`) pasan.
   - No uso `mongoose.set('sanitizeFilter', true)`, porque envolvería también los `$in`, `$or` y `$gt` que construye el propio código.
   - Los webhooks de Stripe y de firma se montan antes y no pasan por él. El de Stripe Identity (`/api/kyc`) sí, pero los eventos de Stripe no traen claves con `$`. El frontend no envía ninguna (comprobado con grep).
2. **Insignia de estado** (`Badge`, `StatusBadge`, `ContractStatusBadge` y la clase `.badge`). Pasa de etiqueta en mayúsculas con letra espaciada a píldora en minúscula de 12 px, como en Stripe o Airbnb. Al quitar las mayúsculas salía a la vista que las incidencias y los pagos mostraban el valor interno en inglés («in progress», «awaiting schedule»). `getStatusLabel` los traduce ya («En curso», «Por agendar», «Por validar», «En disputa», «Pagado»…) y pone la mayúscula inicial a cualquier estado desconocido. «Pendiente firma» pasa a «Pendiente de firma», igual que en el resto de la app. `disputed` tiene tono rojo y `awaiting_validation` ámbar.

**Commits.**
- `be4e5b8` Interfaz: la insignia de estado pasa a píldora en minúscula y traduce los estados de incidencias y pagos que salían en inglés
- `fdc8888` Seguridad: rechazar con 400 las peticiones con operadores de Mongo en la query o el cuerpo

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - El nuevo `tests/security/mongoOperators.test.ts` tiene 5 casos OK: la detección a cualquier profundidad; los valores con `$`, los textos y los `Buffer` pasan; el login con `{"email":{"$gt":""}}` da 400 `invalid_input`; `GET /api/properties?status[$ne]=archived` da 400; y una búsqueda con `?q=%24100` y un login normal siguen funcionando. Sin el middleware, el caso de la query devuelve 200.
  - Suite completa (`tests` y `src/__tests__`): 77 suites y 343 tests, con 342 OK y un único fallo esperado. Era `contract.cotenant.test.ts`, que comprobaba que `?status[$ne]=x` se ignoraba (200). Ahora espera 400 `invalid_input` y pasa (14/14 al repetirlo).
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 31 ficheros y 111 tests OK (antes 30 y 107). El nuevo `statusBadges.test.ts` tiene 4 casos.
- Playwright (vite local, `/api/*` simulado) a 390 y 1280 px (`/tmp/ra-shots33`): «Contratos» del casero (Borrador, Pendiente de firma, Activo, Rescindido) e «Incidencias» del inquilino (Abierta, En curso, Por agendar, Por validar, Cerrada, En disputa). No hay desbordamiento horizontal de la página en ninguno de los cuatro casos.
- GitNexus: `impact` CRITICAL en `getStatusLabel` (2 llamadores directos, `StatusBadge` y `ContractStatusBadge`, y 5 pantallas). Solo cambia el texto que devuelve, no la firma; está cubierto por el test nuevo y por las capturas. `impact` LOW en `Badge`. `detect_changes` sale medio, con los flujos esperados (`TenantDashboard`, `TenantApplications` y `StatusBadge`).

**Qué queda.**
- «Incidencias» (`TicketsList`) tiene fallos que ya estaban: las fechas salen en formato inglés («10/1/2026, 2:00:00 AM»), «Titulo» sin tilde y etiquetas de tabla y filtro en mayúsculas, y en móvil la tabla no cabe y hay que desplazarla de lado. Además, el subtítulo habla de «tickets».
- Algunos tests del backend llaman a la API real de Stripe sin clave (`StripeAuthenticationError` en el log de `rentPayment`). No fallan, pero deberían simularla.
- Pendientes anteriores: el paso «Contrato activo» muestra la fecha aunque esté pendiente, la visita del propietario sale como «Has propuesto» para la agencia, adjuntos de chat y avatares públicos sin caducidad, y los `console.*` sueltos fuera del logger.

**Siguiente mejora propuesta.** Interfaz: «Incidencias» (`TicketsList` y `TicketDetail`) al sistema RentalApp 2026, con fechas en `es-ES`, tildes, lista en tarjetas en móvil en vez de tabla y sin mayúsculas en las cabeceras. Si se prefiere seguridad: los adjuntos de chat y los avatares, que son públicos y no caducan.

### Ronda 34 — 2026-10-11 21:20

**Qué y por qué.** Seguridad, el punto «Ficheros» de la auditoría, que seguía abierto. `/api/uploads/images` sirve las fotos de los inmuebles, los avatares y los adjuntos del chat, todo como estático público en `/uploads`.

1. **Nombre imposible de adivinar.** Antes era `Date.now()_Math.random()` (pocos bits y predecible). Ahora son 16 bytes de `crypto.randomBytes` en hexadecimal.
2. **Fuera los metadatos de las fotos.** Nuevo `src/utils/stripImageMetadata.ts`, sin dependencias ni recodificación (no hay `sharp` en el proyecto).
   - JPEG: quita APP1 (EXIF con GPS, cámara y fecha, y XMP), APP13 (IPTC) y comentarios, y conserva JFIF, el perfil ICC y la imagen. Si la foto tenía orientación distinta de 1, deja un EXIF mínimo con solo ese dato, para que las fotos del móvil no salgan giradas.
   - PNG: quita `eXIf`, `tEXt`, `iTXt`, `zTXt` y `tIME`.
   - WebP: quita `EXIF` y `XMP `, apaga sus marcas en `VP8X` y corrige el tamaño RIFF.
   - Si el fichero no se puede interpretar, se guarda tal cual. Los PDF no se tocan.
   De paso, si un fichero del lote se rechaza (415), se borran también los demás. Antes quedaban en `/uploads` sin extensión.
3. **Adjuntos del chat solo de `/uploads` propios** (nuevo `src/utils/uploadUrl.ts`). Sin `UPLOADS_BASE_URL` valía cualquier `http(s)://`: un píxel de rastreo o una imagen de phishing en el chat del otro. Con la variable, el `startsWith` dejaba pasar `https://cdn…/uploads.evil.com/…` y `…/uploads/../contracts/…`. Ahora se acepta solo `<base>/<nombre>`, con un nombre sin barras ni `..`, y la base puede ser `/uploads`, `APP_URL/uploads`, `FRONTEND_URL/uploads` o las de `UPLOADS_BASE_URL`.

**Commits.**
- `d312822` Subidas: nombre aleatorio con crypto, las fotos pierden EXIF/GPS, XMP, IPTC y comentarios
- `fd6351f` Chat: los adjuntos solo pueden ser ficheros de /uploads propios

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - Los nuevos `tests/unit/stripImageMetadata.test.ts` (5) y `tests/unit/uploadUrl.test.ts` (2), el caso nuevo de `upload.routes.test.ts` (nombre de 32 hex y sin EXIF en disco) y 7 casos nuevos en `tests/chat/attachments.test.ts`: `tests/uploads`, `tests/chat` y los dos unitarios, 6 suites y 25 tests OK.
  - `tests/unit`, `tests/security` y `tests/e2e`: 14 suites y 58 tests OK. e2e (`jest.config.e2e.js`): 10 OK.
- Con imágenes reales generadas con Pillow (JPEG, PNG y WebP de 40×20 con orientación 6, fabricante, software y GPS), las tres salen sin rastro de esos datos, se decodifican igual (mismos píxeles) y el JPEG conserva solo `Orientation=6` (`/tmp/ra34`).
- Frontend (sin cambios): build OK y `npm test` con 31 ficheros y 111 tests OK.
- GitNexus: `impact` LOW en `detectFileType`. `detect_changes` sale bajo, sin flujos afectados (`storage` de `upload.routes` y el router del chat).

**Qué queda.**
- Los adjuntos del chat siguen siendo públicos para quien tenga el enlace y no caducan. Hacerlos privados exige URL firmadas o servirlos por la API con autenticación. Queda anotado en «Para Jorge».
- Los ficheros ya subidos conservan su EXIF. Limpiarlos es tocar datos de usuarios (D2), así que no se ha hecho.
- PNG y WebP pierden también la orientación EXIF (es raro que la tengan). HEIC no se admite.
- Pendientes de interfaz: «Incidencias» (`TicketsList` y `TicketDetail`), con fechas en inglés, sin tildes, mayúsculas en las cabeceras y una tabla que no cabe en móvil.

**Siguiente mejora propuesta.** Interfaz: «Incidencias» (`TicketsList` y `TicketDetail`) al sistema RentalApp 2026, con fechas en `es-ES`, tildes, tarjetas en móvil y cabeceras sin mayúsculas. Lleva dos rondas propuesta y la ronda 33 ya era en parte de seguridad.

### Ronda 35 — 2026-10-11 21:47

**Qué y por qué.** «Incidencias», propuesta desde la ronda 33 como mejora de interfaz. Al revisarla, el flujo estaba roto después del pago, así que lo primero ha sido arreglarlo:

1. **Flujo roto en la ficha** (`TicketDetail`). Los botones miraban estados que el backend nunca pone (`done`, `in_progress`, `awaiting_approval`) y una cita que `GET /tickets/:id` no devolvía. Pagado el presupuesto:
   - el profesional no podía marcar el trabajo terminado;
   - el inquilino no veía la cita para aceptarla;
   - el propietario no tenía cómo validar y liberar el pago;
   - «Cerrar incidencia» llamaba a `/close`, que no existe.

   Ahora cada parte ve el paso que le toca según el estado real:
   - el propietario: elegir profesional, «Aprobar y pagar», decidir el extra, «Validar trabajo y liberar el pago»;
   - el profesional: presupuesto, proponer cita, extra, «Marcar trabajo terminado»;
   - el inquilino: aceptar la cita o pedir otra fecha, «Confirmar que está arreglado».

   Además, un «Siguiente paso» por parte y los errores del backend traducidos (`getTicketErrorText`). Se quitan `closeTicket` y `openDispute` (endpoints inexistentes) y entran `validateTicket` y `resolveTicket`.
2. **Agujeros del backend en el mismo flujo**:
   - `POST /tickets/:id/resolve` (inquilino) liberaba el pago al profesional nada más aprobarse el presupuesto, sin trabajo hecho. Ahora exige `awaiting_validation`, como `/validate`.
   - `/complete` se podía llamar sin presupuesto pagado o con el ticket ya cerrado; ahora exige el hold y un estado de trabajo (`awaiting_schedule`, `scheduled` o `in_progress`).
   - Proponer cita exige el presupuesto pagado. Aceptar o rechazar exige una propuesta pendiente (409 `appointment_not_proposed`), y aceptar ya no hace retroceder a `scheduled` un ticket terminado.
   - `GET /tickets/:id` trae `appointment` (inicio, fin y estado de la última propuesta) y `pro.displayName`.
3. **Interfaz al sistema 2026** (`TicketsList` y `TicketDetail`, nuevo `utils/tickets.ts`):
   - la lista pasa de tabla a filas con tarjeta, como «Contratos», y cabe en móvil;
   - las fechas salen en `es-ES` y hora de Madrid, y los servicios en español («Fontanería» en vez de `plumbing`);
   - el filtro de estado son chips con los estados que existen; antes ofrecía `done` y `awaiting_approval` y no `awaiting_validation`;
   - la búsqueda es por título o servicio, la paginación muestra «Página X de Y» y el subtítulo y el estado vacío cambian según el rol;
   - en la ficha: insignia de estado compartida (antes había una propia en mayúsculas y en inglés), datos en lista (servicio, fecha, profesional, presupuesto, cita), historial en español y «Qué puedes hacer» arriba en móvil;
   - fuera la «Ubicación desconocida» fija, el botón de volver duplicado con la miga de pan y la cabecera duplicada del chat.

**Commits.**
- `30d5c8a` Incidencias: el inquilino ya no libera el pago antes de que el profesional termine, no hay cita ni trabajo terminado sin presupuesto pagado y GET /tickets/:id trae la cita y el nombre del profesional
- `5c92801` Incidencias: la ficha ofrece a cada parte el paso que le toca y lista y ficha pasan al sistema 2026

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`, suite a suite:
  - `tests/escrow/ticket.access.test.ts` 4/4. El caso nuevo recorre el flujo entero: sin pagar, cita y «terminado» dan 409; pagado, `/resolve` da 409; la cita se ve en `GET /:id`; aceptar dos veces da 409; terminar dos veces da 409; y confirmar cierra el ticket.
  - `escrow.policy` 1/1. Liberaba el pago justo después de aprobar y falló con 409 por la regla nueva; ahora el profesional termina antes.
  - `appointments` 3/3, con el ticket de prueba ya pagado; `escrow.release.recovery` 6/6; `src/__tests__/rbac` 8/8; e2e (`jest.config.e2e.js`) 10/10.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 31 ficheros y 114 tests OK (antes 111). `TicketDetail.test.tsx` tiene 7 casos, 3 nuevos: el profesional marca terminado, el inquilino acepta la cita y el propietario valida, sin botón de cerrar.
- Playwright (vite local, `/api/*` simulado) a 390 y 1280 px (`/tmp/ra-shots35`): lista del inquilino, ficha del inquilino con cita propuesta y ficha del propietario por validar. No hay desbordamiento horizontal en ninguna.
- GitNexus: `impact` LOW en `TicketsList` y `TicketDetail` (solo la ruta). `detect_changes` sale medio, con los flujos esperados (`TicketDetail → GetTicket`, `HandleAction → GetTicket`).

**Qué queda.**
- `TicketCreatePage` («Comunicar una avería») sigue con inputs sin estilo del sistema 2026 y solo cuatro servicios.
- En móvil, el historial de la ficha sale antes de la descripción (va en la misma columna que las acciones).
- La búsqueda de la lista filtra solo la página cargada (20), porque el backend no admite `q`.
- Decisiones en «Para Jorge»: el extra que supera el hold y el inquilino liberando el pago.
- Pendientes anteriores: el paso «Contrato activo» con la fecha aunque esté pendiente, la visita del propietario como «Has propuesto» para la agencia, adjuntos de chat públicos y los `console.*` fuera del logger.

**Siguiente mejora propuesta.** «Comunicar una avería» (`TicketCreatePage`) al sistema 2026: contrato preseleccionado si solo hay uno, servicios del catálogo, fotos con el subidor seguro y aviso al propietario por correo al crearla, que la auditoría de mejoras deja pendiente.


### Ronda 36 — 2026-10-11 22:02

**Qué y por qué.** «Comunicar una avería» (`TicketCreatePage`), la mejora propuesta en la ronda 35. Al revisarla salieron también fallos del backend en la misma ruta:

1. **`POST /api/tickets` sin validar** (fallo). Un ticket sin descripción daba 500 y devolvía el mensaje de validación de Mongoose. El servicio era texto libre (`'x'` valía) y se podía abrir una avería sobre un contrato terminado o en borrador. Ahora:
   - el servicio tiene que ser uno de los que ofrecen los profesionales (`pro.model`: fontanería, electricidad, electrodomésticos, cerrajería, limpieza, pintura y otros). Si no, 400 `invalid_service`;
   - el título (hasta 120 caracteres) y la descripción (hasta 2.000) se recortan y son obligatorios: 400 `invalid_title` / `invalid_description`;
   - el contrato tiene que estar `active`: 409 `contract_not_active`.
2. **Aviso al propietario** (pendiente en `auditoria-mejoras-2026-10-05.md`). Al crearse la incidencia, el propietario recibe un correo («Nueva avería: …») con la vivienda, el tipo, la descripción y el enlace a la ficha. Es la nueva `sendTicketOpenedEmail` en `utils/email.ts`, con todo escapado. Sale después de responder y un fallo solo queda en el log, así que no retrasa la petición.
3. **La página, al sistema 2026.** Antes eran inputs sin estilo, solo cuatro servicios, un `<pre>` con el JSON del ticket como respuesta y el mensaje de error en inglés del backend. Ahora:
   - si hay un solo contrato activo, la vivienda ya viene elegida (título y dirección). Con varios hay un selector, y sin ninguno sale una explicación con enlace a «Contratos»;
   - el tipo de avería se elige con chips, como el filtro de la lista;
   - hay título, «Qué pasa» con ayuda («cuándo puede entrar el profesional») y contador, y los errores salen en español junto al formulario;
   - al crearla salta a la ficha con el aviso «Hemos avisado a tu arrendador».
   - La ruta `/tickets/new` queda solo para inquilinos (el backend ya no dejaba crearla a nadie más) y la miga de pan dice «Comunicar una avería».

**Commits.**
- `2f1ff22` Incidencias: crear una avería valida servicio, título y descripción, exige el contrato activo y avisa al propietario por correo
- `0d80f9e` Incidencias: «Comunicar una avería» pasa al sistema 2026 y solo la abre el inquilino

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - `tests/escrow`: 3 suites y 13 tests OK. `ticket.access` pasa de 4 a 6 casos. Uno recorre los 400 (servicio, título vacío o largo, descripción vacía), comprueba que el título se recorta, que el correo va al propietario con la vivienda y «Fontanería», y el 409 con el contrato terminado. El otro comprueba que la plantilla escapa el HTML.
  - Los tests que usaban el servicio `maintenance` pasan a `plumbing`.
  - `src/__tests__/rbac` 8/8 y e2e (`jest.config.e2e.js`) 10/10.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 32 ficheros y 117 tests OK (antes 31 y 114). El nuevo `TicketCreatePage.test.tsx` tiene 3 casos: un contrato preseleccionado con envío y salto a la ficha, validación y error traducido con dos contratos, y el estado sin contrato.
- Playwright (vite local, `/api/*` simulado) a 390 y 1280 px (`/tmp/ra-shots36`): con un contrato (rellenado y con el error 409), con dos y sin ninguno. No hay desbordamiento horizontal en ninguno.
- GitNexus: `impact` LOW en `TicketCreatePage` (solo la ruta). `detect_changes` sale medio, con los flujos esperados (`TicketCreatePage → WithAuth` y `AppRoutes`).

**Qué queda.**
- Fotos de la avería: el modelo `Ticket` no tiene campo de imágenes. Añadirlas con el subidor seguro de la ronda 34 es la siguiente pieza natural.
- Las incidencias antiguas con servicios fuera del catálogo (`maintenance`) se siguen mostrando («Mantenimiento»), pero ya no se pueden crear nuevas.
- El correo no tiene versión de texto plano ni se avisa al propietario de los pasos siguientes (presupuesto, trabajo terminado).
- Pendientes anteriores: en móvil, el historial de la ficha sale antes de la descripción; la búsqueda de la lista filtra solo la página cargada; adjuntos de chat públicos; el paso «Contrato activo» con la fecha aunque esté pendiente.

**Siguiente mejora propuesta.** Fotos en las averías: campo `photos` en `Ticket` (solo URLs propias de `/uploads`, validadas con `isOwnUploadUrl`), subida desde «Comunicar una avería» con `Dropzone` y galería en la ficha. Si se prefiere seguridad: los adjuntos de chat privados (URL firmada).

### Ronda 37 — 2026-10-12 00:30

**Qué y por qué.** Fotos en las averías, la mejora propuesta en la ronda 36. Una foto ahorra al profesional la visita previa para presupuestar, y el modelo `Ticket` no tenía dónde guardarlas.

1. **Backend** (`ticket.model.ts`, `ticket.routes.ts`, `utils/email.ts`):
   - campo `photos` (lista de URLs) en `Ticket`, que no se guarda si la avería no trae fotos;
   - `POST /api/tickets` admite hasta 6 (el límite de una subida) y solo ficheros de nuestro `/uploads`, validados con `isOwnUploadUrl`, el mismo filtro que los adjuntos del chat (ronda 34). Si `photos` no es una lista, si hay más de 6, URLs de otros dominios o rutas raras (`/uploads/../.env`), devuelve 400 `invalid_photos`. Los duplicados se quitan;
   - `GET /api/tickets/:id` las devuelve (ya devolvía el documento entero), y el correo al propietario dice «Ha adjuntado N fotos».
2. **Interfaz** (`TicketCreatePage`, `TicketDetail`):
   - en «Comunicar una avería», «Fotos (opcional)» con miniaturas cuadradas, botón de quitar en cada una y una casilla «Añadir fotos». Antes de subir se comprueban formato (JPG, PNG o WebP; HEIC lo rechazaría el servidor), tamaño (10 MB) y número; los errores salen en español. Mientras se suben, no se puede enviar;
   - las fotos se suben con `POST /api/uploads/images`, que ya les quita EXIF/GPS (ronda 34);
   - en la ficha, galería bajo la descripción; cada foto abre el original en otra pestaña.
   - No he reutilizado `Dropzone`: su resaltado es un índigo fijo fuera de los tokens y admite cualquier `image/*`.

**Commits.**
- `4e7e695` Incidencias: una avería admite hasta 6 fotos, solo ficheros subidos a nuestro /uploads, las devuelve la ficha y el correo al propietario dice cuántas hay
- `07336a5` Incidencias: «Comunicar una avería» deja adjuntar hasta 6 fotos y la ficha las muestra en galería

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/escrow`: 3 suites y 14 tests OK (`ticket.access` pasa de 6 a 7 casos). El caso nuevo comprueba los cinco 400 `invalid_photos`, que se guardan sin duplicados, que la ficha del propietario las devuelve, `photoCount: 2` en el correo y que una avería sin fotos no lleva el campo. El test de la plantilla comprueba el texto «Ha adjuntado 3 fotos» y que sin fotos no sale.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 32 ficheros y 119 tests OK (antes 117). Casos nuevos: subir dos fotos, quitar una y que la avería se envíe con la que queda, y el HEIC rechazado sin llegar a subir; en la ficha, la galería con sus enlaces y ninguna galería sin fotos.
- Playwright (vite local, `/api/*` y `/uploads/*` simulados) a 390 y 1280 px (`/tmp/ra-shots37`): formulario con tres fotos y ficha con galería. No hay desbordamiento horizontal.
- GitNexus: `impact` LOW en `TicketCreatePage` (lo importa solo `AppRoutes`); `isOwnUploadUrl` se reutiliza sin cambios. `detect_changes` LOW, sin flujos afectados. Ojo: el índice es del repo canónico y no conoce esta rama.

**Qué queda.**
- Las fotos son públicas para quien tenga el enlace (nombre de 128 bits imposible de adivinar), como los adjuntos del chat. La decisión de las URL firmadas ya está en «Para Jorge» (ronda 34) y vale también para estas.
- Si el inquilino sube fotos y no envía la avería, quedan ficheros huérfanos en `/uploads`. Pasa igual con el chat y los anuncios; haría falta una limpieza periódica.
- No se pueden añadir fotos a una avería ya creada.
- Pendientes anteriores: en móvil, el historial de la ficha sale antes de la descripción; la búsqueda de la lista filtra solo la página cargada (el backend no admite `q`); el paso «Contrato activo» con la fecha aunque esté pendiente; los `console.*` fuera del logger.

**Siguiente mejora propuesta.** Búsqueda de incidencias en el servidor: `q` (título o servicio, con la expresión escapada) en `GET /api/tickets/my/*` y la lista usándolo, porque hoy solo filtra las 20 cargadas. De paso, en la ficha móvil, la descripción antes que el historial.

### Ronda 38 — 2026-10-12 00:42

**Qué y por qué.** Recibos PDF de la renta. Era un hueco de producto apuntado en la auditoría («Recibos PDF de renta: no existen, aunque el art. 17.4 de la LAU los exige»): el inquilino pagaba y no tenía más justificante que el recibo genérico de Stripe. Lo he preferido a la búsqueda de incidencias propuesta en la ronda 37 porque es una obligación legal en el flujo de pago, que es el más crítico, y llevaba cuatro rondas seguidas en incidencias.

1. **Backend** (`services/rentReceiptPdf.ts`, `controllers/payment.controller.ts`, `routes/payments.routes.ts`):
   - `GET /api/payments/:id/receipt.pdf` devuelve el recibo de una renta o fianza **cobrada** (`Payment` con `status: 'succeeded'`). Cada renta pagada ya genera su `Payment` (`type: 'rent'`, mes y año), así que vale para todo lo cobrado, también lo anterior a esta ronda;
   - lo descargan quien pagó, quien cobró, el co-titular activo y quien puede leer el contrato (casero, inquilino, agencia gestora con `manage`, admin). A cualquier otro se le responde 404, como si no existiera;
   - 409 `receipt_not_paid` si no está cobrado, 409 `receipt_refunded` si se devolvió entero; los pagos de servicios no tienen recibo (404);
   - el contenido sale de `describeReceipt` (función pura, con test): número `R-AAAAMM-XXXXXX`, arrendador, arrendatario, vivienda, periodo, fecha de pago, forma de pago, referencia de Stripe, el concepto por separado («Renta de octubre de 2026»), el total y, si hubo devolución parcial, «Devuelto el …: X €». Diseño sobrio con Helvetica, sin logos ni adornos;
   - `Cache-Control: private, no-store`.
2. **Interfaz** (`pages/tenant/Payments.tsx`): «Pagos y recibos» pasa al sistema 2026, como la lista de incidencias. Lista en una tarjeta, cada pago titulado por su mes, importe en euros con formato español, «Vence el» o «Pagado el», estado con la etiqueta en español y «Descargar recibo» en lo cobrado. Lo pendiente sale primero. Se quita el «ID: 66f…» que se veía. De paso, un fallo: «Pagar ahora» salía en cualquier recibo pendiente de la lista, también en los que paga otra persona (la lista trae los pagos como pagador o como cobrador); ahora solo sale si pagas tú. El backend ya respondía 403.

**Commits.**
- `f92bf73` Pagos: recibo PDF de cada renta o fianza cobrada (art. 17.4 LAU) en GET /api/payments/:id/receipt.pdf
- `913fdc3` Pagos: «Pagos y recibos» descarga el PDF de cada renta o fianza cobrada, pone lo pendiente primero y solo ofrece «Pagar ahora» a quien paga

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand`: nuevo `tests/contracts/payments.receipt.test.ts` 4/4 (inquilino y casero descargan un PDF que empieza por `%PDF-` con el nombre de fichero y `no-store`; la agencia gestora sí y un extraño, inquilino o casero, 404; los 409 y 404 de pendiente, devuelto, servicio e id raro; el contenido con periodo, partes, vivienda y devolución parcial, y el de una fianza). `payments.duplicates` y `payments.refunds`: 2 suites y 12 tests OK.
- PDF de muestra renderizado a PNG y revisado (`/tmp/ra-shots38/recibo.png`).
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 33 ficheros y 123 tests OK (antes 32 y 119). El nuevo `Payments.test.tsx` tiene 4 casos: orden y botones (pendiente primero, sin «Pagar ahora» en el recibo de otro, sin recibo para la fianza devuelta), descarga del PDF, errores de descarga y de carga, y títulos por mes.
- Playwright (vite local, `/api/*` simulado) a 390 y 1280 px (`/tmp/ra-shots38/pagos-*.png`): sin desbordamiento horizontal.
- GitNexus `detect_changes`: riesgo bajo, sin flujos afectados (solo desplazamiento de líneas en `getMyPayments` y `payReceipt`, que no cambian).

**Qué queda.**
- El casero no tiene dónde descargar los recibos: su «Pagos» es la conexión con Stripe y «Ganancias» solo exporta CSV. El endpoint ya le deja; falta la lista en su lado (o un botón por mes en el detalle del contrato).
- La fianza solo tiene recibo si existe su `Payment`; el pago de la fianza por Checkout no siempre lo crea (hueco «Devolución de la fianza» de la auditoría).
- Texto legal del recibo y NIF de las partes: en «Para Jorge».
- Pendientes anteriores: búsqueda de incidencias en el servidor (`q`), en móvil el historial de la ficha antes que la descripción, adjuntos de chat públicos, `console.*` fuera del logger.

**Siguiente mejora propuesta.** Recibos para el casero: en el detalle del contrato, la lista de meses cobrados con «Descargar recibo» (reutilizando `GET /api/contracts/:id/payments`, que ya devuelve los `Payment` cobrados del contrato). Después, la búsqueda de incidencias en el servidor.

### Ronda 39 — 2026-10-12 00:58

**Qué y por qué.** Recibos para el casero, la mejora propuesta en la ronda 38. El endpoint del recibo ya dejaba descargarlo al casero y a la agencia gestora, pero no tenían ninguna pantalla donde hacerlo: su «Pagos» es la conexión con Stripe y «Ganancias» solo exporta CSV.

1. **Backend** (`controllers/contract.earnings.controller.ts`). `GET /api/contracts/:id/payments` existía, pero ninguna pantalla lo usaba y devolvía el documento `Payment` entero. Ahora:
   - solo devuelve rentas y fianza cobradas (`succeeded`, `type` rent/deposit), sin los pagos de servicios;
   - solo con los campos necesarios para la lista: tipo, importe, devolución, estado, concepto, mes, año y fechas. Sin `stripeChargeId`, `stripePaymentIntentId`, pagador ni disputa;
   - ordenadas por fecha de pago, de la más reciente a la más antigua;
   - las ve también el co-titular activo, igual que el recibo; el invitado que no ha aceptado sigue con 403;
   - un id raro o un contrato inexistente dan 404 `contract_not_found` (el id raro antes daba 400, con el mensaje en texto libre). Los errores pasan a códigos (`forbidden`, `payments_failed`).
2. **Interfaz**. En el detalle de un contrato firmado, activo o terminado hay una tarjeta nueva, «Cobros y recibos» (`components/contracts/ContractReceiptsCard.tsx`), en la columna de «Condiciones»:
   - cada cobro con su título («Renta de octubre de 2026», «Fianza»), «Pagado el …», importe, «devueltos X €» si hubo devolución parcial y el enlace «Recibo PDF»;
   - enseña los seis últimos y un «Ver los N cobros anteriores» para el resto;
   - si no hay cobros, lo dice. Si la carga falla, lo explica. Sin permiso (403), la tarjeta no aparece.
   - `paymentTitle` y la descarga del PDF pasan a `utils/payments.ts`, que comparten esta tarjeta y «Pagos y recibos».
3. **De paso, la miga de pan** (`components/Breadcrumbs.tsx`) enseñaba el final del ID de Mongo («Contrato #C0D1», «Incidencia #…», «Propiedad #…»), lo que las rondas anteriores ya habían quitado de las cabeceras. Ahora dice «Contrato», «Contrato firmado», «Incidencia» o «Inmueble»; el título ya está en la cabecera de la página.

**Commits.**
- `052e4d1` Contratos: GET /api/contracts/:id/payments lista solo rentas y fianza cobradas, sin IDs de Stripe, con acceso del co-titular y 404 para un contrato inexistente
- `40390b3` Contratos: el detalle de un contrato firmado muestra «Cobros y recibos» con «Recibo PDF»
- `49a6360` Interfaz: la miga de pan nombra las fichas sin el ID interno

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` del nuevo `tests/contracts/payments.history.test.ts`: 3/3. Comprueba:
  - de seis pagos (fianza, dos rentas cobradas, una pendiente, una devuelta y un servicio) solo salen las dos rentas cobradas y la fianza, en orden y sin campos de Stripe ni pagador;
  - lo ven inquilino, co-titular `JOINED`, agencia `manage` y admin; reciben 403 el invitado, un casero ajeno y la agencia con `status_only`;
  - un contrato inexistente y un id raro dan 404.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 35 ficheros y 130 tests OK (antes 33 y 123). Casos nuevos:
  - `ContractReceiptsCard`, 4: lista con devolución y descarga, seis visibles más «Ver los 2 cobros anteriores», sin cobros y descarga fallida, 403 sin tarjeta y error de carga;
  - `ContractDetail`, 1: el casero de un contrato activo ve la tarjeta y en un borrador no se pide;
  - `Breadcrumbs`, 2.
  - A los mocks de `services/contracts` de los dos tests de `ContractDetail` les faltaba `getPaymentHistory` y fallaban. Se ha añadido, y la tarjeta usa `await` para no depender de que el mock devuelva una promesa.
- Playwright (vite local, `/api/*` simulado, casero con 11 cobros) a 1280 y 390 px (`/tmp/ra-shots39`): sin desbordamiento horizontal; tarjeta revisada en las dos anchuras.
- GitNexus: `impact` LOW en `getContractPayments` (solo la ruta) y en `labelFor`. `detect_changes` da riesgo medio porque toca `Payments`: solo se movió `paymentTitle` a utils, y `Payments.test` pasa 4/4.

**Qué queda.**
- La tarjeta lista lo cobrado, no lo que se debe. Los meses pendientes del casero siguen sin vista propia; el inquilino los ve en «Pagos y recibos».
- La fianza solo sale si existe su `Payment`; el cobro por Checkout no siempre lo crea (hueco de la auditoría, ronda 38).
- Pendientes anteriores: búsqueda de incidencias en el servidor (`q`), en móvil el historial de la ficha antes que la descripción, adjuntos de chat públicos, `console.*` fuera del logger.

**Siguiente mejora propuesta.** Que el cobro de la fianza por Checkout (`checkout.session.completed` con `kind: deposit`) cree siempre su `Payment` `type: 'deposit'`, de forma idempotente por `stripePaymentIntentId`. Así la fianza tiene recibo y aparece en «Cobros y recibos». Después, la búsqueda de incidencias en el servidor.

### Ronda 40 — 2026-10-12 01:13

**Qué y por qué.** La fianza no tenía recibo, que era la mejora propuesta en la ronda 39. El cobro por Checkout solo marcaba `depositPaid` en el contrato y no creaba ningún `Payment`. Por eso la fianza no tenía recibo PDF ni aparecía en «Cobros y recibos» del casero ni en «Pagos y recibos» del inquilino, aunque las dos pantallas y el recibo ya la contemplaban. Es un hueco en el flujo de pago, el más crítico.

1. **Webhook** (`routes/stripe.webhook.ts`, nuevo `services/depositPayment.service.ts`):
   - `checkout.session.completed` con `deposit: 'true'` crea el `Payment` de la fianza: `type: 'deposit'`, `succeeded`, concepto «Fianza», pagador el inquilino, cobrador el casero, importe de `amount_total` (si falta, el del contrato) y la misma fecha que `depositPaidAt`;
   - el pago se crea una sola vez por PaymentIntent (`$setOnInsert` sobre el índice único `stripePaymentIntentId`, e ignora el 11000 de una carrera). Se crea también si la fianza ya estaba marcada como pagada, así el reintento de un evento que falló a medias completa lo que faltaba;
   - devoluciones (`charge.refunded`): ahora la fianza tiene `Payment` y el webhook lo encontraba primero, así que sin más cambios la devolución se habría quedado en el pago y no en el contrato (`depositAmountRefunded`/`depositRefundedAt`, que es lo que enseña la ficha). Para una fianza se actualizan las dos cosas y el historial dice `depositRefunded`, como antes;
   - disputas: igual. Se guarda en el pago y en `depositDispute` del contrato, con `target: 'deposit'`.
2. **Relleno de las fianzas anteriores** (`scripts/backfill_deposit_payments.ts`, `backfillDepositPayments`). Sin `--apply` solo cuenta. Con `--apply` crea el pago de cada contrato con `depositPaid` y `depositPaymentIntentId` que no lo tenga, con la devolución si la hubo, y es idempotente. Los contratos sin PaymentIntent guardado los lista aparte. No lo he ejecutado contra ninguna base real: queda en «Para Jorge».

**Commits.**
- `9f0ec87` Pagos: el cobro de la fianza por Checkout crea su pago de fianza (una vez por PaymentIntent), con recibo PDF y en las listas de cobros; devoluciones y disputas siguen anotándose en el contrato
- `c66608b` Pagos: script de relleno de los pagos de fianza anteriores; `recordDepositPayment` pasa a `services/depositPayment.service`

**Verificación (resultados reales).**
- `npx tsc --noEmit` sin errores, y el script comprobado aparte con `tsc`, porque `tsconfig` solo incluye `src`.
- Jest `--runInBand`:
  - `payments.disputes`: 7/7 (antes 5). Casos nuevos:
    - dos eventos con la misma sesión crean un solo pago, con importe de `amount_total`, pagador, cobrador y fecha iguales a los del contrato;
    - el casero lo ve en `GET /api/contracts/:id/payments` y el inquilino descarga el PDF (`%PDF-`);
    - el reintento crea el pago que faltaba sin repetir `depositPaid` en el historial;
    - la devolución total deja el pago `refunded`;
    - la disputa cerrada queda en el pago y en el contrato.
  - Nuevo `deposit.backfill`: 1/1 (modo prueba, `--apply`, devolución y segunda ejecución sin duplicar).
  - `refunds`, `receipt`, `history`, `duplicates`, `serviceOffer.payment` y `src/__tests__/webhook`: todo OK.
  - e2e: 10/10.
- Frontend: no se ha tocado, así que no he ejecutado su build ni sus tests. Ya titulaba «Fianza» y ofrecía su recibo (rondas 38 y 39).
- GitNexus: `impact` no encuentra los símbolos porque el índice es del repo canónico y no conoce esta rama. `detect_changes` da riesgo medio por `maybePayAgencyRentFeeShare`, pero es un falso positivo por las líneas desplazadas: el diff no lo toca.

**Qué queda.**
- Ejecutar el relleno en producción (Jorge).
- El inquilino no recibe correo al pagar la fianza (sí al pagar la renta), y el casero no recibe aviso de ninguno de los dos (hueco «Notificaciones» de la auditoría).
- Sigue sin existir un flujo de devolución de la fianza dentro de la app; solo se reflejan las que se hacen desde Stripe.
- Pendientes anteriores: búsqueda de incidencias en el servidor (`q`), en móvil el historial de la ficha antes que la descripción, adjuntos de chat públicos, `console.*` fuera del logger.

**Siguiente mejora propuesta.** Llevan tres rondas en pagos; toca interfaz. La búsqueda de incidencias en el servidor (`q` escapado en `GET /api/tickets/my/*` y la lista usándolo) y, en la ficha móvil, la descripción antes que el historial.

### Ronda 41 — 2026-10-12 01:26

**Qué y por qué.** Llevaba tres rondas en pagos; esta va de interfaz, con la mejora propuesta en la ronda 40: búsqueda de incidencias en el servidor y orden de la ficha en móvil. Al mirarlo apareció además un fallo de validación en el servidor.

1. **Backend** (`routes/ticket.routes.ts`). `GET /api/tickets/my/tenant|owner|pro`:
   - aceptan `q`: busca en el título (sin distinguir mayúsculas, escapado: `.*` o `(2)` se buscan como texto) o por el nombre del servicio en español, con o sin tilde («fontaneria» encuentra las de fontanería). Recorta a 100 caracteres. El `total` y la paginación cuentan sobre lo encontrado;
   - `status` llegaba a Mongo sin validar, así que `?status[$ne]=closed` pasaba un operador a la consulta (solo dentro de las incidencias propias, por eso el impacto era bajo). Ahora solo se admiten los estados del modelo: cualquier otro da 400 `invalid_status`. Un `q` que no sea texto da 400 `invalid_query`;
   - los tres manejadores eran copias del mismo código: pasan a uno (`listMine`). De paso desaparece una copia muerta de `publishSystem` que estaba metida dentro del de `/my/pro`.
2. **Interfaz**:
   - `pages/tickets/TicketsList.tsx`: la búsqueda filtraba solo los 20 de la página cargada, así que una avería de la página 2 «no existía». Ahora manda `q` al servidor (espera 300 ms al teclear con `useDebouncedValue`), vuelve a la página 1 y mantiene la lista anterior mientras carga;
   - `pages/tickets/TicketDetail.tsx`: en móvil la columna lateral entera iba primero, de modo que el historial salía antes de la descripción. Con `contents` en móvil, el orden pasa a ser «Qué puedes hacer», descripción, historial y chat. En escritorio no cambia nada.

**Commits.**
- `7fee7c3` Incidencias: GET /api/tickets/my/* busca en el servidor y valida el estado (400 invalid_status); un solo manejador
- `06f2469` Incidencias: la lista busca en el servidor; en móvil la ficha pone la descripción antes del historial

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand`:
  - nuevo `tests/escrow/ticket.list.test.ts`, 5/5: título sin mayúsculas y sin las del otro inquilino; servicio con y sin tilde para inquilino, propietario y profesional; `(2)` y `.*` como texto; búsqueda con estado y `total` sobre lo filtrado; 400 con estado desconocido, `status[$ne]` y `q[$gt]`;
  - `tests/escrow` completo: 4 suites, 19 tests OK;
  - `tests/security`: 3 suites, 16 tests OK;
  - e2e (`npm run test:e2e`): 10/10.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 36 ficheros y 132 tests OK (antes 35 y 130). Nuevo `TicketsList.test.tsx` con 2 casos: la búsqueda va al servidor con `page: 1` y `q` recortado, y sin resultados lo dice y deja el buscador a la vista.
- Playwright (vite local, `/api/*` simulado) a 390 y 1280 px (`/tmp/ra-shots41`): la lista con `?q=grifo` pide `q=grifo` al servidor; en la ficha móvil el orden es acciones, descripción e historial, y en escritorio queda igual que antes. Sin desbordamiento horizontal.
- GitNexus `detect_changes` (worktree contra el índice del repo canónico): riesgo bajo, sin símbolos ni flujos afectados.

**Qué queda.**
- La búsqueda no mira la descripción ni la dirección del inmueble; si hace falta, se añade al `$or` (con índice de texto si crecen los datos).
- Las pantallas del profesional `Billing` y `Quotes` siguen pidiendo 100 incidencias y filtrando en el cliente.
- Pendientes anteriores: correo al inquilino al pagar la fianza y aviso al casero de los cobros; flujo de devolución de fianza en la app; adjuntos de chat públicos; `console.*` fuera del logger.

**Siguiente mejora propuesta.** Avisos de cobro: correo al inquilino al pagar la fianza (como ya tiene la renta) y al casero cuando se cobra una renta o una fianza, con enlace a «Cobros y recibos». Es el hueco «Notificaciones» de la auditoría, en el flujo de pago.

### Ronda 42 — 2026-10-12 01:41

**Qué y por qué.** La mejora propuesta en la ronda 41: los avisos de cobro, que es el hueco «Notificaciones» de la auditoría, dentro del flujo de pago. Al revisarlo aparecieron dos fallos pequeños en el webhook.

1. **Avisos** (nuevo `services/paymentNotice.service.ts`, `notifyPaymentSucceeded`; plantilla `paymentNoticeEmail` en `utils/email.ts`, que sustituye a `sendPaymentReceiptEmail`):
   - a quien paga le llega un justificante: concepto como en el recibo PDF («Renta de octubre de 2026», «Fianza»), importe, fecha y vivienda, con «Descargar el recibo» hacia `/tenant/payments`. Si el pago no tiene recibo PDF (servicios), no hay botón;
   - al casero, si es renta o fianza, le llega «Cobro recibido: Renta de octubre de 2026 · 800,00 €», con quién ha pagado y qué vivienda, y «Ver cobros y recibos» hacia el contrato;
   - la fianza no avisaba a nadie. Ahora avisa cuando se crea su `Payment` (una vez por PaymentIntent, ronda 40);
   - el envío no bloquea la respuesta a Stripe, nunca lanza y los errores van al logger;
   - el texto no dice que el dinero ya esté en la cuenta del casero, porque eso depende del reparto (P1, reservado).
2. **Fallos del webhook** (`payment_intent.succeeded`):
   - el justificante de la renta salía en cada reintento del mismo evento (Stripe reintenta si el proceso falló a medias). Ahora solo sale cuando el pago pasa a cobrado;
   - cada reenvío reescribía `paidAt`, y con él la fecha del recibo PDF. Ahora un pago ya cobrado conserva su fecha y solo refresca el cargo y la URL del recibo de Stripe.
3. `rentReceiptPdf.ts` exporta `rentPeriodLabel` y `receiptConcept`, que usan el PDF y el correo, para que el concepto sea el mismo en los dos.

**Commits.**
- `010fa33` Pagos: justificante al inquilino y aviso de cobro al casero, una sola vez por pago; un reenvío ya no cambia la fecha de pago

**Verificación (resultados reales).**
- `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - nuevo `tests/contracts/payments.notice.test.ts`, 3/3: (1) la renta cobrada manda dos correos (inquilina con `hasReceipt`; casero con quién paga, vivienda y contrato), y el reenvío con otro id de evento no manda más ni cambia `paidAt`, pero sí actualiza el cargo; (2) una renta ya devuelta no vuelve a cobrarse ni avisa; (3) la fianza con la sesión repetida avisa una sola vez a cada uno, con 1.600 €;
  - `tests/unit/email.escape.test.ts`: 6/6 (el caso del recibo pasa a la plantilla nueva y hay dos nuevos: aviso al casero con enlace al contrato y justificante sin botón cuando no hay PDF);
  - `tests/contracts` completo, `tests/unit`, `serviceOffer.payment` y `src/__tests__/webhook`: 38 suites, 160 tests OK;
  - e2e: 10/10.
- Frontend: no se ha tocado, así que no he ejecutado su build ni sus tests.
- GitNexus `detect_changes`: riesgo medio por `sendContractActiveEmail` y `fee`. Es un falso positivo por las líneas desplazadas, porque el diff no los toca. `sendPaymentReceiptEmail` desaparece; solo lo usaba el webhook.

**Qué queda.**
- La agencia gestora no recibe aviso de cobro. ¿Debe recibirlo, además del propietario o en su lugar? No lo he decidido.
- Sin SMTP en producción, los correos solo se anotan en el log (como los demás).
- El co-titular que paga recibe su justificante, pero el inquilino principal no se entera.
- Pendientes anteriores: flujo de devolución de la fianza en la app; adjuntos de chat públicos; `console.*` fuera del logger; `Billing` y `Quotes` del profesional filtran en el cliente.

**Siguiente mejora propuesta.** Hace dos rondas que no toco la interfaz. Propongo las pantallas del profesional, `Billing` y `Quotes`: usar la búsqueda y la paginación del servidor (como la lista de incidencias de la ronda 41) y pasarlas al sistema 2026.

### Ronda 43 — 2026-10-12 01:58

**Qué y por qué.** La mejora propuesta en la ronda 42: las pantallas del profesional «Presupuestos» y «Facturación», que no tocaba desde hacía dos rondas. Al mirarlas aparecieron fallos de cálculo, no solo de aspecto:

- pedían `limit: 100`, pero el servidor da 50 como máximo, así que las cifras y el CSV salían de las 50 últimas incidencias;
- contaban estados que no existen (`done`, `awaiting_approval`). Un trabajo «Por validar» (`awaiting_validation`) no salía como facturable, y «Aprobados» se lo saltaba;
- el CSV tenía cabeceras en inglés, el ID como única referencia y ninguna protección contra fórmulas.

1. **Backend** (`routes/ticket.routes.ts`):
   - `GET /api/tickets/my/pro/summary` (solo `pro`): una agregación sobre todas las incidencias del profesional. Devuelve por presupuestar, esperando al propietario, aprobados e importe presupuestado; y pendiente de liberar y liberado, con número de trabajos e importe. El importe es presupuesto más extra aprobado, lo mismo que libera `releaseTicketEscrow`;
   - `GET /api/tickets/my/pro/billing.csv` (solo `pro`): los trabajos facturables (pagado el presupuesto: por agendar, agendada, en curso, por validar y cerrada), hasta 5.000. Columnas en español: fecha, trabajo, servicio, estado, presupuesto, extra aprobado, total y referencia. Va con BOM para Excel y pasa por `csvRow`, que neutraliza fórmulas;
   - los listados `/my/*` admiten varios estados separados por comas (`status=awaiting_validation,closed`). Cada uno se valida igual que antes y cualquiera desconocido da 400 `invalid_status`.
2. **Interfaz**, en el sistema 2026 como la lista de incidencias:
   - nuevo `components/pro/ProTicketList.tsx`: lista paginada en el servidor con búsqueda (300 ms) y filtros con recuento;
   - `Presupuestos`: empieza en «Por presupuestar». Las filas sin presupuesto dicen «Enviar presupuesto» y el total presupuestado va a la derecha del título;
   - `Facturación`: dos cifras, «Pendiente de liberar» y «Pagos liberados», con número de trabajos. Filtros «Todos», «Pendientes de liberar» y «Liberados». Cada fila muestra el total y, si hay extra aprobado, el desglose. «Exportar CSV» descarga el del servidor y avisa si falla;
   - quité las tarjetas con icono, la tabla que no cabía en móvil y la cifra «Total facturable», que era la suma de las otras dos.
3. **Test que fallaba** (`tests/escrow/ticket.access.test.ts`, «accepts only own uploaded photos»): fallaba también en la base, sin mis cambios. La cuenta del propietario se creaba después de abrir la incidencia, así que el aviso por correo, que sale en segundo plano, a veces no encontraba su dirección. Ahora la cuenta se crea antes, como en el caso anterior del mismo fichero. El código no tenía fallo.

**Commits.**
- `cb07847` Incidencias: resumen y CSV de facturación del profesional calculados en el servidor; el listado admite varios estados; test de fotos sin carrera
- `dc85ad7` Interfaz: «Presupuestos» y «Facturación» del profesional en el sistema 2026, con cifras, lista y CSV del servidor

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/escrow`: 5 suites, 23 tests OK. Incluye el nuevo `ticket.pro.summary` (4/4):
  - el resumen suma los extras aprobados y no los pendientes, y no cuenta incidencias de otro profesional;
  - el CSV trae solo los trabajos facturables propios, en español, con `'=HYPERLINK` neutralizado;
  - el propietario recibe 403 en el resumen y en el CSV;
  - el filtro con varios estados funciona y `closed,done` da 400.
- `ticket.access` falló dos veces antes del arreglo, también en el commit base, y pasa después.
- GitNexus `detect_changes`: riesgo bajo, sin flujos afectados. `impact` sigue sin encontrar los símbolos, porque el índice es del repo canónico.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 37 ficheros y 135 tests OK (antes 36 y 132). El nuevo `ProBillingQuotes.test.tsx` tiene 3 casos:
  - Facturación pide los estados facturables al servidor y cambia de filtro;
  - solo desglosa el extra aprobado;
  - el CSV avisa si falla, y Presupuestos empieza en «Por presupuestar» con «Enviar presupuesto».
- Playwright (vite local, `/api/*` simulado) a 1280 y 390 px (`/tmp/ra-shots43`): las peticiones llevan `status` y `limit=20`. Sin desbordamiento horizontal. En móvil, las dos cifras van lado a lado y las filas apilan título, estado e importe.

**Qué queda.**
- «Pagos liberados» cuenta los trabajos cerrados, que es cuando se libera el depósito de garantía. Que el dinero llegue de verdad al profesional depende del rediseño del escrow con Stripe real (P5, reservado).
- `ProDashboard` sigue con el aspecto antiguo (degradado naranja y tarjetas con icono en círculo) y su enlace dice «Gestiona tus ingresos y facturas», pero facturas no hay.
- `Profile` del profesional es un marcador de 3 líneas.
- Pendientes anteriores: aviso de cobro a la agencia (Jorge), flujo de devolución de fianza en la app, adjuntos de chat públicos, `console.*` fuera del logger.

**Siguiente mejora propuesta.** El inicio del profesional (`ProDashboard`) en el sistema 2026: quitar el degradado y las tarjetas con icono, enseñar «lo que te toca hoy» con el mismo resumen (por presupuestar, citas por proponer, por validar) y separar el formulario de perfil público en `/pro/profile`, que hoy es un marcador.

### Ronda 44 — 2026-10-12 02:18

**Qué y por qué.** Era la mejora propuesta en la ronda 43: el inicio del profesional. Al revisar de dónde salen sus datos (`/api/pros`) apareció un fallo de permisos, así que va primero.

1. **Seguridad** (`routes/pro.routes.ts`):
   - `POST /api/pros` no comprobaba el rol, así que cualquier inquilino o casero verificado podía crearse un perfil profesional activo. Ese perfil salía en el directorio público y el casero podía asignarle averías (`/:id/assign` solo mira que el perfil exista y esté activo). Ahora solo lo admite el rol `pro` (403 para los demás);
   - los campos se validan y se limpian: nombre de 2 a 80 caracteres, ciudad de 2 a 60, servicios conocidos sin repetir, precio orientativo numérico de 0 a 100.000 € (redondeado a céntimos) y `active` booleano. Si algo falla, da 400 `invalid_display_name`, `invalid_city`, `invalid_services` o `invalid_active`. Antes `services` llegaba tal cual;
   - `active` permite pausar el perfil. Antes cada guardado lo dejaba activo a la fuerza;
   - `GET /:id` con un id mal formado da 404 (antes, 500 con el mensaje de Mongoose). Los 500 ya no devuelven `err.message`, que se anota en el logger.
2. **Resumen** (`GET /api/tickets/my/pro/summary`): añade `work` con los trabajos por agendar, en curso (agendados o empezados) y por validar.
3. **Interfaz**:
   - `ProDashboard`: pasa al sistema 2026 y pierde el degradado naranja, las tarjetas con icono en círculo y la casilla «Primeros pasos», que nunca marcaba nada. Ahora tiene:
     - «Lo que te toca», con por presupuestar, por agendar y en curso, cada uno enlazado a su lista y solo si hay alguno;
     - una línea «Pendiente del propietario» (presupuestos por aprobar y trabajos por validar);
     - los cobros, con las mismas cifras de Facturación;
     - la tarjeta del perfil (nombre, ciudad, servicios, visible o pausado). Si no hay perfil, avisa de que sin él no le pueden asignar averías.
     
     Había otros fallos: el formulario no avisaba si fallaba al guardar (promesa sin capturar), el enlace «Bolsa de trabajos» prometía buscar incidencias, cuando solo se ven las asignadas, y el de Facturación hablaba de «facturas» que no existen;
   - `/pro/profile` deja de ser un marcador de 3 líneas. Es el formulario real: nombre comercial, ciudad, servicios con precio orientativo opcional (admite coma decimal) y «Visible para propietarios». Valida antes de enviar, traduce los errores del servidor y enlaza a «Ver perfil público»;
   - la ficha pública `/pros/:id` enseñaba las claves en inglés («plumbing, painting»). Ahora muestra los servicios en español con «desde 45,00 €» y la valoración solo si hay opiniones. La miga de pan dice «Profesionales / Profesional» en vez de «pros / p1».

**Commits.**
- `a01a7d8` Profesionales: solo una cuenta de profesional crea o edita perfil; validación, pausa, 404 y errores sin detalles internos; el resumen cuenta por agendar, en curso y por validar
- `dba51b3` Interfaz: inicio del profesional en el sistema 2026, formulario real en /pro/profile y ficha pública en español

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/security`, `tests/escrow` y `src/__tests__/auth-hardening.test.ts`: 10 suites, 52 tests OK. El nuevo `tests/security/pro.profile.test.ts` tiene 11 casos:
  - un inquilino recibe 403 y no se crea nada;
  - los datos se limpian, `verified` y `ratingAvg` del cuerpo se ignoran, y el perfil pausado sale del directorio;
  - 8 cuerpos no válidos dan 400 con su código: nombre como array, nombre corto, ciudad vacía, servicio desconocido, servicio repetido, precio negativo, precio como texto y `active` como texto;
  - el id mal formado da 404.
  
  `ticket.pro.summary` comprueba los recuentos de `work`. Un filtro `?city[]=…` ya no llega como array a la ruta (el servidor lo aplana antes), así que dejé esa comprobación solo como defensa en el código.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 38 ficheros y 140 tests OK (antes 37 y 135). Casos nuevos:
  - `ProHomeProfile.test.tsx`, con 4: enlaces y filas del inicio, línea del propietario y aviso de crear perfil; resumen del perfil en español; el formulario no envía sin servicio y luego guarda `45,50` como 45,5; error del servidor traducido y perfil pausado cargado;
  - un caso más en `Breadcrumbs`.
- Playwright (vite local, `/api/*` simulado) a 1280 y 390 px (`/tmp/ra-shots44`): inicio con y sin perfil, perfil y ficha pública. Sin desbordamiento horizontal en ninguna de las 8 capturas. Con las capturas corregí dos detalles: la frase de espera, que repetía «esperando», y el título «Servicios», que quedaba montado sobre la línea divisoria.
- GitNexus `detect_changes` (contra `ab3203f`): riesgo bajo, sin flujos afectados.

**Qué queda.**
- Los perfiles profesionales que hubieran creado otros roles siguen en la base (ver «Para Jorge»).
- El directorio `/pros` (`ProList`) sigue con el aspecto antiguo. La ficha pública no tiene botón de contacto ni opiniones.
- «En curso» enlaza al filtro «Agendadas». `in_progress` no lo asigna ningún flujo hoy.
- Pendientes anteriores: aviso de cobro a la agencia (Jorge), flujo de devolución de la fianza en la app, adjuntos de chat públicos, `console.*` fuera del logger.

**Siguiente mejora propuesta.** El directorio de profesionales (`ProList`, `/pros`) en el sistema 2026, con filtros por servicio y ciudad que vayan al servidor, y desde la ficha de una incidencia del casero, «Asignar» a un profesional del directorio. Antes conviene comprobar cómo elige hoy el casero al profesional en `TicketDetail`.


### Ronda 45 — 2026-10-12 02:40

**Qué y por qué.** Era la mejora propuesta en la ronda 44: el directorio de profesionales y cómo elige el casero al profesional de una avería. Al revisar `/assign` apareció un hueco que deja la ronda 44, así que va primero.

1. **Backend**:
   - `POST /api/tickets/:id/assign` solo miraba que el perfil existiera y estuviera activo. Los perfiles que crearon inquilinos o caseros antes de la ronda 44 seguían siendo asignables, y con ello veían la incidencia y podían presupuestar. Ahora la cuenta del perfil tiene que tener `role: 'pro'` (si no, 404 `pro not found`);
   - un `proId` que no es texto da 400 `invalid_pro`, y uno mal formado 404. Antes daba 500 con el mensaje de Mongoose;
   - `loadTicketFor`: un id de incidencia mal formado da 404 en todas las rutas `/api/tickets/:id/*` (antes, 500);
   - `GET /api/tickets/:id` trae `propertyCity` (la ciudad del inmueble) y `pro.profileId` (el perfil público);
   - `GET /api/pros`: la ciudad se busca sin distinguir mayúsculas ni tildes («malaga» encuentra «Málaga»; antes solo mayúsculas) y sigue escapada; un servicio desconocido da 400 `invalid_query`.
2. **Interfaz**:
   - `/pros` (`ProList`) se rehace en el sistema 2026. Antes tenía estilos sueltos, servicios en inglés («plumbing, painting»), «⭐ 0.0 (0)» para todos y solo la primera página. Ahora:
     - filtros por servicio (chips) y ciudad (espera 300 ms), que van al servidor;
     - recuento y paginación;
     - servicios en español, «desde» del servicio elegido y valoración solo si hay opiniones;
     - si los filtros no dan resultados, ofrece quitarlos;
   - el casero tiene «Profesionales» en su menú. `/pros` y `/pros/:id` exigen sesión, como su API (antes, sin sesión, la página salía rota);
   - en la incidencia, «Buscar profesional» (nuevo `components/pro/ProPicker.tsx`) busca en la ciudad del inmueble. Antes mandaba `ticket.city`, que no existe, así que mezclaba todas las ciudades. Además:
     - cada fila tiene precio orientativo, valoración y enlace al perfil;
     - si no hay nadie en la ciudad, lo dice y ofrece «Buscar en todas las ciudades»;
     - si falla la carga, lo dice y ofrece reintentar (antes enseñaba «No hay profesionales»);
   - el profesional asignado enlaza a su perfil público;
   - `utils/pros.ts` (`proRatingText`, `proPriceText`) lo comparten el directorio, el selector y la ficha `/pros/:id`.

**Commits.**
- `2da2f35` Profesionales: asignar solo perfiles de cuentas de profesional; 400/404 en vez de 500; ciudad del inmueble y perfil en la ficha; ciudad sin tildes en el directorio
- `576a496` Interfaz: directorio de profesionales en el sistema 2026 y selector de profesional en la incidencia

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/escrow` y `tests/security`: 10 suites, 54 tests OK. Incluye el nuevo `tests/escrow/ticket.assign.test.ts`, con 4 casos:
  - asignar un perfil de profesional, y la ficha trae `profileId` y `propertyCity`;
  - el perfil de una cuenta de inquilino da 404 y no se asigna; un id mal formado da 404 y un array da 400 `invalid_pro`;
  - `GET /api/tickets/xyz` da 404;
  - el directorio encuentra «  malaga » en «Málaga», «Mala.a» no encuentra nada y `gardening` da 400.
- e2e (`npm run test:e2e`): 10/10.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 39 ficheros y 143 tests OK (antes 38 y 140). Casos nuevos:
  - `ProList.test.tsx`, con 2: filtros que llegan al servidor, precio del servicio elegido y nada de valoración sin opiniones; sin resultados ofrece quitar los filtros;
  - en `TicketDetail.test.tsx`, el caso de «Buscar profesional» pasa a comprobar la búsqueda en la ciudad del inmueble, la ampliación a todas, el texto de la fila y la asignación; hay otro nuevo para el enlace al perfil del asignado.
- Playwright (vite local, `/api/*` simulado) a 1280 y 390 px (`/tmp/ra-shots45`): directorio, directorio filtrado y selector en la incidencia (ciudad y todas). Sin desbordamiento horizontal. Con las capturas corregí un detalle: en la columna estrecha, el precio y la valoración se cortaban con «…», y ahora pasan a la línea siguiente.
- GitNexus `detect_changes`: riesgo medio por `AppRoutes` y `TicketDetail`, que son los cambios buscados (rutas protegidas y selector), y los dos están cubiertos por los tests.

**Qué queda.**
- El directorio sigue incluyendo los perfiles antiguos de otros roles (ya no se pueden asignar). Desactivarlos es decisión de Jorge (ronda 44). Filtrarlos en `GET /api/pros` exigiría cruzar con usuarios en cada consulta.
- La miga de pan de la incidencia dice «Mis incidencias» también para el casero, que llega desde «Incidencias de mis propiedades».
- `/landlord/services` («Servicios») es un marcador de dos líneas.
- La ficha pública del profesional no tiene opiniones ni contacto.
- Pendientes anteriores: aviso de cobro a la agencia (Jorge), flujo de devolución de la fianza en la app, adjuntos de chat públicos, `console.*` fuera del logger.

**Siguiente mejora propuesta.** Las rutas de incidencias que aún devuelven `err.message` en sus 500 (`ticket.routes.ts`, varios `catch`): pasarlas al logger con un código fijo, como `pro.routes` en la ronda 44. Y de paso, que la miga de pan de la incidencia diga «Incidencias» según el rol.

### Ronda 46 — 2026-10-12 05:40

**Qué y por qué.** La mejora propuesta en la ronda 45. Es de seguridad: varias rutas devolvían `err.message` en sus 500. Con un error de Mongo, el cliente recibía el texto interno, y un `E11000` lleva el correo duplicado. Lo mismo pasaba con los errores de Stripe y de configuración (`docusign_env_missing: …` nombra variables de entorno). Además, esos 500 no se registraban en ningún log. De paso, la miga de pan de la incidencia, que la ronda 45 dejó anotada.

1. **`src/utils/routeError.ts`** (`sendRouteError(res, err, código)`):
   - un 4xx lanzado a propósito (`Object.assign(new Error('Forbidden'), { status: 403 })`) conserva su mensaje, porque es el contrato con el frontend;
   - cualquier otro error se registra con el logger (método, ruta sin query, usuario y `err`, que ya pasa por la censura de datos personales) y el cliente solo recibe `{ error: '<código fijo>', code }`;
   - un 5xx deliberado, como el 503 de `escrow_mock_not_allowed_in_prod`, conserva su estado, pero no el mensaje.
   
   Se aplica a 39 `catch` de `ticket`, `chat`, `review`, `serviceOffers`, `appointments`, `verification`, `identity` (`/start`) e `invites`. Cada fichero tiene su código: `ticket_request_failed`, `chat_request_failed`, etc. La firma inválida del webhook de identidad responde `webhook_signature_invalid` sin repetir el error de Stripe.
2. **Miga de pan de `/tickets/:id`**: el casero vuelve a «Incidencias de mis propiedades» (`/landlord/issues`) y el profesional a «Incidencias asignadas» (`/pro/tickets`). Antes, todos volvían a «Mis incidencias», la lista del inquilino.

**Commits.**
- `efc9ff7` Seguridad: las rutas ya no devuelven el mensaje interno en sus 500
- `fbd2374` Interfaz: la miga de pan de una incidencia vuelve a la lista de cada rol

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/unit/routeError.test.ts`, `tests/escrow`, `tests/chat` y `tests/security`: 14 suites, 73 tests OK.
  - Hay un test nuevo, `routeError.test.ts`, con 4 casos:
    - un 4xx conserva su mensaje;
    - un E11000 con correo da `thing_failed` sin el correo y se registra con método y ruta;
    - un 503 deliberado conserva el estado sin el mensaje;
    - un estado no numérico da 500.
  - En `escrow.release.recovery`, el 500 de la liberación interrumpida comprueba ahora que el cuerpo es exactamente `{ error: 'ticket_request_failed', code: 500 }` (antes llegaba «db down»).
- e2e (`npm run test:e2e`): 10/10.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 39 ficheros y 145 tests OK (antes 143). Hay 2 casos nuevos en `Breadcrumbs.test.tsx`: casero, profesional e inquilino. En la primera pasada falló una vez `AppShell.test.tsx` («abre el menú…»), pero pasó aislado y en la segunda suite completa; es intermitente, no del cambio.
- GitNexus `detect_changes`: riesgo bajo, sin flujos afectados.

**Qué queda.**
- Unos 28 sitios más devuelven `e.message` en controladores: `contract*`, `payment`, `admin`, `policy`, `requireVerified` y `tenantPro.routes`. Algunos son 4xx con mensaje a propósito; hay que revisarlos uno a uno antes de pasarlos a `sendRouteError`.
- `stripe.webhook.ts` responde `Webhook Error: <mensaje>` cuando la firma falla. Es el patrón de la documentación de Stripe y no filtra datos, así que no lo he tocado.
- Pendientes anteriores: aviso de cobro a la agencia (Jorge), `/landlord/services` es un marcador, la ficha pública del profesional no tiene opiniones, adjuntos de chat públicos y `console.*` fuera del logger.

**Siguiente mejora propuesta.** Revisar los controladores de contratos y pagos (`contract.controller`, `contract.payment.controller`, `payment.controller`): separar los 4xx deliberados de los 500 y pasar estos a `sendRouteError`, con un test por controlador del 500 sin mensaje interno.

### Ronda 47 — 2026-10-12 05:50

**Qué y por qué.** La mejora propuesta en la ronda 46, de seguridad. Los controladores de contratos y pagos devolvían `err.message` en sus 500, y alguno en `details`. Así podían llegar al cliente el error de Mongo (un `E11000` lleva el correo), el de Stripe o el del descifrado del IBAN (`No se pudo descifrar el IBAN: …`). Además, firmar e iniciar un pago respondían 400 a todo, también a los fallos internos.

1. **`services/contract.actions.ts`**: cada error deliberado de `signContractAction` e `initiatePaymentAction` lleva ya su estado:
   - 404 si el contrato no existe o el id está mal formado (antes, un id mal formado daba el `CastError` de Mongoose con 400);
   - 403 si no estás autorizado o tu rol no puede;
   - 409 si ya está firmado, el estado no permite firmar o no hay IBAN;
   - 401 sin sesión.
   
   Mantienen el texto en español que enseña el frontend. El descifrado del IBAN y el «inquilino no encontrado» pasan a ser 500 sin mensaje.
2. **Controladores** que usan ya `sendRouteError` con un código fijo por acción:
   - `contract.controller`: PDF, firma (`contract_sign_failed`), solicitud de firma (antes daba `details`), listado y ficha. La sesión de Firma.dev mantiene su 502 «Error al conectar con Firma.dev» y anota el error en el logger;
   - `contract.payment.controller` (`initiatePayment`);
   - `contract.notify.controller` (recordatorio y renovación, que antes daban `details`);
   - `contract.terminate` y `contract.lifecycle`: el 409 `invalid_transition` conserva `from` y `to`, y el 500 da `termination_failed` o `activation_failed`;
   - `contract.signature.controller`: callback, inicio y estado de la firma, y registro de auditoría;
   - `contract.cotenant.controller` (partes e invitaciones);
   - `contract.payments.routes` (cobro con tarjeta guardada; el 402 `authentication_required` no cambia) y `payment.controller` (pago de un recibo; el frontend no leía el mensaje).

**Commits.**
- `ca7c819` Seguridad: los controladores de contratos y pagos ya no devuelven el mensaje interno en sus 500

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/contracts`, `tests/security`, `tests/unit/routeError.test.ts` y `src/__tests__`: 40 suites y 184 tests OK. Hay un test nuevo, `tests/security/contract.errors.test.ts`, con 6 casos:
  - un fallo de Stripe al iniciar el pago da exactamente `{ error: 'payment_init_failed', code: 500 }`;
  - un contrato inexistente o un id mal formado dan 404, y otro inquilino 403 con su mensaje;
  - firmar dos veces da 409 «El arrendador ya ha firmado este contrato», y un id mal formado da 404;
  - un fallo de Mongo al firmar da `contract_sign_failed`;
  - el listado y el recordatorio dan su código fijo sin el correo del error;
  - terminar dos veces da 409 con `from` y `to`, y un fallo interno da `termination_failed`.
- e2e (`npm run test:e2e`): 10/10.
- Frontend (sin cambios): `npm --prefix frontend run build` OK y `npm --prefix frontend test` con 39 ficheros y 145 tests OK.
- GitNexus: `impact` de `signContractAction` e `initiatePaymentAction` dio riesgo bajo (un llamador cada una). `detect_changes` marca «crítico» porque por estos controladores pasan 47 flujos, pero el cambio está en sus `catch` y en la comprobación del id. El camino normal no cambia, y las suites de contratos lo cubren.

**Qué queda.**
- Siguen devolviendo `e.message` en un 500: `admin.controller` (12 sitios), `policy.controller`, `taxReport.controller`, `institution.controller`, `requireVerified`, `testingInbound` y `clauses.controller`. Los de subida (`upload`, `tenantPro`) son errores de multer con 400, a propósito.
- Muchos `console.error` en controladores de contratos siguen fuera del logger (por ejemplo, `create` y el historial).
- Pendientes anteriores: aviso de cobro a la agencia (Jorge), `/landlord/services` es un marcador, la ficha pública del profesional no tiene opiniones, adjuntos de chat públicos.

**Siguiente mejora propuesta.** Hace tres rondas que no se toca la interfaz. La 48 debería dedicarse a ella: `/landlord/services` («Servicios»), que es un marcador de dos líneas, o las opiniones en la ficha pública del profesional. Los 500 de `admin`, `policy`, `taxReport` e `institution` (rutas de administración, de menor exposición) pueden ir en la siguiente ronda de seguridad.

### Ronda 48 — 2026-10-12 06:10

**Qué y por qué.** Ronda de interfaz, como proponía la 47 (llevaba tres rondas sin tocarla). Elegí las opiniones del profesional antes que «Servicios» del casero: «Servicios» depende de acuerdos con comercializadoras que no existen (sería inventar producto), mientras que las opiniones tenían backend y les faltaba todo el recorrido. El directorio ordena por valoración y la ficha enseña la media, pero no había ninguna forma de dejar una opinión desde la app.

1. **Backend.**
   - `review.routes`: la media y el número de reseñas se recalculan desde la colección (`refreshRating`). Antes se leía la media, se sumaba la nota y se guardaba, así que dos opiniones simultáneas perdían una (lo comprueba un test). Un `comment` que no es texto da 400 `invalid comment` y se guarda recortado.
   - `GET /api/pros/:id/reviews` (paginado, 5 por defecto y 20 como máximo): nota, comentario, fecha y autor como «Laura M.» (`reviewerLabel`), sin ids de usuario ni correos. Un id mal formado da 404.
   - `GET /api/tickets/:id` añade `proReview: { canReview, mine }`, solo para el propietario o el inquilino de una incidencia cerrada con profesional. La relación que da derecho a opinar ya la comprobaba `isReviewableRelation`.
2. **Interfaz** (sistema 2026, estrellas en tinta, sin colores de pegatina):
   - en la incidencia cerrada, «Qué puedes hacer» pide la valoración: cinco estrellas (radios accesibles, con «Mal… Excelente»), comentario opcional y el aviso de que sale en su perfil con nombre e inicial. Después enseña «Tu opinión sobre …»;
   - en la ficha pública `/pros/:id`, la sección «Opiniones» con la media, autor, mes, comentario y «Ver más opiniones». Sin opiniones lo dice y no enseña un 0,0.

**Commits.**
- `1965673` Opiniones: media recalculada, comentario validado, `GET /api/pros/:id/reviews` y `proReview` en la incidencia
- `25521ff` Interfaz: valorar al profesional al cerrarse la incidencia y opiniones en su ficha

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/reviews`: 2 suites y 11 tests OK. El nuevo `pro.reviews.test.ts` tiene 6 casos: valorar y ver la opinión en la incidencia (el profesional no ve `proReview`), una incidencia sin cerrar no ofrece valorar, la lista pública con nombre abreviado sin ids ni correos (y 404 con id mal formado), dos opiniones simultáneas cuentan las dos (media 3,5), comentario no textual y `reviewerLabel`. Jest `--runInBand` de `tests/escrow`, `tests/security` y `tests/chat`: 14 suites y 75 tests OK.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 40 ficheros y 149 tests OK (antes 145). Hay un `ProReviews.test.tsx` nuevo (lista, «Ver más» y sin opiniones) y 2 casos en `TicketDetail.test.tsx` (valorar y la incidencia cerrada sin opción).
- Playwright (vite local, `/api/*` simulado) a 1280 y 390 px (`/tmp/ra-shots48`): ficha con y sin opiniones, y la incidencia con el formulario y con «Tu opinión». Sin desbordamiento horizontal en las 8 capturas. Con ellas cambié un detalle: el anillo de foco de la estrella salía también con el ratón, y ahora solo con el teclado.
- GitNexus: `impact` de `TicketDetail` y `ProDetail` dio riesgo bajo. `detect_changes` marca riesgo medio, con el único flujo `TicketDetail → GetTicket`, como se esperaba.

**Qué queda.**
- `GET /api/reviews/user/:userId` (sin uso en el frontend) sigue devolviendo `fromUserId` y `relatedId` a cualquier usuario verificado. Conviene limitarlo o quitarlo.
- Las medias guardadas antes no se recalculan hasta la siguiente opinión de cada perfil.
- Moderación de opiniones y formato del nombre: anotado en «Para Jorge».
- Pendientes anteriores: los 500 de `admin`, `policy`, `taxReport` e `institution` con `e.message`; `/landlord/services` es un marcador (depende de producto); aviso de cobro a la agencia (Jorge).

**Siguiente mejora propuesta.** Seguridad: pasar los 500 de `admin.controller`, `policy`, `taxReport` e `institution` a `sendRouteError` y, de paso, cerrar `GET /api/reviews/user/:userId` (quitar `fromUserId`/`relatedId` o reutilizar `reviewerLabel`).
