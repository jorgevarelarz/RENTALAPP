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
- **Al desplegar la ronda 34**: los mensajes de chat solo admiten adjuntos subidos a nuestro `/uploads` (relativos o bajo `APP_URL`, `FRONTEND_URL` o `UPLOADS_BASE_URL`). Si en producción `APP_URL` no es el dominio que devuelve la subida, los adjuntos darán 400 `attachment_domain_not_allowed`; conviene comprobar que `APP_URL` está puesto. Sin `APP_URL`, `/api/uploads/images` devuelve además rutas relativas (`/uploads/…`); desde la ronda 73 el alta de inmueble las acepta (antes no dejaba pasar de «Galería»), pero solo se ven bien si el frontend y la API comparten dominio, como en app.rentalapp.es. Los mensajes antiguos con enlaces externos no se tocan. Además, ¿deben los adjuntos del chat ser privados (URL firmada que caduca)? Hoy son públicos para quien tenga el enlace, aunque el nombre ya no se puede adivinar.
- **Incidencias (ronda 35), dos decisiones:** (1) el coste extra que aprueba el propietario se suma a lo que se libera al profesional (`releaseTicketEscrow`), pero el hold de Stripe solo retuvo el presupuesto, así que la captura pediría más de lo retenido. Va con el rediseño del escrow (P5); no se ha tocado. (2) Tanto el propietario («Validar») como el inquilino («Confirmar que está arreglado») liberan el pago del propietario al profesional. Desde la ronda 35, los dos solo después de que el profesional marque el trabajo terminado. ¿Debe poder liberarlo el inquilino, que no es quien paga?
- **Recibos de renta (ronda 38)**: el PDF dice «Justificante del pago emitido por RentalApp en nombre del arrendador (art. 17.4 LAU)» y lleva nombres de arrendador y arrendatario, vivienda, periodo, fecha, importe y referencia de Stripe, sin DNI/NIF (no se guardan, ver ronda 21) ni los datos legales de RentalApp. Conviene que alguien con criterio legal revise ese texto y decida si el recibo debe llevar NIF de las partes y la razón social de RentalApp.
- **Al desplegar la ronda 40**: las fianzas cobradas antes no tienen pago guardado, así que no tienen recibo ni salen en «Cobros y recibos». `npx ts-node scripts/backfill_deposit_payments.ts` cuenta las que faltan sin escribir nada; con `--apply` las crea (una vez por PaymentIntent, con la devolución si la hubo). Las que no tengan `depositPaymentIntentId` las lista aparte para revisarlas en Stripe. Ejecutarlo en producción es decisión tuya.
- **Avisos de cobro (ronda 42)**: al cobrarse una renta o una fianza, el correo va al inquilino que paga y al propietario. ¿Debe recibirlo también la agencia gestora (`agencyAccess: 'manage'`), o en lugar del propietario? Sin SMTP en producción, estos correos solo quedan en el log.
- **Al desplegar la ronda 44**: `POST /api/pros` solo admite cuentas `pro` (desde la ronda 45, tampoco se pueden asignar a una incidencia perfiles de cuentas que no sean `pro`). Los perfiles profesionales que ya hubieran creado inquilinos o caseros siguen en la base y en el directorio. Conviene buscarlos con una consulta de solo lectura (los `pros` cuyo `userId` no sea de un usuario con `role: 'pro'`) y decidir si se desactivan (`active: false`). Además, los nombres y ciudades guardados antes no se han limpiado.
- **Opiniones de profesionales (ronda 48)**: al cerrarse una incidencia, el propietario y el inquilino que la abrió pueden valorar al profesional (1 a 5 y comentario). La opinión sale en su ficha pública con el nombre y la inicial del apellido («Laura M.»). Tres decisiones: (1) ¿vale ese formato de nombre o debe ser anónima? (2) No hay forma de denunciar ni de retirar una opinión, ni de que el profesional responda; ¿hace falta moderación antes de abrir? (3) Pueden opinar los dos (propietario e inquilino) sobre la misma incidencia; ¿solo quien paga?
- **Al desplegar la ronda 50**: `GET /api/properties` y `GET /api/properties/:id` dejan de devolver `owner`, `agencyId`, `refAgencyId`, `agencyAccess`, `agencyTransferredAt` e `history` a quien no gestiona el inmueble (el dueño, su agencia y el administrador los siguen viendo). Solicitar visita a un borrador o a un anuncio retirado da ya 404. Una decisión: la ficha pública enseña la calle y el número (`address`) a cualquiera, también sin sesión, y el mapa marca el punto exacto. Idealista permite ocultar el número y Airbnb da la zona hasta reservar. ¿Debe la dirección exacta verse solo tras concertar la visita?
- **Al desplegar la ronda 53**: las fechas que los inquilinos propusieron antes desde «Solicitudes» se guardaron con la hora desplazada (2 h tarde en verano y 1 h en invierno), el mismo fallo que la ronda 23 corrigió para el casero. Conviene revisarlas con una consulta de solo lectura (`db.applications.find({proposedBy:'tenant', proposedDate:{$gt:new Date()}})`). Además, proponer una fecha pasada da 400, aceptar una propuesta cuya hora ya pasó da 409 y una solicitud `rejected` no admite cambios. Ningún flujo pasa hoy una solicitud a `rejected`: el casero no tiene forma de descartar a un candidato. ¿Debe tenerla, y avisar al inquilino?
- **Avisos de solicitudes y visitas (ronda 54)**: una solicitud nueva avisa por correo al propietario y a la agencia gestora (`agencyAccess: 'manage'`), con el nombre del inquilino, su mensaje y si tiene la solvencia verificada. Proponer o aceptar fecha avisa a la otra parte. Si la agencia propone o acepta, el inquilino ve el nombre de la agencia; si lo hace el administrador, no se da su nombre. Dos decisiones: (1) ¿debe enterarse también el propietario cuando su agencia concierta una visita? Hoy no. (2) Sin SMTP en producción, estos correos solo quedan en el log.
- **Cambio de visita (ronda 56)**: cuando una parte propone otra hora para una visita ya concertada, la visita concertada sigue en pie hasta que la otra parte acepte la nueva. Si nadie responde, se mantiene la primera. ¿Es la regla que quieres, o proponer un cambio debe anular la visita? Tampoco hay forma de cancelar una visita sin proponer otra fecha.
- **Al desplegar la ronda 63**: la purga de documentos Tenant PRO pasa a ejecutarse cada día a las 03:45. La primera noche borrará del disco y de la base todos los documentos subidos hace más de `TENANT_PRO_DOCS_TTL_DAYS` días (365 si no está puesta); de cada uno queda en `auditTrail` el tipo, el hash y el estado de la revisión. El estado verificado del inquilino no cambia. Es lo que prometen la política de privacidad y la pantalla de Tenant PRO, pero borra datos: si quieres saber antes cuántos son, consulta de solo lectura `db.users.countDocuments({'tenantPro.docs': {$elemMatch: {uploadedAt: {$lt: new Date(Date.now() - 365*864e5)}}}})`. Con varias réplicas, el job correría en cada una (igual que los demás jobs); es inocuo, pero repetido.
- **Al desplegar la ronda 67**: cambian dependencias de ejecución (express 4.22, qs, proxy-addr, nodemailer 10.1, axios), así que hay que reinstalar con `npm ci` en el servidor, no sincronizar solo ficheros sueltos. nodemailer 10 exige Node 20 o superior: el Dockerfile ya usa `node:20`, pero conviene confirmar `node -v` en el VPS antes. Node 20 está ya sin soporte (auditoría de seguridad); pasar a Node 22/24 es decisión tuya.
- **Webhooks de firma genéricos (ronda 69)**: `POST /api/contracts/signature/webhook` y `/api/contracts/:id/signature/callback` cuelgan de `app.use('/api/contracts', authenticate, requireVerified, …)`, así que en producción responden 401 a cualquier proveedor (solo `/signature/callback` y `/signature/firma` son públicos, montados antes en `app.ts`). No es un agujero (rechazan), pero son rutas que no pueden funcionar. Es el punto #9 abierto de `docs/review-firma-2026-10-05.md`: ¿se eliminan o se dejan solo para mock y tests?
- **Búsqueda de direcciones con Nominatim (ronda 71)**: el alta de inmueble sugiere direcciones llamando a `nominatim.openstreetmap.org` desde el navegador mientras se escribe. La política de uso de Nominatim prohíbe expresamente montar un autocompletado en el cliente con su API pública. Desde la ronda 71 se busca como mucho una vez por segundo y no se repite al elegir, pero sigue siendo autocompletado. Con poco tráfico no pasará nada; al abrir conviene elegir un proveedor pensado para esto (Photon de Komoot, MapTiler, Google Places…), que implica darse de alta y quizá pagar. Decisión tuya.
- **Invitaciones rotas en producción (ronda 75), conviene desplegarlo pronto**: en app.rentalapp.es, el propietario invitado por una agencia no puede ver la invitación ni crear su cuenta (la API responde 401 y la pantalla dice «Invitación no válida»), y el co-titular sin sesión tampoco ve la vista previa. Corregido en esta rama (`9bdbe75`) sin cambios de datos ni de entorno. Las invitaciones de agencia enviadas antes siguen valiendo si no han caducado (`INVITE_TTL_DAYS`), así que tras desplegar se pueden reenviar desde «Propietarios» o usar el mismo enlace.
- **Tenant PRO (ronda 80), dos decisiones:** (1) aprobar exige ya una renta máxima entre 1 y 100.000 €/mes; antes se podía aprobar con 0, que en el chat cuenta como «sin dato». Si quieres aprobaciones sin cifra, hay que decidir qué significan para los anuncios «solo Tenant PRO». (2) «Eliminar documentación» desde administración borra también el historial (`auditTrail`) con los hashes, mientras que la purga automática (ronda 63) lo conserva. ¿Debe conservarlo también la manual, como prueba de lo que se revisó?
- **Contratos fuera de Madrid, Galicia y Cataluña (ronda 21)**: el catálogo de cláusulas solo tiene esas tres comunidades (`src/policies/clauses/catalog.v1.ts`). Para un inmueble de cualquier otra, el asistente avisa y no deja crear el contrato. Ampliarlo exige el texto legal de la fianza de cada comunidad. De paso: la cláusula de Madrid cita el «IVIMA», que desde 2017 es la Agencia de Vivienda Social; conviene revisar ese texto.
- **DNI de las partes en el contrato (ronda 21)**: el asistente pedía DNI/NIF del casero y del inquilino, pero el backend no los guardaba ni los ponía en el PDF. Se han quitado del formulario. Si el contrato debe identificarlos, hay que decidir de dónde salen (¿perfil verificado, KYC, Firma.dev?).
- **Portal de institución (ronda 76)**: las cuentas `institution_viewer` necesitan la identidad verificada para entrar en `/api/institution` (sin verificar responden 403 `owner_not_verified`). No era intencionado: les llegaba el `requireVerified` global de `app.ts`. En la ronda 76 se ha dejado explícito para no cambiar nada. Si un organismo público no debe pasar por la verificación, basta quitar `requireVerified` de ese montaje. Decisión tuya.
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

### Ronda 49 — 2026-10-12 06:53

**Qué y por qué.** La mejora de seguridad propuesta en la ronda 48. Era la última tanda de rutas que devolvían el mensaje interno en sus 500. Además, una reseña dejaba ver quién la escribió y sobre qué contrato. Revisando el export de auditoría encontré un path traversal.

1. **Mensajes internos fuera de los 500** (pasan por `sendRouteError`, que lo anota en el log y responde un código fijo):
   - `admin.controller` (12 sitios): estadísticas (antes `details: error.message`), aceptaciones de políticas, registros de auditoría, solicitudes, zonas tensionadas, panel de cumplimiento, eventos del sistema, estadísticas semanales y decisión de una solicitud;
   - `policy.controller`: listar y aceptar dan `policy_list_failed`, `policy_acceptances_failed` y `policy_accept_failed`. Publicar una versión repetida da 409 `policy_version_exists` y una mal formada 400 `invalid_policy` (antes, el texto de Mongo y 400 para todo). «Ya aceptada» y «versión no activa» conservan su mensaje;
   - `taxReport.controller` (informe y exportaciones CSV/PDF; los 400 como `invalid_year` no cambian);
   - `institution.controller` (panel y CSV; `area_not_in_scope` e `invalid_date_range` no cambian);
   - `requireVerified`: el fallo de la consulta de verificación da `verification_check_failed`. Es middleware de casi toda `/api`, así que solo cambié sus `catch`.
2. **Path traversal en `GET /api/admin/compliance/audit-trails/export`** (solo admin, riesgo bajo). Los `contractIds` de la query se pegaban en una ruta de fichero (`storage/contracts-audit/contract_<id>.pdf`). Con `../` se podía meter en el zip cualquier `.pdf` legible del servidor. Ahora un id que no es ObjectId da 400 `invalid_contract_id`. Además, si el zip ya había empezado a salir, el `catch` corta la respuesta en vez de intentar mandar JSON.
3. **`GET /api/reviews/user/:userId`** devolvía las reseñas completas a cualquier usuario verificado, con `fromUserId` y `relatedId` (quién opinó y sobre qué contrato). Ahora devuelve nota, comentario, fecha, rol y el autor como «Laura M.» (`reviewerLabel`, igual que la ficha del profesional). El frontend no la usa.

**Commits.**
- `fdb7321` Opiniones: `GET /api/reviews/user/:userId` sin `fromUserId` ni `relatedId`
- `85a80c6` Seguridad: administración, políticas, informe fiscal, institución y `requireVerified` sin mensaje interno en sus 500; ids de contrato validados en el export de auditoría

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Test nuevo, `tests/security/admin.errors.test.ts`, con 7 casos:
  - estadísticas, aceptaciones y panel de admin dan su código fijo sin el correo del error;
  - `contractIds=../../../package` da 400;
  - políticas: un 500 con código fijo, una versión mal formada da 400 y una repetida 409. Espera a `PolicyVersion.init()`: en la primera ejecución conjunta el índice único aún no existía y salió 201;
  - informe fiscal y CSV dan código fijo, y `year=1900` sigue dando 400;
  - el panel de institución da código fijo;
  - `requireVerified` da `verification_check_failed`;
  - las reseñas de un usuario no llevan ids ni correo.
- Jest `--runInBand` de `tests/admin`, `policies`, `institution`, `reviews`, `security`, `contracts`, `escrow`, `rentalPublic` y `src/__tests__`: 56 suites y 252 tests OK.
- Frontend (sin cambios): `npm --prefix frontend run build` OK y `npm --prefix frontend test` con 40 ficheros y 149 tests OK. Una primera ejecución a la vez que el Jest del backend dio 6 fallos por timeout. Repetida sola, todo pasa.
- GitNexus: `impact` dio riesgo bajo para `PolicyController` y `requireVerified`, aunque el grafo no ve el uso de este como middleware. `detect_changes` marca riesgo «alto» por los 13 flujos de admin, el informe fiscal y la institución que tocan estos controladores. En todos, el cambio está en el `catch` (y en la validación de ids del export).

**Qué queda.**
- Quedan `e.message` en `clauses.controller` (400 con el texto del catálogo), `testingInbound` (desactivado en producción) y `validation.middleware` (400 deliberado). Los de subida son errores de multer, a propósito.
- Muchos `console.error` siguen fuera del logger (contratos, admin).
- `GET /api/reviews/user/:userId/avg` sigue abierto a cualquier verificado. Solo da media y número, igual que el perfil.
- Pendientes anteriores: `/landlord/services` es un marcador (depende de producto); aviso de cobro a la agencia (Jorge); moderación de opiniones (Jorge).

**Siguiente mejora propuesta.** Dos rondas seguidas de backend (47 y 49, con la 48 de interfaz). La 50 debería ser de interfaz. Candidatas: las pantallas de administración (`AdminCompliancePage`, `ComplianceDashboard`, que siguen con clases sueltas tipo `border-gray-300` fuera del sistema 2026), o el paso del inquilino a `/tenant/kyc` desde una invitación de co-titular.

### Ronda 50 — 2026-10-12 07:25

**Qué y por qué.** Ronda de interfaz, como proponía la 49 (dos rondas seguidas de backend). Elegí la ficha pública del anuncio (`/properties/:id`): es la pantalla que más ve un inquilino y ninguna ronda la había tocado. Además del estilo antiguo (degradado azul-índigo en el botón, iconos en círculos grises, verde y azul sueltos), tenía fallos:

- un anuncio inexistente o retirado dejaba el esqueleto de carga para siempre;
- «Compartir» y «Ver todas» no hacían nada;
- con menos de cinco fotos repetía la misma, y sin fotos usaba `via.placeholder.com`;
- «Guardar» salía siempre vacío (el backend no mandaba `_liked`), y tras solicitar el botón seguía igual;
- el mapa tenía encima un botón invisible que abría un `window.confirm` en vez de dejar mover el mapa;
- fechas y precios sin locale («1,450 €», «11/15/2026»), y «0 Habitaciones».

Revisando el backend salieron tres cosas más, y otra en `Modal`.

1. **Backend (`property.controller`).**
   - La ficha y el listado públicos devolvían el documento entero: id del propietario, de la agencia, su tipo de acceso e historial. Ahora solo los ve quien gestiona el inmueble (dueño, agencia o administrador).
   - La ficha añade `_mine`, `_liked` y `_application` (estado, fechas de visita; sin ids) para quien tiene sesión.
   - `POST /:id/apply` admitía solicitudes a borradores y anuncios retirados de otros, con solo saber el id. Ahora da 404. Un id mal formado da 404 en la ficha, la solicitud y la visita (antes, 500 por `CastError`).
   - `POST /:id/view` solo cuenta visitas a anuncios publicados.
2. **Interfaz** (`PropertyDetail`, nuevos `components/property/PropertyGallery` y `utils/propertyDetail`):
   - galería con foto principal y dos laterales, sin repetir, y visor a pantalla completa (portal, flechas, ←/→/Esc, «2 de 5»). Sin fotos, una franja «Este anuncio todavía no tiene fotos»;
   - título en Manrope, dirección, «2 habitaciones · 1 baño · 68 m²» (estudio si no tiene habitaciones);
   - características con marca gris: «Disponible ya» o «Disponible desde el 15 de noviembre de 2026», amueblado, mascotas, planta y ascensor, estado y año si están informados;
   - descripción, mapa con enlace normal «Abrir en Google Maps»;
   - tarjeta de precio (es-ES, fianza en meses: «1 mes (1450 €)») con la acción según quién mira: «Solicitar visita», el estado de tu solicitud con «Ver mis solicitudes», «Es tu anuncio · 87 visitas» con enlace a gestionar, Tenant PRO bloqueado con «Verificar mi solvencia», o «Las visitas se solicitan desde una cuenta de inquilino»;
   - barra fija abajo en móvil con precio y acción;
   - página «Este anuncio ya no está disponible» con «Ver otras viviendas»;
   - los ingresos orientativos de Tenant PRO redondeaban mal (1400 / 0,35 da 4000,0000000000005, así que salía 4001 €).
3. **`Modal`**: cerrado, su efecto ponía `overflow: hidden` en el `body` y escuchaba Escape (el listado y la ficha lo tienen siempre montado por `LoginPrompt`). Abierto, como dependía de `onClose` (una flecha nueva en cada render), devolvía el foco al primer botón en cada pulsación: escribir en un campo de un modal saltaba el foco. Ahora depende de `open`.

**Commits.**
- `583866e` Anuncios: ficha y listado públicos sin datos internos; `_mine`, `_liked` y `_application`; 404 para ids mal formados y anuncios no publicados
- `d9a4d28` Interfaz: la ficha del anuncio pasa al sistema 2026; `Modal` cerrado no bloquea el scroll ni roba el foco

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/properties`, `tests/tenantPro`, `tests/agency` y `src/__tests__/rbac.test.ts`: 10 suites y 58 tests OK. Hay un test nuevo, `tests/properties/property.view.test.ts`, con 3 casos:
  - sin gestionar el inmueble no llegan `owner`, `agencyId`, `refAgencyId`, `agencyAccess` ni `history`, ni en la ficha ni en el listado; el dueño y la agencia sí, con `_mine`;
  - `_liked` y `_application` tras guardar y solicitar;
  - 404 con id mal formado, y al solicitar o sumar visitas a un borrador o un retirado (las visitas no cambian).
- e2e (`npm run test:e2e`): 10/10.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 43 ficheros y 164 tests OK (antes 149). Son nuevos `PropertyDetail.test.tsx` (8 casos: datos en español y anónimo a iniciar sesión, visor, solicitar y guardar, visita concertada, Tenant PRO sin verificar, el dueño, anuncio inexistente y sin fotos), `propertyDetail.test.ts` (5) y `Modal.test.tsx` (2). En una pasada falló por tiempo `TicketCreatePage` (5,3 s), que no usa `Modal`; pasó aislado y en la siguiente suite completa.
- Playwright (vite local, `/api/*` simulado, fotos de la landing) a 1280 y 390 px, en `/tmp/ra-shots50`: anónimo, inquilino con visita, Tenant PRO, propietario, sin fotos, inexistente y el visor. Sin desbordamiento horizontal en ninguna captura. Con ellas corregí tres cosas:
  - el fondo del visor salía transparente (Tailwind 3 no aplica `/95` a `var(...)`), así que ahora usa un portal y un color en línea;
  - el hueco sin fotos era enorme;
  - «Volver a la búsqueda» repetía la miga de pan.
- GitNexus: `impact` dio riesgo bajo en `getById`, `apply`, `PropertyDetail` y `Modal`, aunque el grafo no ve los 6 usos de `Modal` en JSX. `detect_changes` marca «alto» por número de símbolos, pero `suggestPrice` y `listApplications` salen solo por el desplazamiento de líneas (el diff toca `getById`, `search`, `countView` y `apply`).

**Qué queda.**
- `LandlordDashboard` lista los inmuebles del casero con `GET /api/properties?limit=200` y filtra los suyos en el cliente. El servidor da 50 como máximo y mezcla todos los anuncios activos, así que con más de 50 en el mercado el casero deja de ver los suyos en su panel. Hace falta un `GET /api/properties/mine` (o `owner=me`) paginado.
- `PropertyCard` (el listado) sigue con `via.placeholder.com`, `indigo` y precios sin locale.
- La ficha no deja escribir un mensaje al solicitar visita (`Application.message` existe, pero `apply` no lo guarda).
- Dirección exacta visible para todos: anotado en «Para Jorge».
- Pendientes anteriores: `/landlord/services` es un marcador (depende de producto); aviso de cobro a la agencia y moderación de opiniones (Jorge).

**Siguiente mejora propuesta.** El fallo de `LandlordDashboard`: un `GET /api/properties/mine` paginado (dueño o agencia gestora, con borradores) y que el panel lo use, con test de más de 50 anuncios ajenos. De paso, `PropertyCard` al sistema 2026 (precio es-ES y sin imagen de relleno).

### Ronda 51 — 2026-10-12 07:40

**Qué y por qué.** Es la mejora que proponía la ronda 50: un flujo roto del casero. Revisando el código salió además una fuga en favoritos.

1. **El panel del casero perdía sus inmuebles.** `LandlordDashboard` pedía el listado público (`GET /api/properties?limit=200`), el servidor daba 50 como máximo y el panel filtraba los del casero en el cliente. Con más de 50 anuncios activos en el mercado, el casero dejaba de ver los suyos (y sus avisos, contadores y «Mis propiedades»). Ahora:
   - el nuevo `GET /api/properties/mine` (casero, agencia o admin) devuelve los inmuebles de los que eres dueño o agencia, con borradores y retirados. Va paginado hasta 100, con `status` opcional (un valor fuera de `draft|active|archived` da 400) y orden por fecha de alta;
   - `listMyProperties()` en el frontend recorre las páginas (20 como máximo) y el panel lo usa.
2. **Favoritos con datos internos.** `GET /api/properties/favorites` devolvía el documento entero de cada anuncio guardado (propietario, agencia, tipo de acceso, historial), también de anuncios ajenos que su dueño había retirado o devuelto a borrador. Ahora pasa por `toPropertyView`, igual que la ficha, y solo enseña los activos (o los que gestionas).
3. **Tarjeta del listado (`PropertyCard`) al sistema 2026**, la que usan «Buscar pisos» y «Favoritos». Antes:
   - usaba `via.placeholder.com` sin fotos;
   - mostraba el precio sin locale;
   - tenía una etiqueta `indigo` y otra «Alquilado» para un estado que no existe;
   - el corazón no tenía nombre accesible.
   
   Ahora sigue el estilo de Airbnb: foto redondeada (o «Sin fotos todavía»), ciudad, título enlazado, «2 habitaciones · 1 baño · 68 m²» (o «Estudio»), «950 € /mes» y corazón con `aria-label` y `aria-pressed` en el azul de marca. Reutiliza `formatRent` y `propertyFacts` de la ficha. De paso:
   - textos de «Favoritos» con tildes;
   - la miga de pan ya no enlaza `/me`, que no tiene página.

**Commits.**
- `1e0f3d8` Anuncios: `GET /api/properties/mine`; favoritos sin datos internos ni anuncios retirados
- `6e743f8` Interfaz: panel del casero con `/mine`, `PropertyCard` 2026, miga de pan de favoritos

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Nuevo `tests/properties/property.mine.test.ts`, con 2 casos:
  - con 60 anuncios ajenos, `/mine` da los 3 del dueño (con borrador y uno gestionado por agencia) y la agencia ve solo el suyo. También cubre el filtro de estado, la página 2 con `limit=2`, `status[$ne]` (400) y el inquilino (403);
  - favoritos sin `owner`/`agencyId`/`agencyAccess`/`history` y sin el retirado ni el borrador.
  
  El 401 sin token no se puede probar: en test, `ALLOW_TEST_AUTH` autentica las peticiones anónimas como casero.
- Jest `--runInBand`: `tests/properties`, 6 suites y 26 tests OK; `rbac`, `tests/agency` y `tests/tenantPro`, 5 suites y 34 tests OK.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 45 ficheros y 169 tests OK. Son nuevos `PropertyCard.test.tsx` (3) y `listMyProperties.test.ts` (2), y `Breadcrumbs` tiene un caso más (6 en total).
- Playwright (vite local, `/api/*` simulado, fotos de la landing) a 1280 y 390 px, en `/tmp/ra-shots51`: listado, favoritos y panel del casero. Ninguna captura desborda en horizontal, y el panel pide `/api/properties/mine?page=1&limit=100`.
- GitNexus: `impact` dio riesgo bajo en `listMyFavorites`, `LandlordDashboard` y `Breadcrumbs`. `detect_changes` marca «alto» por los 6 flujos del panel del casero, que son justo los que cambian (`refresh`). `getProperty`, `searchProperties` y `favoriteProperty` salen solo por el desplazamiento de líneas.

**Qué queda.**
- El panel pide `/mine` dos veces al cargar, porque `refresh` depende del objeto `user`, que cambia tras `/api/users/me`. Ya pasaba con el listado.
- `pages/Favorites.tsx` (estilos en línea, favoritos en localStorage) no tiene ruta. Es código muerto y se puede borrar.
- La página «Favoritos» sigue con `padding` en línea y un botón gris. Le falta el mismo pase al sistema 2026 que tuvo la ficha.
- La ficha no deja escribir un mensaje al solicitar visita (`apply` no guarda `Application.message`).
- Pendientes anteriores: dirección exacta visible para todos, aviso de cobro a la agencia y moderación de opiniones (Jorge); `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** El mensaje al solicitar visita, de punta a punta: `apply` guarda un `message` acotado y saneado, el casero lo ve en `ApplicantsModal` y la ficha ofrece un campo opcional. Es el primer contacto inquilino-casero, y hoy llega vacío.

### Ronda 52 — 2026-10-12 07:55

**Qué y por qué.** Es la mejora que proponía la ronda 51. La solicitud de visita es el primer contacto entre inquilino y casero, y llegaba siempre vacía: `Application.message` existía y `ApplicantsModal` ya lo enseñaba al casero, pero `apply` no lo guardaba y la ficha no tenía dónde escribirlo.

1. **Backend (`property.controller`).**
   - `POST /api/properties/:id/apply` acepta `message` opcional. Se valida antes de crear nada con `cleanApplicationMessage`: tiene que ser texto (si no, 400 `invalid_message`), se quitan los caracteres de control salvo los saltos de línea, se dejan como mucho dos saltos seguidos y se recorta. Si pasa de 1000 caracteres, da 400 `message_too_long` con `max`. Un mensaje vacío no se guarda.
   - Repetir la solicitud sigue devolviendo la existente y no cambia su mensaje.
   - El inquilino ve su mensaje en la ficha (`_application.message`) y en `GET /api/applications/my`.
   - `GET /api/properties/:id/applications` con un id mal formado da 404 (antes, `CastError`).
2. **Interfaz (`PropertyDetail`).**
   - Para el inquilino con sesión, la tarjeta del precio tiene «Mensaje para el propietario (opcional)», con una sugerencia de qué contar (quién vivirá, a qué se dedica, cuándo entraría), `maxLength` 1000 y contador cuando quedan 200.
   - Tras enviar, la tarjeta enseña «Tu mensaje» (hasta 4 líneas).
   - En móvil, el botón de la barra fija enviaba la solicitud directamente. Ahora lleva al campo y le da el foco, y se envía desde la tarjeta. Sin sesión sigue abriendo el aviso de iniciar sesión.

**Commits.**
- `0360372` Solicitudes: mensaje opcional al solicitar visita, validado y limpio; 404 con id mal formado en las solicitudes del anuncio
- `486d23d` Interfaz: campo de mensaje en la ficha, «Tu mensaje» y la barra fija de móvil lleva al campo

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Nuevo `tests/properties/property.apply.test.ts`, con 4 casos:
  - la limpieza del texto;
  - el casero lee el mensaje, y el inquilino lo ve en la ficha y en `/applications/my`;
  - sin mensaje funciona, un mensaje demasiado largo o que no es texto no crea la solicitud, y repetir no lo cambia;
  - el 404 con id mal formado.
  
  La primera pasada falló porque el inmueble del test no tenía `availableFrom` (obligatorio). Corregido, 4/4.
- Jest `--runInBand` de `tests/properties`, `tests/applications` y `rbac`: 9 suites y 42 tests OK.
- Frontend: `npm --prefix frontend run build` OK (el primer intento falló por el tipo del `ref`, corregido). `npm --prefix frontend test`: 45 ficheros y 171 tests OK. `PropertyDetail.test.tsx` cubre el envío con mensaje y «Tu mensaje», y tiene un caso nuevo: sin texto va vacío, y la barra de móvil lleva al campo sin enviar.
- Playwright (vite local, `/api/*` simulado) a 1280 y 390 px, en `/tmp/ra-shots52`: formulario y solicitud enviada. La petición lleva el mensaje con sus saltos de línea, el foco llega al campo desde la barra de móvil y no hay desbordamiento horizontal.
- GitNexus: `impact` dio riesgo bajo en `apply` y `applyToProperty`. `detect_changes` marca «alto», pero `suggestPrice`, `search` y `getPropertyApplications` salen solo porque el índice es de la copia canónica y no casa las líneas. El diff toca `getById`, `apply`, `listApplications`, `listMyApplications` y `PropertyDetail`.

**Qué queda.**
- «Mis solicitudes» (`pages/tenant/Applications.tsx`) sigue con estilos en línea, «aun» sin tilde, fechas sin locale (`toLocaleString()` sin `es-ES`), botones verde y azul sueltos y errores sin capturar al aceptar o proponer visita. Tampoco enseña el mensaje, que la API ya devuelve.
- El casero no recibe aviso (correo ni notificación) de una solicitud nueva. Solo la ve al abrir el panel.
- Pendientes anteriores: dirección exacta visible para todos, aviso de cobro a la agencia y moderación de opiniones (Jorge); `pages/Favorites.tsx` es código muerto; la página «Favoritos» necesita el pase 2026; `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** «Mis solicitudes» del inquilino al sistema 2026: tarjeta con foto, estado en español, fechas es-ES, «Tu mensaje», acciones con su error (aceptar o proponer fecha sin `try/catch` dejan la promesa rechazada) y test de la página.

### Ronda 53 — 2026-10-12 08:05

**Qué y por qué.** Es la mejora que proponía la ronda 52: «Solicitudes» del inquilino (`/tenant/applications`). Al revisarla salió un fallo de datos más grave que la apariencia:

1. **Hora desplazada en la contrapropuesta del inquilino.** La página mandaba el valor del `datetime-local` sin zona («2026-10-16T18:00») y el servidor, en UTC, lo guardaba 2 h tarde en verano. Es el mismo fallo que la ronda 23 corrigió en el modal del casero. Ahora se manda el instante en ISO.
2. **Backend de visitas (`application.controller`).**
   - Proponer una fecha pasada (con un minuto de margen) da 400 `visit_date_in_past`.
   - Aceptar una propuesta cuya hora ya pasó da 409 `proposed_date_passed`. Antes quedaba una visita «concertada» en el pasado.
   - Una solicitud `rejected` no admite propuestas ni aceptarlas (409 `application_closed`). Antes el inquilino podía reabrirla proponiendo fecha.
   - Un id mal formado da 404 en `propose` y `accept` (antes, 500 por `CastError`).
   - Los tests usaban fechas de octubre de 2026 que ya habían pasado. Ahora son de 2027.
3. **Interfaz (`pages/tenant/Applications.tsx`, nuevo `utils/tenantApplications.ts`).** Antes tenía estilos en línea, «aun» sin tilde y fechas sin locale. Además:
   - pintaba el estado de la solicitud con `ContractStatusBadge`, la pastilla de estados de contrato;
   - tenía botones verde y azul sueltos;
   - aceptar o proponer no capturaban el error (la promesa quedaba rechazada sin aviso);
   - el mensaje no se mostraba.

   Ahora es una lista en tarjeta, como «Contratos»:
   - foto (sin fotos, un hueco gris con el icono de imagen y sin imagen de relleno), título enlazado a la ficha, dirección y «1450 € /mes»;
   - una línea de estado en español: «El propietario te propone visitarlo el jueves, 15 de octubre a las 18:00», «Has propuesto…», «Visita concertada…», «La fecha que te propusieron ya pasó. Propón otra.» o «El propietario ha seguido con otros candidatos»;
   - «Tu mensaje»;
   - acciones según el caso: «Aceptar visita», «Proponer otra fecha» (formulario en la tarjeta, sin fechas pasadas), «Firmar contrato» o «Ver contrato» y «Escribir al propietario». El modal «Detalle de la visita» desaparece, porque repetía lo que ya está en la tarjeta;
   - los errores salen en la tarjeta, en español.
4. **`ApplicantsModal` (casero)**: traduce los tres códigos nuevos y su selector tampoco admite fechas pasadas.

**Commits.**
- `a6cc885` Visitas: fecha pasada 400, propuesta caducada 409, solicitud descartada 409, id mal formado 404
- `4c59cde` Interfaz: «Solicitudes» del inquilino al sistema 2026; la fecha va en ISO y los errores se muestran
- `890d907` Interfaz: el modal de candidatos traduce los códigos nuevos y no admite fechas pasadas

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. `tests/applications/visit-proposal.test.ts` tiene 5 casos nuevos: fecha pasada, id mal formado, solicitud descartada, propuesta caducada y la contrapropuesta del inquilino aceptada por el casero con su hora exacta. Jest `--runInBand` de `tests/applications`, `tests/agency` y `tests/properties`: 10 suites y 60 tests OK.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 46 ficheros y 177 tests OK. El nuevo `pages/tenant/__tests__/Applications.test.tsx` tiene 6 casos:
  - estados y mensaje;
  - propuesta caducada sin «Aceptar»;
  - aceptar y recargar, y el error 409;
  - la propuesta en ISO;
  - fecha pasada sin enviar y el error del servidor;
  - lista vacía y fallo de carga.
  
  Tras el último cambio de `ApplicantsModal`, sus tests, los de `AgencyProperties` y `LandlordDashboard` (3 ficheros, 8 tests) y el build pasan.
- Playwright (vite local, `/api/*` simulado) a 1280 y 390 px, en `/tmp/ra-shots53`: lista con los cinco estados y el formulario de proponer. No hay desbordamiento horizontal. «18:00» del 2 de abril de 2030 se envía como `2030-04-02T16:00:00.000Z` (Madrid, UTC+2).
- GitNexus: `impact` dio riesgo bajo en `proposeVisit`, `acceptProposedVisit` y `TenantApplications`. `detect_changes` da riesgo «medio» por los dos flujos `TenantApplications → ContractStatusBadge`, que son justo los que se quitan a propósito.

**Qué queda.**
- El casero no puede descartar a un candidato (nada pasa una solicitud a `rejected`) ni recibe aviso de una solicitud nueva. Anotado en «Para Jorge» si debe existir.
- Una visita concertada no se puede cambiar desde la página (el backend lo admite, la interfaz no lo ofrece).
- Pendientes anteriores: dirección exacta visible para todos, aviso de cobro a la agencia y moderación de opiniones (Jorge); `pages/Favorites.tsx` es código muerto; la página «Favoritos» necesita el pase 2026; `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** Avisar al casero (o a la agencia gestora) de una solicitud nueva, con un correo que use el sistema de avisos de la ronda 42 y lleve el mensaje del inquilino. Si no hay SMTP, que quede en el log. Hoy solo la ve si abre el panel.

### Ronda 54 — 2026-10-12 08:18

**Qué y por qué.** Es la mejora que proponía la ronda 53. El casero (o su agencia) no se enteraba de una solicitud de visita hasta abrir el panel, y el inquilino tampoco sabía que le habían propuesto fecha: el primer contacto se perdía. Toca el flujo de captación y no está reservado.

1. **Avisos por correo** (nuevo `services/applicationNotice.service.ts`, `notifyApplication(kind, applicationId, actorId)`; plantilla `applicationNoticeEmail` y `visitDateLabel` en `utils/email.ts`):
   - **solicitud nueva** (`POST /api/properties/:id/apply`): al propietario y, si la gestiona, a la agencia (`agencyAccess: 'manage'`; con `status_only` no). Lleva quién la manda, su mensaje, «Tiene la solvencia verificada en RentalApp» si es Tenant PRO y «Ver la solicitud». Repetir la solicitud no vuelve a avisar;
   - **fecha propuesta** (`/propose`) y **visita concertada** (`/accept`), con la fecha en hora de Madrid («jueves, 14 de octubre a las 18:00»). Si actúa el inquilino, avisa al propietario y a la agencia gestora; si actúa el casero, su agencia o un administrador, avisa al inquilino. El inquilino ve el nombre de quien actúa, salvo si es el administrador;
   - se envía después de responder, nunca lanza y, sin SMTP, queda en el log, como los demás avisos. Todo el texto pasa por `escapeHtml`.
2. **Enlace que abre los candidatos.** El correo del casero lleva a `/landlord?solicitudes=<inmueble>` y el de la agencia a `/agency/properties?solicitudes=<inmueble>`. Al cargar, el panel abre `ApplicantsModal` de ese inmueble y quita el parámetro, para que cerrar el modal o recargar no lo vuelva a abrir. Con un inmueble ajeno, o traspasado en el caso de la agencia, no abre nada. El inquilino va a `/tenant/applications`.

**Commits.**
- `3e0cade` Solicitudes: aviso por correo de solicitud nueva, fecha propuesta y visita concertada
- `8e615f2` Interfaz: `?solicitudes=<id>` abre los candidatos en los paneles del casero y de la agencia

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Nuevo `tests/applications/application.notice.test.ts`, 7/7:
  - solicitud nueva al propietario con mensaje, Tenant PRO y enlace; repetirla no avisa;
  - con agencia gestora avisa a los dos, cada uno con su enlace; con `status_only` solo al propietario;
  - casero propone → inquilino; inquilino acepta → casero (fecha exacta);
  - inquilino propone → propietario y agencia; la agencia acepta → inquilino con el nombre de la agencia;
  - una propuesta rechazada (fecha pasada) no avisa;
  - plantilla: escapa nombre y mensaje, fecha en Madrid, sin «solvencia» fuera de la solicitud nueva.
  
  La primera pasada dio 403 en 6 casos porque los usuarios del test no tenían `isVerified` en la base (desde la ronda 17 se lee de ahí). Corregido.
- Jest `--runInBand` de `tests/applications`, `tests/properties`, `tests/agency` y `tests/unit/email*`: 13 suites y 74 tests OK.
- Frontend: `npm --prefix frontend run build` OK. `npm --prefix frontend test`: 46 ficheros y 180 tests OK. Hay dos casos nuevos en `LandlordDashboard.test.tsx` (abre y limpia el parámetro; un inmueble ajeno no abre nada) y uno en `AgencyProperties.test.tsx` (gestionado sí, traspasado no).
- No hice capturas con Playwright: la interfaz no cambia de aspecto, solo abre el modal que ya existía.
- GitNexus: `impact` dio riesgo bajo en `apply`, `proposeVisit`, `acceptProposedVisit` y `LandlordDashboard`. `detect_changes` marca «medio» en el backend (`tensionedAreaDateQuery` y `listMyApplications`, solo por líneas desplazadas, porque el índice es de la copia canónica) y «alto» en el frontend por los flujos del panel del casero. `refresh` es justo el que cambia: ahora marca que los inmuebles han cargado.

**Qué queda.**
- El propietario no se entera cuando su agencia concierta una visita. Lo dejo anotado en «Para Jorge».
- No hay avisos dentro de la app (campana o contador), solo correo. El panel del casero tampoco resalta las solicitudes nuevas desde la última visita.
- Pendientes anteriores: el casero no puede descartar candidatos (Jorge); una visita concertada no se puede cambiar desde «Solicitudes»; `pages/Favorites.tsx` es código muerto; la página «Favoritos» necesita el pase 2026; `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** Hace una ronda que la interfaz solo cambia por dentro. Propongo la página «Favoritos» al sistema 2026 (estilos en línea y botón gris) y borrar `pages/Favorites.tsx`, que es código muerto.


### Ronda 55 — 2026-10-12 10:31

**Qué y por qué.** Era la mejora que proponía la ronda 54: llevar «Favoritos» al sistema 2026, después de una ronda sin cambios en la interfaz. Al revisarla salió un fallo visible:

1. **El inicio del inquilino siempre decía 0 favoritos.** `TenantHome` contaba los favoritos de `localStorage` (`utils/favorites.ts`), pero desde que se guardan en el servidor nada escribe ahí. Ahora los cuenta con `GET /api/properties/favorites`, en paralelo con los contratos. Si ese recuento falla, muestra «–» y los contratos se ven igual. Se borran `pages/Favorites.tsx` (no tenía ruta) y `utils/favorites.ts`.
2. **«Favoritos» (`/me/favorites`) en el sistema 2026.**
   - Recuento en el encabezado («1 piso guardado» o «3 pisos guardados») y la misma rejilla y tarjeta que el listado.
   - Esqueleto mientras carga. Si no hay nada guardado, una tarjeta con «Buscar pisos» (antes salían dos botones y estilos en línea).
   - Si la carga falla, se explica el error y se ofrece «Reintentar». Antes se ignoraba el error y la página decía «Aún no has guardado ningún piso».
   - Quitar un piso muestra «Has quitado «…» de favoritos. Deshacer», que lo vuelve a guardar en el mismo sitio. Si quitarlo falla, el piso vuelve a su sitio y se muestra el error (antes desaparecía igualmente).

**Commits.**
- `d2241b3` Interfaz: el inicio del inquilino cuenta sus favoritos del servidor; se borra el código muerto
- `b682b58` Interfaz: «Favoritos» pasa al sistema 2026

**Verificación (resultados reales).**
- Backend sin cambios.
- Frontend:
  - `npm --prefix frontend run build` OK.
  - `npm --prefix frontend test`: 47 ficheros y 188 tests OK. En la primera pasada, `AppShell.test.tsx` falló por un timeout de la ejecución en paralelo. No lo he tocado: pasó solo y luego en la suite completa.
  - Nuevos: `pages/properties/__tests__/FavoritesPage.test.tsx` (6 tests: recuento, quitar y deshacer, fallo al quitar, error de carga con reintento, vacío). `TenantHome.test.tsx` simula ya el servicio y tiene 2 casos más (recuento del servidor y fallo sin tapar los contratos).
- Playwright con la API simulada (`/tmp/ra-shots55`): lista, quitado con «Deshacer» y vacío, a 1280 y 390 px, sin desbordamiento horizontal.
- GitNexus: `impact` LOW en `TenantHome`, `FavoritesPage` y `getFavorites`. `detect_changes` solo toca `FavoritesPage`, `onFavToggle` y `TenantHome` (y sus flujos, uno de ellos el de `getFavorites` que se sustituye).

**Qué queda.**
- `SkeletonGrid` y `EmptyState` siguen con el estilo antiguo (bordes grises, estilos en línea). Los usan otras páginas.
- La ruta deja entrar a caseros y administradores (`["tenant", "landlord", "admin"]`), pero su menú no enlaza «Favoritos».
- Pendientes anteriores: el casero no puede descartar candidatos y no se entera cuando su agencia concierta una visita (Jorge); una visita concertada no se puede cambiar desde «Solicitudes»; `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** Pasar `EmptyState` y `SkeletonGrid` a los tokens 2026 (los usan el listado y otras páginas) o, con más valor de producto, dejar cambiar una visita ya concertada desde «Solicitudes». El backend ya lo admite y solo falta la interfaz.

### Ronda 56 — 2026-10-12 10:41

**Qué y por qué.** Es la mejora que proponía la ronda 55, la de más valor de producto: un inquilino con una visita concertada no tenía forma de cambiarla desde «Solicitudes». El casero sí podía («Cambiar visita» en «Candidatos»), pero el resultado era confuso:

- la solicitud pasaba a `proposed` y la interfaz olvidaba la visita concertada, aunque `visitDate` seguía en la base;
- el correo decía «te propone visitar…», como si fuera la primera fecha.

1. **Backend.**
   - **Regla del cambio.** Proponer otra hora sobre una visita concertada que aún no ha llegado es un cambio de fecha. La visita concertada (`visitDate`) sigue guardada y en pie hasta que la otra parte acepte la nueva. Al aceptarla, se sustituye.
   - **Misma hora.** Proponer la misma hora que la concertada da 400 `same_visit_date`.
   - **Aviso por correo.** Lleva `previousDate`, con el asunto «Cambio de visita: …» y el texto «propone cambiar la visita del martes, 12 de octubre a las 10:00 al jueves, 14 de octubre a las 18:00. Hasta que se acepte la nueva fecha, sigue en pie la del…».
   - **Visita ya pasada.** Proponer después de una visita que ya pasó no cuenta como cambio.
2. **Interfaz.**
   - **«Solicitudes» del inquilino.** Una visita concertada futura ofrece «Cambiar fecha». El formulario dice «Nueva fecha para la visita» y avisa: «Mientras el propietario no acepte la nueva fecha, sigue en pie la visita el…». Un cambio pendiente enseña las dos fechas: «El propietario propone cambiar la visita al… Mientras no aceptes, sigue en pie la del…», o «Has pedido cambiar…». Si la nueva fecha caduca, vuelve a «Visita concertada el…». Una visita ya pasada no se puede cambiar.
   - **«Candidatos» (casero y agencia).** Muestra «El candidato propone cambiar la visita del 20 mar 2030, 17:30 al 22 mar 2030, 10:00».
   - **Ficha del anuncio.** Muestra «Te proponen cambiar la visita» o «Has pedido cambiar la visita», con la fecha que sigue en pie.
   - `same_visit_date` se traduce en las dos pantallas.

**Commits.**
- `37935a3` Visitas: cambio de fecha sobre una visita concertada, `same_visit_date` y aviso con la fecha anterior
- `8f0198d` Interfaz: «Cambiar fecha» en «Solicitudes» y las dos fechas de un cambio pendiente

**Verificación (resultados reales).**
- **Backend.**
  - `npx tsc --noEmit`: sin errores.
  - Jest `--runInBand` de `tests/applications`: 2 suites y 20 tests OK.
  - En `visit-proposal.test.ts` hay 2 casos nuevos: la misma hora da 400, cambiar deja `visitDate` hasta aceptar y aceptar sustituye; tras una visita pasada se propone sin restricción.
  - En `application.notice.test.ts` hay 2 casos nuevos: el aviso lleva `previousDate`, y no lo lleva tras una visita pasada. La plantilla comprueba el asunto y el texto del cambio.
- **Frontend.**
  - `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 47 ficheros y 191 tests OK.
  - Casos nuevos: 2 en `Applications.test.tsx` (cambiar con el error `same_visit_date` y el envío en ISO; cambios pendientes de las dos partes y visita pasada sin «Cambiar fecha») y 1 en `ApplicantsModal.test.tsx`.
- **Playwright** (vite local, `/api/*` simulado), a 1280 y 390 px, capturas en `/tmp/ra-shots56`: formulario de cambio y cambio pendiente. No hay desbordamiento horizontal. «18:00» del 2 de abril de 2030 se envía como `2030-04-02T16:00:00.000Z`.
- **GitNexus.**
  - `impact`: `proposeVisit` LOW. Los símbolos del frontend y de la plantilla no están en el índice, que es de la copia canónica. Con grep, solo los usan `Applications.tsx` y el servicio de avisos.
  - `detect_changes`: riesgo «medio», solo por `ApplicantsModal` y `TenantApplications`, que son los que cambian.

**Qué queda.**
- No hay forma de cancelar una visita sin proponer otra fecha, ni de retirar un cambio que has pedido. Va anotado en «Para Jorge» con la regla del cambio.
- Al aceptar un cambio, el correo dice «ha aceptado la visita… el…», sin mencionar que sustituye a la anterior.
- `SkeletonGrid` y `EmptyState` siguen con el estilo antiguo.
- Pendientes anteriores: el casero no puede descartar candidatos y no se entera cuando su agencia concierta una visita (Jorge); `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** Pasar `EmptyState` y `SkeletonGrid` a los tokens 2026. Son componentes compartidos del listado y otras páginas, y son lo último con bordes grises y estilos en línea del recorrido del inquilino.


### Ronda 57 — 2026-10-12 10:55

**Qué y por qué.** La ronda 56 proponía pasar `EmptyState` y `SkeletonGrid` al sistema 2026. Al revisar dónde se usan, el listado de pisos (`/properties`, la página pública más importante) tenía tres fallos:

1. **«Borrar filtros» no borraba nada.** Ni el botón del vacío ni el del embudo de `FilterBar` funcionaban: los dos llamaban a `setFilters({})`, que mezcla con los filtros actuales y solo vuelve a la página 1. Además, la barra guarda su propio estado y no se enteraba cuando cambiaba la URL. Ahora:
   - `usePropertyFilters` tiene `clearFilters`, que vacía la URL;
   - `FilterBar` recibe `onClear` y se vuelve a montar con la URL (`key={search}`), así que también se pone al día al ir atrás o adelante.
2. **Guardar un piso que falla.** El corazón se quedaba marcado sin guardarse. Ahora se deshace y avisa «No se pudo actualizar tus guardados», como en la ficha.
3. **Quitar un piso de guardados.** `_liked` se calculaba con `|| it._liked`. El listado nunca lo manda, así que no tenía efecto, pero si lo mandara el corazón no se podría vaciar. Se quita.

**Apariencia.**
- `EmptyState`, `SkeletonGrid`, `SkeletonDetail` y `ErrorCard` pasan a los tokens `--ra-*` y dejan los estilos en línea.
- El esqueleto del listado copia la rejilla y la foto 4:3 de `PropertyCard`. El de la ficha copia su maqueta: galería, texto y tarjeta de precio. Los dos llevan `role="status"` con «Cargando…» para lectores de pantalla, y no se animan si se pide movimiento reducido.
- **Listado.**
  - Título h1 «Viviendas en alquiler» y recuento en es-ES («24 viviendas disponibles»).
  - El vacío distingue «No hay viviendas con esos filtros» (con «Borrar filtros») de «Todavía no hay viviendas publicadas».
  - Un fallo de carga dice «No se pudo cargar el listado. Comprueba tu conexión…» con «Reintentar». Antes salía el mensaje de axios en inglés y no se podía reintentar.
  - La paginación usa los botones del sistema.
- «Favoritos» usa `EmptyState`.
- El vacío de «Mensajes» lleva tildes y vale para todos los roles.
- Se borra `ui/Skeleton.tsx`, que nadie importaba.

**Commits.**
- `041dc4a` Interfaz: componentes de vacío, carga y error al sistema 2026
- `9802038` Interfaz: «Borrar filtros» funciona, el corazón se deshace si falla y estados del listado

**Verificación (resultados reales).**
- **Backend:** sin cambios.
- **Frontend.**
  - `tsc --noEmit` del frontend: sin errores.
  - `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 48 ficheros y 199 tests OK.
  - Nuevo `pages/properties/__tests__/PropertiesList.test.tsx`, con 8 tests:
    - recuento y detección de filtros;
    - listado;
    - «Borrar filtros» desde el vacío y desde el embudo (la URL queda vacía y el campo «Ciudad» también);
    - vacío sin filtros;
    - error en español con reintento;
    - fallo al guardar, que deshace el corazón y avisa;
    - quitar un guardado.
- **Playwright** (vite local, `/api/*` simulado), a 1280 y 390 px, capturas en `/tmp/ra-shots57`:
  - carga del listado y de la ficha, vacío con filtros, error y listado;
  - no hay desbordamiento horizontal;
  - tras pulsar «Borrar filtros», la URL queda `/properties`.
  - El error tarda unos segundos en salir porque el `QueryClient` de la app reintenta antes de rendirse.
- **GitNexus.**
  - `impact`: `usePropertyFilters` y `FilterBar`, LOW.
  - `detect_changes` (staged): riesgo bajo, sin flujos afectados.

**Qué queda.**
- `FilterBar` sigue con el estilo antiguo:
  - índigo en las pastillas y el foco;
  - los campos «Hab+» y «Baño+» son tan estrechos que el texto de ejemplo se corta («Bañc»);
  - el orden dice «Precio: Bajo a Alto».
- `setFilters` llama a `setSp` y a `navigate` a la vez, así que cada búsqueda podría dejar dos entradas en el historial. No lo he comprobado.
- Pendientes anteriores: el casero no puede descartar candidatos y no se entera cuando su agencia concierta una visita (Jorge); `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** Pasar `FilterBar` al sistema 2026: campos de habitaciones y baños legibles, pastillas con `--ra-blue` en vez de índigo y orden «Más baratos primero». De paso, comprobar el doble paso por el historial de `setFilters` y dejar una sola navegación.

### Ronda 58 — 2026-10-12 11:10

**Qué y por qué.** La ronda 57 proponía pasar `FilterBar` al sistema 2026 y comprobar el doble paso por el historial. Al revisarlo aparecieron cuatro fallos en la búsqueda, que es el flujo público más usado:

1. **Apagar un interruptor filtraba al revés.** Al desmarcar «Amueblado», «Mascotas» o «Solo Tenant PRO» la barra guardaba `false`, la URL llevaba `furnished=false` y el backend buscaba solo pisos sin amueblar (o sin mascotas, o sin el requisito PRO). Ahora el interruptor apagado es `undefined` y `setFilters` descarta `false`.
2. **Doble entrada en el historial.** `setFilters` llamaba a `setSearchParams` y a `navigate` con la misma búsqueda, así que «atrás» había que pulsarlo dos veces. Queda solo `setSearchParams`, también en `clearFilters`. El test nuevo falla con el hook anterior (comprobado).
3. **«Populares» ordenaba por fecha.** El frontend mandaba `sort=views`, que el backend no admite (el campo es `viewsCount`) y cambiaba por `createdAt`. Ahora `viewsCount` está en `SORTABLE_FIELDS` y la opción se llama «Más vistos».
4. **La ciudad tenía que coincidir letra a letra.** `?city=madrid` no encontraba «Madrid». Ahora es una regex anclada (`^…$`), escapada y sin distinguir mayúsculas: ciudad entera, sin mayúsculas, y `.*` se busca como texto.

**Apariencia (`FilterBar`).**
- Es un `<form role="search">`: Enter busca.
- Etiquetas visibles («Buscar», «Ciudad», «Precio mín. (€/mes)»…) en vez de solo placeholders, con `useId` porque hay dos barras montadas (escritorio y cajón móvil).
- Habitaciones y baños son selectores («Cualquiera», «2 o más»). Antes eran campos de 44 px que cortaban «Baño+».
- Tokens `--ra-*`: borde `--ra-line`, foco y pastilla activa en `--ra-blue` (antes índigo), «Buscar» en azul.
- Orden: «Más recientes», «Más baratos», «Más caros», «Más vistos».
- «Borrar filtros» con texto en vez de un icono rojo.
- En escritorio, «Buscar» va en la fila principal; en móvil, al final del formulario.

**Commits.**
- `5f5bcc6` Búsqueda: ciudad sin distinguir mayúsculas y orden por visitas
- `3bc355e` Interfaz: barra de filtros 2026, interruptores, historial y orden

**Verificación (resultados reales).**
- **Backend.**
  - `npx tsc --noEmit`: sin errores.
  - `npx jest tests/properties/property.routes.test.ts tests/security/mongoOperators.test.ts --runInBand`: 2 suites y 16 tests OK. Hay 2 casos nuevos: ciudad en minúsculas y con espacios sí, «Coru» y `.*` no; orden por `viewsCount` en los dos sentidos.
- **Frontend.**
  - `tsc --noEmit`: sin errores.
  - `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 48 ficheros y 202 tests OK.
  - `PropertiesList.test.tsx` pasa de 8 a 11 tests: Enter y una sola entrada en el historial, interruptor apagado sin `false`, orden «Más vistos» con `viewsCount`.
- **Playwright** (vite local, `/api/*` simulado), a 1280 y 390 px, capturas en `/tmp/ra-shots58`:
  - sin desbordamiento horizontal;
  - Enter en «Ciudad» busca;
  - apagar «Amueblado» lo quita de la petición;
  - un solo «atrás» vuelve a `?furnished=true&roomsMin=2`;
  - la barra cabe en dos filas a 1280 px.
- **GitNexus.**
  - `impact`: `search` y `usePropertyFilters`, LOW.
  - `detect_changes`: riesgo medio, solo por el flujo `Search`, que es el que cambia. `unfavorite` sale por el desplazamiento de líneas frente al índice de la copia canónica.

**Qué queda.**
- La ciudad sigue distinguiendo tildes («A Coruna» no encuentra «A Coruña»). La regex con `i` no usa el índice `{city:1, price:1}`; con pocos miles de anuncios no importa, pero con volumen convendría guardar la ciudad normalizada.
- `PropertiesList` aún filtra `onlyTenantPro` en el cliente después de paginar. Es redundante, porque el backend ya lo filtra.
- En móvil, a 390 px, la cabecera pública parte «Crear cuenta» en dos líneas (`NavBar`, anterior a esta ronda).
- Pendientes anteriores: el casero no puede descartar candidatos y no se entera cuando su agencia concierta una visita (Jorge); `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** Cabecera pública en móvil: que «Entrar» y «Crear cuenta» quepan a 390 px sin partirse (botones compactos o «Crear cuenta» dentro del menú). De paso, quitar el filtro `onlyTenantPro` redundante de `PropertiesList`.

### Ronda 59 — 2026-10-12 11:32

**Qué y por qué.** La ronda 58 proponía arreglar la cabecera en el móvil y quitar el filtro `onlyTenantPro` redundante del listado. Al mirarlo, había dos cabeceras con problemas distintos:

1. **`AppShell` (listado, ficha y resto de la app) sin sesión.** «Crear cuenta» llevaba `hidden sm:inline-flex ra-button`. `.ra-button` se define después de las utilidades de Tailwind y su `display: inline-flex` pisaba el `hidden`, así que el botón nunca se ocultaba y a 390 px se partía en dos líneas (62 px de alto). Ahora:
   - el botón lleva la clase `ra-app-register`, que se oculta por debajo de 640 px;
   - el menú lateral del móvil acaba en «Crear cuenta» cuando no hay sesión.
2. **`PublicLayout` (inicio, legales, `/info/:segment`).** Por debajo de 980 px desaparecía la navegación y por debajo de 680 px también «Entrar»: en el móvil solo quedaban el logo y «Crear cuenta», sin forma de entrar ni de llegar a «Viviendas» desde la cabecera. Ahora:
   - «Entrar» se ve siempre;
   - por debajo de 980 px hay un botón de menú, como en `AppShell`, con Viviendas, Producto y Para quién;
   - en el móvil, «Crear cuenta» pasa a ese menú como botón a todo lo ancho;
   - el menú se cierra al navegar (también con atrás o adelante) y con Escape, y lleva `aria-expanded` y `aria-controls`.
3. **«Mi Cuenta» de la cabecera pública iba siempre a `/tenant`.** Para un casero o una agencia, `RoleGuard` lo rebotaba a su inicio. Ahora va directo al de cada rol y se escribe «Mi cuenta». El mapa de inicios estaba copiado cuatro veces (`RoleGuard`, `RedirectHome`, `AppShell` y el `homeFor` de `RegisterPage`, que se queda porque solo cubre los tres roles de registro). Las tres primeras usan ya `utils/roleHome.ts`.
4. **Listado.** `PropertiesList` volvía a filtrar `onlyTenantPro` en el navegador después de paginar. El servidor ya lo filtra, así que sobraba, y podía dejar páginas más cortas que el recuento. Se quita.

**Commits.**
- `3c30477` Interfaz: cabeceras en el móvil, menú público y «Mi cuenta» por rol
- `4f3ad4b` Interfaz: el listado deja de filtrar Tenant PRO en el navegador

**Verificación (resultados reales).**
- **Backend:** sin cambios.
- **Frontend.**
  - `tsc --noEmit`: sin errores.
  - `npm --prefix frontend run build`: OK.
  - `npx vitest run` (la suite completa): 49 ficheros y 206 tests OK. La primera pasada de `npm test`, lanzada junto con el build, dio 1 fallo en 206. Al repetirla salió todo en verde y no he podido reproducirlo; parece un tiempo de espera intermitente.
  - Nuevo `layout/__tests__/PublicLayout.test.tsx`, con 4 tests:
    - enlaces sin sesión;
    - el menú abre, se cierra al navegar y con Escape;
    - «Mi cuenta» de un casero va a `/landlord`;
    - `roleHome` con su respaldo.
- **Playwright** (vite local, `/api/*` simulado), capturas en `/tmp/ra-shots59`:
  - **`/legal/terminos` a 1280, 820, 390 y 320 px:** sin desbordamiento horizontal. «Entrar» se ve en todos los anchos. El menú aparece por debajo de 980 px y «Viviendas» lleva a `/properties` y cierra el menú.
  - **`/properties` sin sesión:**
    - a 390 y 320 px, la cabecera queda en menú, logo y «Entrar», todos de 38 px de alto o menos (antes, «Crear cuenta» medía 62 px);
    - a 700 px se ve «Crear cuenta» en una línea;
    - el menú lateral termina en «Crear cuenta», que lleva a `/register`.
  - Hubo que reiniciar vite con `--force`: la primera tanda de capturas del listado salió con el CSS anterior.
- **GitNexus.**
  - `impact`: `RoleGuard` y `PublicLayout`, LOW.
  - `detect_changes`: riesgo medio, solo por `Header` de `AppShell` (flujos `AppShell → ListConversations/UseAuth`), que es el que cambia.

**Qué queda.**
- En el menú lateral sin sesión salen «Mensajes» y «Asistente», que piden cuenta: llevan al login.
- `RegisterPage.homeFor` no usa `roleHome`. Solo registra tres roles y no hace falta, pero se podría unificar.
- La ciudad sigue distinguiendo tildes (ronda 58).
- Pendientes anteriores: el casero no puede descartar candidatos y no se entera cuando su agencia concierta una visita (Jorge); `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** Menú lateral sin sesión: cambiar «Mensajes» y «Asistente», que piden cuenta, por «Entrar» y una línea que explique qué se gana con la cuenta. Después, buscar ciudades sin distinguir tildes («A Coruna» → «A Coruña»), con un campo normalizado en el modelo y su índice.

### Ronda 60 — 2026-10-12 11:50

**Qué y por qué.** Las dos mejoras que proponía la ronda 59:

1. **Buscar sin distinguir tildes.** «A Coruna» no encontraba «A Coruña», ni «avila» encontraba «Ávila». Con el teclado del móvil o con prisa es muy habitual escribir sin tildes, y el resultado era «No hay viviendas con esos filtros» aunque las hubiera. Ahora:
   - el nuevo `src/utils/searchRegex.ts` (`accentInsensitivePattern`) convierte cada vocal, la «n» y la «c» en su clase con variantes (`[aáàâäã…]`, `[nñ]`, `[cç]`) y el apóstrofo recto vale también por el tipográfico (`L’Hospitalet`). El resto del texto se escapa igual que antes, así que sigue sin admitir operadores de regex;
   - lo usan el filtro de ciudad (sigue siendo la ciudad entera), el texto libre `q` (título, ciudad y dirección) y los comparables por ciudad del precio sugerido (`rentSuggestion.service`);
   - no necesita migración ni campo nuevo: funciona con los datos que ya hay. Descarté guardar la ciudad normalizada con su índice porque la regex con `i` ya no usaba el índice `{city:1, price:1}`; con el volumen actual no hace falta.
2. **Menú lateral sin sesión.** En escritorio y en el móvil salían «Mensajes» y «Asistente», que solo llevaban al login. Ahora, sin sesión, el menú tiene «Buscar pisos» y debajo una línea que explica qué da la cuenta («Con una cuenta guardas pisos, pides visitas y hablas con el propietario.») con «Crear cuenta» y «Entrar». El botón suelto «Crear cuenta» del menú móvil (ronda 59) pasa a ese bloque.

**Commits.**
- `ff20106` Búsqueda: ciudad y texto sin distinguir tildes; también los comparables del precio sugerido
- `67ec861` Interfaz: menú lateral sin sesión con «Crear cuenta» y «Entrar» en vez de Mensajes y Asistente

**Verificación (resultados reales).**
- **Backend.**
  - `npx tsc --noEmit`: sin errores.
  - `npx jest tests/properties/property.routes.test.ts tests/security/mongoOperators.test.ts --runInBand`: 2 suites y 17 tests OK. Caso nuevo: «a coruna», «A CORUNA», «avila», «ÁVILA», «àvila», «l'hospitalet de llobregat» y `q=coruna` encuentran su piso; «evila» no.
  - `npx jest tests/unit/searchRegex.test.ts tests/unit/rentSuggestion.test.ts tests/properties/property.referenceImport.test.ts --runInBand`: 3 suites y 15 tests OK (el de `searchRegex` es nuevo: tildes, ç, apóstrofo, `.*`, `(a+)+` y `[`).
- **Frontend.**
  - `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 49 ficheros y 207 tests OK. `AppShell.test.tsx` pasa de 2 a 3: sin sesión no hay «Mensajes» ni «Asistente», «Crear cuenta» va a `/register`, «Entrar» a `/login` y no se consultan conversaciones.
- **Playwright** (vite local, `/api/*` simulado), capturas en `/tmp/ra-shots60`, a 390 y 1280 px: ningún enlace a Mensajes o Asistente, sin desbordamiento horizontal, «Entrar» del menú lleva a `/login`.
- **GitNexus.**
  - `impact`: `search`, LOW. `NavSections` no está en el índice (es local de `AppShell`; solo lo usan `SideNav` y `MobileNav`).
  - `detect_changes`: riesgo medio, solo por los flujos de `AppShell`, que es lo que cambia.

**Qué queda.**
- En escritorio sin sesión, «Entrar» y «Crear cuenta» salen dos veces (cabecera y lateral). Se podría dejar el lateral solo con la explicación, pero en el móvil sí hace falta el bloque completo.
- La búsqueda no reconoce otras grafías (`l·l` catalana, guiones frente a espacios: «Sant Cugat del Vallès» vs. «Sant-Cugat»).
- `ticket.routes.ts` conserva su propio `escapeRegExp`; podría usar `utils/searchRegex`.
- Pendientes anteriores: el casero no puede descartar candidatos y no se entera cuando su agencia concierta una visita (Jorge); `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** Repasar el flujo del inquilino sin sesión desde la ficha: qué ve al pulsar «Solicitar visita» o el corazón (¿le lleva al login y vuelve a la ficha después?). Si el retorno se pierde, guardar la ruta de origen y volver a ella tras entrar o registrarse.

### Ronda 61 — 2026-10-12 12:04

**Qué y por qué.** La mejora que proponía la ronda 60: el inquilino sin sesión que quiere guardar un piso o pedir visita. Al repasar el flujo encontré esto:

- **El aviso no dejaba registrarse.** Al pulsar el corazón o «Solicitar visita» salía un «Inicia sesión» genérico («Para usar esta función debes iniciar sesión») con estilos en línea anteriores al sistema 2026. Solo tenía «Ir a iniciar sesión», así que quien aún no tenía cuenta, que es casi todo el que llega a una ficha, no tenía forma directa de crearla. Ahora el aviso dice para qué hace falta la cuenta:
  - «Guarda este piso»: «…los tienes a mano en «Favoritos»»;
  - «Pide una visita»: «…Al terminar vuelves a este anuncio».
  
  Tiene tres salidas: «Crear cuenta» (azul), «Ya tengo cuenta» y «Ahora no». En el móvil los botones ocupan el ancho entero.
- **La cabecera y el menú lateral perdían la página.** «Entrar» y «Crear cuenta» llevaban a `/login` y `/register` sin vuelta: quien entraba desde una ficha o una búsqueda con filtros acababa en el inicio de su rol. El nuevo `utils/authLinks.ts` (`authHref`, `returnPath`) añade `?redirect=` con la ruta, la consulta y el ancla. Desde `/` y desde las propias pantallas de acceso deja el enlace limpio. Lo usan `LoginPrompt`, la cabecera de `AppShell` y el bloque sin sesión del menú lateral. El login, el registro y Google/Apple ya respetaban `redirect` (con `safeInternalPath`).
- **Las rutas protegidas perdían la consulta.** `ProtectedRoute` recordaba solo el `pathname`: un enlace de un correo como `/contracts/<id>?deposit=success` volvía sin `?deposit=success` tras entrar. Ahora recuerda también la consulta y el ancla.
- **«Crea una gratis» perdía la vuelta.** En el login, el enlace solo pasaba la vuelta si venía en `?redirect=`, no cuando se llegaba redirigido desde una ruta protegida (`state.from`). Ahora la pasa siempre que haya a dónde volver.

Descarté guardar el mensaje de la solicitud antes del login: el campo solo aparece con sesión, así que no hay borrador que perder.

**Commits.**
- `612180c` Interfaz: aviso sin sesión con motivo y «Crear cuenta», y vuelta a la página de origen al entrar o registrarse

**Verificación (resultados reales).**
- **Frontend.**
  - `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`:
    - primera pasada: 1 fallo en `TicketCreatePage.test.tsx`, que no he tocado. Es el fallo intermitente por tiempo de espera que ya salió en la ronda 59;
    - ese fichero aislado: 4/4 OK;
    - segunda pasada completa: 53 ficheros y 214 tests OK.
  - Tests nuevos:
    - `utils/__tests__/authLinks.test.ts` (2): vuelta con consulta y ancla; sin vuelta desde `/`, `/login`, `/register`, `/forgot-password`, `/reset` y `/auth/callback`;
    - `components/__tests__/LoginPrompt.test.tsx` (2): textos por motivo, enlaces con `redirect` y «Ahora no» cierra;
    - `components/__tests__/ProtectedRoute.test.tsx` (1): `state.from` conserva `?deposit=success#pagos`;
    - `pages/auth/__tests__/LoginPage.redirect.test.tsx` (2): «Crea una gratis» con y sin origen.
  - Tests actualizados: `AppShell.test.tsx` (enlaces con `redirect` a `/properties?city=Madrid`) y `PropertyDetail.test.tsx` (aviso «Pide una visita» con vuelta a `/properties/p1`).
  - Backend sin cambios: no hacía falta `tsc` ni Jest.
- **Playwright** (vite local, `/api/*` simulado), capturas en `/tmp/ra-shots61`, a 390 y 1280 px. En la ficha sin sesión:
  - «Guardar» abre «Guarda este piso» y «Solicitar visita» abre «Pide una visita»;
  - no hay desbordamiento horizontal;
  - «Ya tengo cuenta» lleva a `/login?redirect=%2Fproperties%2Fp1`;
  - tras entrar con el login simulado, vuelve a `/properties/p1`.
- **GitNexus.**
  - `impact`: `LoginPrompt`, `ProtectedRoute` y `PropertyDetail`, LOW.
  - `detect_changes`: riesgo medio, solo por los flujos de `AppShell` (`Header` y `SideNav`), que son los que cambian.

**Qué queda.**
- Tras entrar desde «Guardar», el piso no se guarda solo: hay que pulsar el corazón otra vez. Se podría pasar la intención en la vuelta (`?intent=save`) y completarla al cargar la ficha.
- `RoleGuard` sigue mandando a `/login` sin vuelta. Hoy no importa, porque siempre va dentro de `ProtectedRoute`.
- La cabecera pública (`PublicLayout`: inicio, legales, `/info`) sigue sin vuelta, a propósito: ahí no hay nada a lo que volver.
- El componente `Modal` sigue con estilos en línea (cabecera y radio de 12 px); el contenido del aviso ya usa los tokens 2026.
- Pendientes anteriores: el casero no puede descartar candidatos y no se entera cuando su agencia concierta una visita (Jorge); `/landlord/services` es un marcador; `ticket.routes.ts` conserva su propio `escapeRegExp`.

**Siguiente mejora propuesta.** Completar la intención tras entrar: si el inquilino pulsó «Guardar» sin sesión, guardar el piso al volver a la ficha (y avisar con un toast). Si pulsó «Solicitar visita», llevarle al campo del mensaje. Después, pasar `Modal` a los tokens 2026 (lo usan todos los diálogos).

### Ronda 62 — 2026-10-12 12:26

**Qué y por qué.** Ronda de interfaz. Retoma lo que proponía la ronda 61:

1. **Completar lo que se pidió sin sesión.** Tras entrar o registrarse desde el aviso de la ficha, había que volver a pulsar el corazón. Ahora la vuelta lleva `?intent=save|apply` (nuevo `withIntent` en `utils/authLinks`), y la ficha lo completa una sola vez y lo quita de la URL:
   - **«Guardar»:** guarda el piso y avisa «Guardado en Favoritos». No lo hace si el piso ya estaba guardado, si el anuncio es suyo o si el rol no tiene favoritos (agencia o profesional; son los mismos roles que admite el backend);
   - **«Solicitar visita»:** lleva el foco al campo del mensaje. No envía nada.

   El aviso dice qué pasará al volver («Al terminar vuelves aquí con el piso ya guardado»). Para eso `LoginPrompt` tiene la propiedad nueva `resume`. El listado no la usa: no sabe qué piso era, así que solo vuelve a la búsqueda.
2. **`Modal` al sistema 2026.** Lo usan todos los diálogos: aviso de cuenta, candidatos, pago, alta de inmueble y firma. Tenía estilos en línea:
   - panel blanco de 20 px con `--ra-shadow` sobre un fondo azul marino, título `h2` en Manrope y botón «Cerrar»;
   - el diálogo toma el nombre del título (`aria-labelledby`); antes usaba `aria-label` y, sin título, se llamaba «Modal»;
   - en el móvil se abre como hoja inferior, y el cuerpo tiene su propio scroll;
   - **fallo corregido:** el `width: 520` en línea anulaba el `className` de quien llama, así que el diálogo de firma del contrato (`max-w-6xl h-[85vh]`) se quedaba en 520 px. Ahora los estilos base van en `@layer components` y las utilidades de Tailwind mandan;
   - el foco inicial va al contenido (el campo o la acción principal), no a «Cerrar».
3. **Avisos (`ToastProvider`).** Salían en verde chillón con estilos en línea y sin `z-index`. En el móvil quedaban debajo de la barra fija de la ficha, como se ve en la captura de la primera pasada. Cambios:
   - tinta oscura con icono, y rojo para los errores;
   - botón «Cerrar aviso»;
   - `role="status"` o `alert` y `aria-live`;
   - por encima de diálogos y barras: abajo a la izquierda en escritorio y arriba en el móvil;
   - los errores duran 6 s;
   - **fallo corregido:** el id salía de `Date.now()`, así que dos avisos en el mismo milisegundo compartían id y se cerraban juntos. Ahora es un contador. `push` es estable (`useCallback`).

**Commits.**
- `36252d5` Interfaz: tras entrar desde el aviso de la ficha, el piso queda guardado o el foco va al mensaje
- `5ff9441` Interfaz: Modal y avisos al sistema 2026

**Verificación (resultados reales).**
- **Backend:** sin cambios, no hacía falta `tsc` ni Jest.
- **Frontend.**
  - `tsc --noEmit`: sin errores.
  - `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 54 ficheros y 222 tests OK, a la primera.
  - Tests nuevos:
    - `PropertyDetail.test.tsx`, 3 casos: `?intent=save` guarda una vez, avisa y limpia la URL conservando `?from=list`; no guarda si ya estaba guardado ni con el rol agencia; `?intent=apply` enfoca el mensaje sin enviar nada;
    - `LoginPrompt.test.tsx`: con y sin `resume`;
    - `authLinks.test.ts`: `withIntent` conserva la consulta y no repite `intent`;
    - `Modal.test.tsx`: nombre por el título, «Cerrar», clic en el fondo, `className` en el panel y foco en el contenido;
    - nuevo `context/__tests__/ToastContext.test.tsx` (2): dos avisos seguidos conviven y se cierran por separado; el error es `alert` y dura más.
- **Playwright** (vite local, `/api/*` simulado), capturas en `/tmp/ra-shots62`, a 390 y 1280 px. Flujo: ficha sin sesión → «Guardar» → «Ya tengo cuenta» → `/login?redirect=%2Fproperties%2Fp1%3Fintent%3Dsave` → entrar → `/properties/p1`.
  - Resultado: un solo `POST …/favorite`, el botón dice «Guardado» y sale el aviso «Guardado en Favoritos», arriba en el móvil y abajo a la izquierda en escritorio. Sin desbordamiento horizontal. El diálogo mide 520 px en escritorio y ocupa el ancho entero en el móvil.
  - La primera tanda salió con el código anterior: vite no recogió los cambios hasta reiniciarlo.
- **GitNexus.**
  - `impact`: `Modal` y `PropertyDetail`, LOW.
  - `detect_changes`: riesgo bajo, sin flujos afectados.

**Qué queda.**
- Siguen conviviendo dos sistemas de avisos: `react-hot-toast` en `TenantProPanel`, `CopyLinkButton` y `AdminAuditDashboard`, frente a `ToastProvider` en el resto. Basta con pasar esos tres a `useToast` y quitar `<Toaster/>` de `index.tsx`.
- El corazón del listado sin sesión no se guarda solo al volver. Haría falta pasar el id del piso en la intención (`intent=save:<id>`).
- `PaymentModal` sigue con su «Error de Configuración» y «Realizar Pago» (mayúsculas a la inglesa).
- Pendientes anteriores: el casero no puede descartar candidatos y no se entera cuando su agencia concierta una visita (Jorge); `/landlord/services` es un marcador; `ticket.routes.ts` conserva su propio `escapeRegExp`.

**Siguiente mejora propuesta.** Unificar los avisos en `ToastProvider` (los tres usos de `react-hot-toast` y quitar la dependencia) y repasar los textos de `PaymentModal`. Si se prefiere volver al backend: limitar los comparables del precio sugerido (`rentSuggestion.service.ts`, sin `limit`; pendiente en `auditoria-mejoras`).

### Ronda 63 — 2026-10-12 15:25

**Qué y por qué.** Ronda de backend, tras seis rondas seguidas de interfaz. Dos pendientes de `docs/auditoria-mejoras-2026-10-05.md`:

1. **La purga RGPD de Tenant PRO no se ejecutaba nunca.** `purgeOldTenantProDocs` estaba importada en `app.ts` pero nadie la llamaba. Las nóminas, contratos y declaraciones de renta se guardaban cifrados para siempre, aunque la política de privacidad dice que «caduca y se elimina» y la pantalla de Tenant PRO muestra `ttlDays`. Además, la función tenía fallos que habrían salido al programarla:
   - cargaba en memoria todos los usuarios con algún documento, caducado o no;
   - hacía `save()` del usuario entero: un usuario antiguo que no pasara la validación actual, o un cambio concurrente del inquilino, podía fallar o pisarse; y un fallo en uno abortaba el `Promise.all` de todos;
   - `deleteTP` lanzaba si el borrado fallaba y unía la ruta sin limitarla al directorio.

   Ahora:
   - `startTenantProRetentionJob` la programa cada día a las 03:45, junto a los demás jobs (no en tests);
   - recorre con cursor solo los usuarios con algún documento vencido, borra primero el fichero (si falla la base, el siguiente pase lo reintenta; al revés quedaría un fichero huérfano que nadie borraría) y después quita el documento con `$pull` y añade la entrada a `auditTrail` con `$push`, sin tocar el resto del usuario;
   - un usuario que falla queda en el log y no detiene a los demás; devuelve `{users, docs, failed}`, que se registra con pino;
   - `tenantProDocsTtlDays()` lee la variable en cada pase y vuelve a 365 si no es un número positivo; la usa también `GET /api/tenant-pro/me`, que antes hacía su propio `parseInt`;
   - `deleteTP` solo borra por nombre dentro de `storage/tenant-pro` (`path.basename`) y no falla si el fichero ya no está. Lo usan también el borrado del propio inquilino y la purga del administrador.
2. **Comparables del precio sugerido sin límite.** `findOwnComparables` traía todos los anuncios activos de la ciudad (o del radio) en cada sugerencia. Ahora toma los 300 más recientes (`updatedAt`), que además reflejan mejor el precio actual. Con menos de 300 no cambia nada.

**Commits.**
- `03212fe` Tenant PRO: la purga de documentos caducados se programa cada día
- `6458f79` Precio sugerido: los comparables se limitan a los 300 anuncios más recientes

**Verificación (resultados reales).**
- **Backend.**
  - `npx tsc --noEmit`: sin errores.
  - `npx jest tests/tenantPro --runInBand`: 2 suites y 8 tests OK. Casos nuevos: con un documento vencido y otro reciente solo se borra el vencido (fichero y entrada), queda la entrada de `auditTrail` con tipo, hash y estado, el estado `verified` se mantiene, un fichero que ya no existe no rompe la purga y un segundo pase no hace nada; `TENANT_PRO_DOCS_TTL_DAYS=abc` usa 365 y `30` purga a los 40 días; `deleteTP('../keep-me.txt')` no sale del directorio.
  - `npx jest tests/properties/rentSuggestion.comparables.test.ts tests/properties/property.referenceImport.test.ts tests/unit/rentSuggestion.test.ts --runInBand`: 3 suites y 14 tests OK. El nuevo crea 300 anuncios recientes a 20 €/m² y 40 antiguos a 10 €/m²: la muestra es 300 y la base, 20 €/m².
- **Frontend:** sin cambios, no hacía falta build ni tests.
- **GitNexus.**
  - `impact`: `purgeOldTenantProDocs`, `deleteTP` y `findOwnComparables`, LOW.
  - `detect_changes` (contra `ca840e9`): riesgo medio, solo por el flujo `SuggestPrice`, que es el que cambia.
- La sesión se cortó a mitad de la ronda (cuota); al retomar, el límite de comparables estaba editado sin test ni commit, y se completó.

**Qué queda.**
- Los jobs se ejecutan en cada réplica (auditoría de mejoras). Con una sola instancia no importa.
- Al purgar no se avisa al inquilino de que su documentación ha caducado ni se le pide que la renueve; su estado verificado se mantiene sin documentos detrás. ¿Debe caducar también la verificación? Es decisión de producto; no la he tomado.
- Pendientes anteriores: unificar los avisos (`react-hot-toast` en tres sitios) y los textos de `PaymentModal`; el casero no puede descartar candidatos (Jorge); `/landlord/services` es un marcador.

**Siguiente mejora propuesta.** Unificar los avisos en `ToastProvider` (los tres usos de `react-hot-toast`, quitar `<Toaster/>` y la dependencia) y repasar los textos de `PaymentModal` («Error de Configuración», «Realizar Pago»).

### Ronda 64 — 2026-10-12 15:35

**Qué y por qué.** Ronda de interfaz: lo que proponían las rondas 62 y 63.

1. **Un solo sistema de avisos.** `TenantProPanel`, `CopyLinkButton` y la auditoría de firmas (`AdminAuditDashboard`) seguían con `react-hot-toast`: sus avisos salían arriba a la derecha, con otro estilo y sin `role`/`aria-live`, mientras el resto de la app usa `ToastProvider`. Ahora los tres usan `useToast`, y se quitan `<Toaster/>` de `index.tsx` y la dependencia. El progreso del ZIP de auditoría, que era un aviso fijo con estilos en línea, va en el propio botón («Exportando ZIP… 42 %», desactivado mientras dura).
2. **Diálogo de pago con tarjeta (`PaymentModal` + `CheckoutForm`).** Es el paso donde el inquilino paga la renta y el propietario aprueba un presupuesto, y era la pantalla más descuidada:
   - antes: «Error de Configuración» y «Falta la clave pública de Stripe (VITE_STRIPE_KEY)» al usuario; importe `1250.00 €`; campo de tarjeta con Inter y colores de la demo de Stripe, y textos de Stripe en inglés («Card number»); «Pagos seguros encriptados por Stripe»; caja azul para la descripción;
   - ahora: concepto e importe arriba (Manrope, cifras tabulares), campo «Tarjeta» con DM Sans y los colores de los tokens, Stripe Elements en español (`locale: 'es'`), botón `.ra-button-blue` «Pagar 1250,00 €», error como `role="alert"` y nota «Pago procesado por Stripe. RentalApp no guarda los datos de tu tarjeta». Sin clave: «Los pagos con tarjeta no están disponibles ahora mismo. Inténtalo más tarde; no se te ha cobrado nada»; la variable solo se nombra en desarrollo;
   - **fallo de texto corregido:** en «Pagos» el diálogo se titulaba siempre «Pagar renta», también al pagar la fianza. Ahora es «Pagar recibo» y dice qué se paga («Renta de octubre de 2026», «Fianza»), con el mismo `paymentTitle` de la lista.

**Commits.**
- `0b8cb26` Interfaz: un solo sistema de avisos
- `9f9a9ad` Interfaz: diálogo de pago con tarjeta al sistema 2026

**Verificación (resultados reales).**
- **Backend:** sin cambios.
- **Frontend.**
  - `tsc --noEmit`: sin errores. `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 56 ficheros y 227 tests OK (antes del último retoque, `locale: 'es'` y el concepto en «Pagos»; después, tsc, build y las 6 suites afectadas, 25 tests, OK).
  - Tests nuevos: `payments/__tests__/PaymentModal.test.tsx` (3: sin clave no habla de configuración ni ofrece pagar; concepto e importe `850,50 €` y paga con el `clientSecret`; un rechazo sale como alerta y no llama a `onSuccess`); `components/__tests__/CopyLinkButton.test.tsx` (2: aviso `status` al copiar y `alert` si falla el portapapeles).
- **Playwright** (vite local con `VITE_STRIPE_KEY=pk_test_dummy`, `/api/*` simulado), capturas en `/tmp/ra-shots64`, 390 y 1280 px: «Pagos» → «Pagar ahora» abre «Pagar recibo» con «Renta de octubre de 2026», «1250,00 €», «Número de tarjeta MM / AA CVC» y «Pagar 1250,00 €»; hoja inferior en el móvil, sin desbordamiento horizontal. La primera tanda salió con «Card number»: vite no recogió `locale` hasta reiniciarlo.
- **GitNexus.** `impact`: `PaymentModal` y `CheckoutForm`, LOW. `detect_changes`: riesgo medio, solo por los flujos de `Payments` (`GetPayments`, `PayReceipt`), que son los que cambian.

**Qué queda.**
- `CopyLinkButton`, la página de auditoría y `ui/Button` siguen con estilos antiguos (borde gris, `var(--primary)`); `Button` lo usan muchas pantallas y conviene pasarlo a `.ra-button` con cuidado.
- `CheckoutForm` sin `clientSecret` llama a `POST /api/payments/create-intent`; hoy los dos usos pasan el secreto, pero esa ruta conviene revisarla con el rediseño del escrow (P5, Jorge).
- El corazón del listado sin sesión no se guarda solo al volver (`intent=save:<id>`).
- Pendientes anteriores: el casero no puede descartar candidatos (Jorge); `/landlord/services` es un marcador; `ticket.routes.ts` conserva su propio `escapeRegExp`.

**Siguiente mejora propuesta.** Pasar `ui/Button` a las clases 2026 (`.ra-button` y variantes), revisando una a una las pantallas que lo usan con capturas. Si toca backend: unificar `ticket.routes.ts` con `utils/searchRegex`.

### Ronda 65 — 2026-10-12 15:55

**Qué y por qué.** Ronda de interfaz: lo que proponía la ronda 64 (`ui/Button`). Al revisar con capturas las pantallas que lo usan salió algo más grave, la página «Ingresos» con datos inventados, y entró en el lote.

1. **`ui/Button` al sistema 2026.** Lo usan 14 pantallas (panel del casero, alta de inmueble, asistente de contrato, candidatos, incidencias, perfil…). Tenía estilos en línea con `var(--primary)` (índigo de la plantilla antigua), radio de 8 px y borde gris, y no seguía la marca. Además, como los estilos iban en línea, las clases de quien llama no mandaban. Ahora:
   - clases `.ra-btn*` en `@layer components` (píldora, DM Sans 600): primario `--ra-blue`, secundario blanco con borde `--ra-line`, fantasma y peligro; `outline` es alias de secundario. Foco visible con anillo azul y desactivado al 50 % sin cambio al pasar el ratón. Sin la elevación ni la sombra de los botones de la landing, que en una app se ven de más;
   - `type="button"` por defecto: dentro de un `<form>` ya no lo envía sin querer (los que envían ya decían `type="submit"`);
   - `buttonClassName()` para dar aspecto de botón a un `<Link>` sin anidar un `<button>` en un enlace;
   - **fallos de paso:** «Crear propiedad» llevaba `bg-green-600` que nunca se veía (lo tapaba el estilo en línea) y con el cambio se habría vuelto verde: quitado. Los iconos de «Atrás/Siguiente» tenían `mr-2`/`ml-2` además del `gap`. «Borrar» del panel del casero llevaba el color en línea y, si el `DELETE` fallaba, la promesa se rechazaba sin aviso; ahora sale un aviso de error;
   - **código muerto quitado:** `pages/Login.tsx` (el login real es `pages/auth/LoginPage`), `pages/TenantDashboard.tsx` y `components/dashboard/ActiveContractWidget.tsx`. Nadie los importaba; los dos últimos solo se referían entre sí y anidaban `<button>` dentro de `<Link>`.
2. **«Ingresos» (`/earnings`) sin datos inventados.** La ruta está viva para el casero (solo se llega por URL; el `AppLayout` que la enlazaba tampoco se usa). Enseñaba:
   - «Actividad reciente» con tres «Cobro de Alquiler +850 €, hace 2/3/4 días» fijos, iguales para cualquier casero;
   - «Rentabilidad media ~5.4 %», escrita a mano;
   - «100 % cobrado» en verde aunque el mes fuera 0 €, y un «Ver todo el historial» que no hacía nada;
   - si la llamada fallaba, 0 € como si no hubiera cobros; la gráfica omitía los meses sin cobros, y las etiquetas eran «10/2026».

   Ahora solo muestra lo que da el backend: «Total cobrado», «Este mes» y «Cobros» (formato `es-ES`), la gráfica de los seis últimos meses con los meses vacíos a cero («sept 2026») y el importe accesible por mes, y «Ver cobros y recibos» → `/landlord/payments`. Si la carga falla: alerta y «Reintentar»; si falla el CSV, aviso. Sin degradado ni sombra azul. La miga de pan dice «Ingresos» en vez de «earnings».

**Commits.**
- `9b36427` Interfaz: ui/Button al sistema 2026
- `92872fa` Interfaz: «Ingresos» (/earnings) sin datos inventados

**Verificación (resultados reales).**
- **Backend:** sin cambios.
- **Frontend.**
  - `tsc --noEmit`: sin errores. `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 58 ficheros y 235 tests OK (antes 57/230 con el botón; después del cambio de «Ingresos», suite completa otra vez).
  - Tests nuevos: `components/ui/Button.test.tsx` (3: `type="button"` por defecto no envía el formulario y `submit` sí; clases sin `style` y conserva el `className`; `buttonClassName`); `pages/__tests__/Earnings.test.tsx` (5: solo datos del backend, sin «850», «5.4» ni «100 % cobrado», seis meses y enlace a cobros; vacío explicado; error con «Reintentar» que recarga; `lastSixMonths` rellena con 0 al cruzar de año; `monthLabel`).
- **Playwright** (vite local, `/api/*` simulado), capturas en `/tmp/ra-shots65`, a 390 y 1280 px: panel del casero con un borrador y un publicado (píldoras «Publicar» azul desactivado, «Editar» y «Solicitudes» blancos, «Borrar» en rojo, anillo de foco en «Editar»); «Ingresos» con 5 meses de cobros y septiembre vacío. Sin desbordamiento horizontal. Vite no recogía los cambios hasta reiniciarlo con `--force` (como en las rondas 62 y 64).
- **GitNexus.** `impact` de `Button`: LOW (no sigue el JSX; los 17 ficheros que lo importan se revisaron a mano). `detect_changes`: riesgo medio, solo por los flujos de `LandlordDashboard`, donde está «Borrar».

**Qué queda.**
- «Ingresos» no está en el menú del casero; ¿debe estar, junto a «Pagos»? La ruta admite `admin`, pero el backend solo `landlord`: el administrador ve el error. Ahora al menos lo dice.
- `components/AppLayout.tsx` parece también código muerto (solo se nombra a sí mismo); no lo he quitado en esta ronda.
- `ui/Card` sigue con estilos en línea (`var(--card)`, radio 12) y lo usan muchas pantallas; es el siguiente candidato natural.
- Pendientes anteriores: `CopyLinkButton` con borde gris; el corazón del listado sin sesión no se guarda solo al volver; el casero no puede descartar candidatos (Jorge); `/landlord/services` es un marcador; `ticket.routes.ts` conserva su propio `escapeRegExp`.

**Siguiente mejora propuesta.** Pasar `ui/Card` a clases 2026 (como `Button`: `@layer components`, sin estilos en línea) y quitar `AppLayout.tsx` si se confirma muerto. Si toca backend: unificar `ticket.routes.ts` con `utils/searchRegex`.

### Ronda 66 — 2026-10-12 16:05

**Qué y por qué.** Ronda de interfaz, siguiendo la propuesta de la ronda 65 (`ui/Card` y `AppLayout`). Al revisarlo apareció algo con más alcance: los tokens de la plantilla antigua.

1. **Tokens antiguos con los valores 2026.** Quince pantallas (Inicio y Pagos del inquilino, Incidencias, alta de avería, panel y perfil del profesional, asistente de contrato…) construyen sus botones con `bg-[var(--primary)]`. Ese token seguía siendo el índigo `#4f46e5` de la plantilla, así que la acción principal salía en un azul distinto del de la marca. En lugar de tocar quince ficheros, `:root` asigna a `--primary`, `--primary-hover`, `--border`, `--muted`, `--fg` y `--bg` los valores de `--ra-*`: azul `#4368ff`, línea fina y tinta 2026.
   - El anillo de foco global (`button:focus, a:focus`) era índigo y salía en cada clic de ratón. Ahora es `:focus-visible`, en azul de marca.
   - Se quita el bloque `html[data-theme='dark']`: nada fija ya `data-theme` (ver punto 3).
2. **`ui/Card` al sistema 2026.** Lo usan 22 ficheros. Tenía estilos en línea (`var(--card)`, radio 12) que no dejaban mandar a las clases de quien llama. Ahora es `.ra-card` en `@layer components`: blanco, borde `--ra-line` y radio 16. `style` se sigue pasando si alguien lo da. El `border border-gray-200` duplicado de `OnboardingChecklist` desaparece.
3. **Código muerto.** Se quitan `ThemeContext`, `NavBar` (con su botón 🌙 de tema), `Layout`, `AppLayout`, `Footer` y `pages/common/Placeholder` y `AutoPlaceholder`. Solo se nombraban entre sí o, en el caso de `ThemeProvider`, en `App.test.tsx`. La política de cookies decía que guardamos `theme` en `localStorage` («tema claro u oscuro») y la sesión en `token, user`. Nada escribe `theme`, y la sesión va solo en `user`, así que se corrige el texto (es un dato técnico, no un cambio legal).
4. **Documentación.** En `auditoria-mejoras-2026-10-05.md` seguía como pendiente «el backend no avisa al propietario cuando se crea un ticket», pero ya se hizo en la ronda 36 (`2f1ff22`). Queda marcado como hecho.

**Commits.**
- `7ed6463` Interfaz: ui/Card y tokens antiguos al sistema 2026 (incluye quitar el bloque del tema oscuro de `index.css`)
- `7e0d904` Limpieza: fuera el tema oscuro y los layouts antiguos que nadie usaba
- Docs: este registro y la nota de la auditoría

**Verificación (resultados reales).**
- **Backend:** sin cambios.
- **Frontend.**
  - `tsc --noEmit`: sin errores. `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 235 tests OK con todos los cambios salvo el test nuevo. Después se pasaron el test nuevo y `App.test.tsx`: 2 ficheros y 3 tests OK.
  - Test nuevo: `components/ui/Card.test.tsx` (2 casos: `ra-card` más el `className` de quien llama, sin `style`; sin `className`, solo `ra-card`).
- **Playwright** (vite local con `--force`, `/api/*` simulado), capturas en `/tmp/ra-shots66`, a 390 y 1280 px, de `/tenant`, `/tickets` y `/landlord`:
  - las tarjetas miden 16 px de radio con borde `rgba(11,16,37,.12)`;
  - el único color de fondo de acción es `rgb(67,104,255)`, sin rastro del índigo `79,70,229`;
  - sin desbordamiento horizontal.
  - `/pro` no pintó tarjetas con la sesión simulada (no se investigó).
- **GitNexus.** `impact` de `Card` y `ThemeProvider`: LOW, aunque GitNexus no sigue el JSX; los usos se revisaron con grep. `detect_changes`: riesgo bajo y ningún flujo afectado.

**Qué queda.**
- Las pantallas siguen con botones `rounded-lg` propios en constantes locales (`primaryButton`, `secondaryButton` en TenantHome, Payments, TicketsList…). Ya tienen el color de marca, pero no la píldora de `ui/Button`. Pasarlas a `buttonClassName()` sería coherente, de pantalla en pantalla.
- `ui/Input`, `Select`, `Badge`, `Alert`, `Pagination` y `Drawer` siguen con estilos en línea (radio 8). Sus colores ya salen de los tokens corregidos.
- En `index.css` quedan clases de la plantilla que quizá nadie usa (`.navbar`, `.login-wrapper`, `.btn-form`, `.social-icons`…). Conviene comprobarlo con grep antes de borrarlas.
- Pendientes anteriores: «Ingresos» fuera del menú del casero; el corazón del listado sin sesión no se guarda solo al volver; el casero no puede descartar candidatos (Jorge); `/landlord/services` es un marcador; `ticket.routes.ts` conserva su propio `escapeRegExp`.

**Siguiente mejora propuesta.** Toca backend, tras tres rondas de interfaz: unificar `ticket.routes.ts` con `utils/searchRegex` y repasar `npm audit` de la raíz (4 avisos altos), actualizando solo lo que no rompa. Si se sigue con la interfaz: pasar `ui/Input` y `Select` a clases 2026 y quitar el CSS muerto de la plantilla.

### Ronda 67 — 2026-10-12 17:00

**Qué y por qué.** Tras tres rondas de interfaz, toca backend y seguridad, como proponía la ronda 66. `npm audit` de la raíz ya no daba 4 avisos sino 49 (3 críticos), varios en dependencias que se ejecutan en producción.

1. **Dependencias sin vulnerabilidades en producción.**
   - `npm audit fix` sin `--force` sube `express` 4.22.2 → `body-parser`/`qs` 6.16 (DoS), `proxy-addr` 2.0.8 (crítico: suplantación de IP con IPv6 mapeado; la app usa `trust proxy`, aunque con número de saltos y no por subred), `axios` 1.20 (vía twilio) y `shell-quote` (vía `concurrently`, solo desarrollo).
   - `nodemailer` 9.0.3 → 10.1.0: siete avisos altos sin arreglo en la rama 9, entre ellos envío a un dominio del atacante saltándose la lista de dominios y DoS del analizador de direcciones. El changelog de la 10 solo rompe por exigir Node 20; producción y Docker usan Node 20. Se comprobó que `require('nodemailer').createTransport` sigue existiendo con la importación por defecto de `src/utils/email.ts` y que envía un correo de prueba con `jsonTransport`.
   - **Fallo de paso:** `overrides` fijaba `brace-expansion` en 5.0.9 para todo el árbol. Esa versión es vulnerable y además imponía la API nueva a `minimatch` 3, que fallaba con `TypeError: expand is not a function` en cuanto un patrón llevaba llaves (`**/*.{ts,js}`). Se quita el override. Ahora cada `minimatch` usa la versión que pide (1.1.21 y 2.1.7, sin avisos). `archiver` (exportación ZIP de la auditoría) sigue generando ZIP con `glob`.
   - Frontend: `axios` 1.20, `react-router`/`react-router-dom` 7.17 → 7.18.4 y `postcss` 8.5.29.
   - Resultado: `npm audit --omit=dev` de la raíz da **0 vulnerabilidades** (antes 49 en total; ahora 36, todas de desarrollo). En el frontend, de 18 se pasa a 10: quedan Tailwind 3 (solo al compilar; el arreglo es Tailwind 4) y vitest 4 → 5.
2. **Búsqueda de incidencias sin distinguir tildes.** `ticket.routes.ts` tenía su propio `escapeRegExp` y buscaba el título tal cual: «salon» no encontraba «Enchufe del salón», aunque la búsqueda por servicio sí ignoraba tildes. Ahora usa `accentInsensitivePattern` de `utils/searchRegex`, que también escapa el texto. No quedan más copias de `escapeRegExp` en `src`.

**Commits.**
- `52e0779` Dependencias: 0 vulnerabilidades en producción
- `d652249` Incidencias: la búsqueda por título no distingue tildes
- Docs: este registro

**Verificación (resultados reales).**
- **Backend.**
  - `npx tsc --noEmit`: sin errores.
  - Jest `--runInBand` de toda la suite (97 ficheros). En un solo proceso, tras 69 suites que pasaron, Node se quedó sin memoria (montón de 2 GB, `FATAL ERROR: Reached heap limit`), con la máquina a carga 120-146 por otros procesos. Las 28 restantes, más `ticket.list` otra vez con el test nuevo, en una segunda tanda: 29 suites y 98 tests OK. En total, las 97 suites pasan.
  - Test nuevo en `tests/escrow/ticket.list.test.ts`: «salon» y «SALÓN» encuentran «Enchufe del salón (2)»; el test de `(2)` como texto sigue pasando.
- **Frontend.**
  - `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 236 de 237 OK. Falló `AppShell.test.tsx` por timeout de 5 s; repetido solo, pasa en 1,6 s (era la carga de la máquina, no react-router).
- **GitNexus.** El índice es del repo canónico y no tiene `buildListFilter`, así que el impacto se revisó con grep: un solo uso, `listMine`. `detect_changes`: riesgo bajo, sin flujos afectados.

**Qué queda.**
- Avisos de desarrollo con salto mayor: Jest 29 → 30 (con `@types/jest` y `ts-jest`), vitest 4 → 5, Tailwind 3 → 4 (reescribe la configuración; no es un lote pequeño) y `ts-node-dev`, sin arreglo (se podría cambiar por `tsx watch`).
- La suite del backend en un solo proceso agota 2 GB de memoria. Conviene `workerIdleMemoryLimit` en `jest.config` o `--logHeapUsage` para encontrar la fuga; CI la ejecuta de otra forma y no lo ha notado.
- Pendientes anteriores: «Ingresos» fuera del menú del casero; el corazón del listado sin sesión no se guarda solo al volver; el casero no puede descartar candidatos (Jorge); `/landlord/services` es un marcador; `ui/Input` y `Select` con estilos en línea y CSS muerto de la plantilla en `index.css`.

**Siguiente mejora propuesta.** Cambiar `ts-node-dev` por `tsx watch` en `npm run dev` (quita el último aviso alto sin arreglo) y poner `workerIdleMemoryLimit` en `jest.config` para que la suite completa termine en un solo comando. Si se vuelve a la interfaz: `ui/Input` y `Select` a clases 2026 y fuera el CSS muerto de la plantilla.

### Ronda 68 — 2026-10-12 17:30

**Qué y por qué.** Ronda de herramientas, la que proponía la ronda 67. Son señales que mentían o fallaban sin motivo: un lint que siempre salía en verde, un servidor de desarrollo con avisos altos sin arreglo, una suite del backend que no terminaba en un solo comando y un test del frontend con timeouts falsos.

1. **Lint real en el frontend** (production-readiness 37). `npm --prefix frontend run lint` era `echo 'Lint pendiente'`. Ahora es `tsc --noEmit -p tsconfig.test.json`, que comprueba los tipos de todo `src`, tests incluidos. El `build` solo comprobaba el código de la app. CI lo ejecuta antes de los tests. Escondía 18 errores:
   - `{ virtual: true }` de Jest en `vi.mock`, en 4 ficheros (vitest no tiene ese argumento);
   - `vi.mocked(api, { partial: false })` → `vi.mocked(api, true)`;
   - `applyAccept` iba en el argumento de `eventInit` de `userEvent.upload` (v13). Ahora va en el de opciones;
   - **un fallo de tipos real:** `usePolicyAcceptance` declaraba `pendingPolicy` y `activeVersion` como no nulos, aunque sin políticas pendientes valen `null`. Los tres usos (pagos de casero y admin, `PolicyModal`) ya usaban `?.`, así que no cambia nada en pantalla.
2. **`npm run dev` con `tsx watch`** en lugar de `ts-node-dev`. Este no tiene arreglo para sus avisos altos (chokidar 2/braces) y no se mantiene. El proyecto no usa decoradores, que es lo único que tsx no admite. `tsx` no comprueba tipos: para eso está `npx tsc --noEmit`, que también corre en CI. Avisos de desarrollo: de 36 a 34. En producción siguen en 0.
3. **Suite del backend en un solo comando.** Con `--runInBand`, Node agotaba 2 GB hacia la suite 70. `jest.config.js` lleva ahora `workerIdleMemoryLimit: '1GB'`, y el nuevo `npm run test:backend:serial` (`--maxWorkers=1 --forceExit`) ejecuta las suites de una en una en un worker que se reinicia al pasar de 1 GB. Con `--runInBand` el límite no se aplica (Jest corre en el propio proceso). CI sigue igual.
4. **Timeout de vitest a 15 s** (antes 5 s). `AppShell` falló por tiempo en la suite completa en las rondas 67 y 68; solo pasa en 4 s.

**Commits.**
- `8d82700` Frontend: «npm run lint» deja de ser un echo
- `0ae7209` Backend: «npm run dev» usa tsx watch
- `380a27f` Frontend: tiempo máximo por test de 15 s en vitest
- `8a4fde5` Tests del backend: «npm run test:backend:serial»
- Docs: este registro y la fila 37 de `production-readiness-2026-10-01.md` (pasa a «local»)

**Verificación (resultados reales).**
- **Backend.**
  - `npx tsc --noEmit`: sin errores.
  - `npx tsx watch src/app.ts` arranca: carga todos los módulos y programa los jobs, y se queda esperando a Mongo (aquí no hay ninguno).
  - Suite completa con `--maxWorkers=1 --workerIdleMemoryLimit=1GB`: **97 suites en un solo comando, sin quedarse sin memoria**. Tardó 17 min 56 s, con la máquina a carga 110-150. Resultado: 458 de 459 tests OK.
  - El que falló es `signature.security` («rejects untrusted requests… (aaaa…)»): 401 donde esperaba 400. Solo, pasa (8/8), y también dos veces junto a las suites que le precedían. No lo pude reproducir, y la ronda no toca código del backend. Las rutas `/signature/webhook` y `/:id/signature/callback` pasan por `authenticate`, y el test depende del atajo `ALLOW_TEST_AUTH`; un 401 indica que ese atajo no estaba activo en ese momento.
  - `npx jest --showConfig` confirma `workerIdleMemoryLimit: 1000000000`.
- **Frontend.**
  - `npm --prefix frontend run lint`: sin errores. `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: 236 de 237 OK. El fallo fue `AppShell` por timeout de 5 s, con la suite del backend corriendo a la vez. Solo, pasa; con el límite nuevo, `src/layout` da 7/7. Los 7 ficheros de test tocados dan 27/27.
- **GitNexus.** `detect_changes` contra `10f8e8f`: riesgo medio, solo por `usePolicyAcceptance` (flujos `AdminPayments`, `LandlordPayments` y `PolicyModal` → `CheckPolicy`). Es un cambio solo de tipos.

**Qué queda.**
- `signature.security` intermitente en la suite completa: conviene que `afterEach` no sustituya `process.env` entero (restaurar solo las variables que toca) y ver si otra suite deja `ALLOW_TEST_AUTH` o `NODE_ENV` cambiados.
- El frontend sigue sin ESLint (sin reglas de hooks ni imports sin usar). `tsc` es la comprobación mínima honesta.
- Avisos de desarrollo con salto mayor: Jest 30, vitest 5 y Tailwind 4.
- Pendientes anteriores: «Ingresos» fuera del menú del casero; el corazón del listado sin sesión no se guarda solo al volver; el casero no puede descartar candidatos (Jorge); `/landlord/services` es un marcador; `ui/Input` y `Select` con estilos en línea; CSS muerto de la plantilla en `index.css`.

**Siguiente mejora propuesta.** Volver a la interfaz: `ui/Input` y `Select` a clases 2026 (`@layer components`, sin estilos en línea), revisados con capturas, y quitar el CSS muerto de la plantilla en `index.css`. Si toca backend: hacer determinista `signature.security` (restaurar solo las variables de entorno que toca).

### Ronda 69 — 2026-10-12 17:43

**Qué y por qué.** Vuelta a la interfaz, como proponía la ronda 68, más el test intermitente que esa ronda dejó anotado.

1. **`signature.security` determinista.** En la suite completa de la ronda 68 dio una vez 401 donde esperaba 400. Dos de las rutas que prueba (`/signature/webhook` y `/:id/signature/callback`) pasan por `authenticate`. Por eso el 400 del HMAC solo llega si el atajo de test `ALLOW_TEST_AUTH` está activo, y el test no lo fijaba: además, en `afterEach` sustituía `process.env` entero por una copia tomada al cargar el fichero. Ahora `beforeEach` fija `NODE_ENV=test` y `ALLOW_TEST_AUTH=true`, y `afterEach` restaura solo las seis variables que toca. La causa exacta del 401 no se pudo reproducir; el test ya no depende del entorno heredado. De paso queda a la vista que esas dos rutas exigen sesión en producción (nota en «Para Jorge»).
2. **`ui/Input` y `ui/Select` al sistema 2026.** Como `Button` y `Card`: sin estilos en línea, con `.ra-field` (etiqueta que envuelve) y `.ra-input` en `@layer components`. El campo tiene radio 12, 44 px de alto, borde fino en tinta al 18 %, foco azul de marca con halo suave, desactivado en gris papel y 16 px en móvil, para que iOS no amplíe al enfocar. El desplegable lleva una flecha propia. Nueva prop `containerClassName` para el contenedor; `className` sigue yendo al campo.
   - **Fallo de maquetación:** en el presupuesto del profesional (`TicketDetail`), `w-24` iba al `<input>` y no a la etiqueta que lo envuelve (con `width: 100%`). El importe se llevaba media fila y la nota la otra media. Ahora el importe mide `w-28` y la nota ocupa el resto.
   - **Accesibilidad:** en el perfil, «Especialidad principal» y «Sobre ti» tenían un `<label>` sin asociar a su campo (y estilos índigo `rounded-md`). Ahora son `Select` y `.ra-field`, y el lector de pantalla los anuncia.
   - `Select` no lo usaba nadie. Ahora lo usan la duración del asistente de contrato (antes imitaba el componente con estilos en línea) y la especialidad del perfil. Los desplegables en línea del asistente (mascotas, días de margen) usan `ra-input w-auto` en vez de `auth-input`.
   - La fecha de la cita del profesional pasa de `<input>` suelto a `Input`. En el perfil sobran las clases de desactivado propias: lo da `.ra-input:disabled`.
3. **CSS muerto de la plantilla.** Se quitan de `index.css` 182 líneas de clases que nada usa: `.navbar`, `.nav-*`, `.login-wrapper` (con su degradado morado), `.login-container`, `.btn-form`, `.input-box`, `.social-icons`, `.card-media`, `.grid-cards`, `.grid-detail`, `.auth-brand-icon`, `.auth-legal`… También `src/style.css`, que nadie importaba. Se comprobó con grep en `src` e `index.html`. `.auth-social-apple` se queda porque `SocialAuthButtons` compone la clase con el proveedor; `form p[style]` también se queda.

**Commits.**
- `f441d2f` Tests: signature.security fija NODE_ENV y ALLOW_TEST_AUTH
- `07e158d` Interfaz: ui/Input y ui/Select al sistema 2026
- `143b294` Limpieza: fuera 182 líneas de CSS de la plantilla y src/style.css
- Docs: este registro y la nota en «Para Jorge»

**Verificación (resultados reales).**
- **Backend:** solo cambia un test. `npx jest tests/contracts/signature.security.test.ts --runInBand`: 8/8 OK.
- **Frontend.**
  - `npm --prefix frontend run lint`: sin errores. `npm --prefix frontend run build`: OK (también después del commit de limpieza).
  - `npm --prefix frontend test`: **60 ficheros y 240 tests OK**, sin timeouts.
  - Test nuevo `components/ui/Input.test.tsx` (3 casos): etiqueta asociada, clases `ra-input`/`ra-field` más las de quien llama, sin `style`; sin etiqueta no pinta el texto vacío; `Select` conserva valor y opciones.
- **Playwright** (vite local con `--force`, `/api/*` simulado). Capturas en `/tmp/ra-shots69` del perfil del profesional a 1280 px, del perfil del inquilino a 390 px y del asistente de contrato a 1280 y 390 px:
  - todos los campos miden 44 px con radio 12;
  - 15 px en escritorio y 16 px en móvil;
  - el foco va en azul `rgb(67,104,255)`;
  - sin desbordamiento horizontal.
  - El `input type="date"` mide 45-46 px por el control nativo, una diferencia mínima.
- **GitNexus.** `impact` de `Input`: LOW (no sigue el JSX; los 6 ficheros que lo importan se revisaron a mano). `detect_changes`: riesgo medio, solo por el flujo `TicketDetail → GetTicket`, que cambia solo en el render.

**Qué queda.**
- `ui/Badge`, `Alert`, `Pagination` y `Drawer` siguen con estilos en línea. También quedan campos sueltos con clases propias: la subida de foto y el resto del perfil, `pro/Profile` y los formularios de alta de inmueble y de avería. Pasarlos a `Input` y `.ra-input` iría pantalla a pantalla.
- Las pantallas de acceso usan `.auth-input`, ya alineado con 2026 en la ronda 64 pero con reglas índigo de base que se sobrescriben. Se podría unificar con `.ra-input`.
- En `index.css` quedan reglas antiguas con «revisar» (`.card`, `.gallery-*`, `.badge`) que sí se usan; no se han tocado.
- Pendientes anteriores: «Ingresos» fuera del menú del casero; el corazón del listado sin sesión no se guarda solo al volver; el casero no puede descartar candidatos (Jorge); `/landlord/services` es un marcador; el frontend sin ESLint.

**Siguiente mejora propuesta.** Seguir con los formularios grandes: el alta de inmueble y el de avería a `Input`, `Select` y `.ra-input`, con etiquetas asociadas, revisados con capturas. Si toca backend: un test que compruebe en `app.ts` qué rutas de `/api/contracts` son públicas, para que no se cuele ningún webhook detrás de `authenticate` sin querer.

### Ronda 70 — 2026-10-12 20:45

**Qué y por qué.** Como proponía la ronda 69, toca seguir con los formularios grandes. El alta de inmueble es el primer paso del casero, y al revisarlo salieron fallos además de la apariencia. La sesión se cortó al agotarse la cuota antes de editar nada; se retomó con el árbol limpio.

1. **Alta de inmueble (`PropertyFormRHF`).**
   - **Fallo: errores invisibles.** Tamaño, habitaciones, baños, planta, año, fianza y fecha no mostraban su mensaje de error. Con un valor fuera de rango (p. ej. 5 m²), «Siguiente» o «Crear propiedad» no hacían nada y no decían por qué. Ahora cada campo enseña su error debajo, con `aria-invalid` y `aria-describedby`. Si al guardar falla un dato de un paso anterior, el asistente vuelve a ese paso y avisa con un toast (`onInvalid`). «Detalles» valida ya planta y año al avanzar.
   - **Fallo: quitar foto en el móvil.** El botón de borrar una foto solo aparecía al pasar el ratón (`opacity-0 group-hover`), así que en una pantalla táctil no se veía. Además no tenía nombre accesible. Ahora se ve siempre («Quitar la foto N») y vuelve a validar el mínimo de fotos.
   - **Accesibilidad:** ningún `<label>` estaba asociado a su campo. Ahora usan `Input`, `Select` y `.ra-input`. Los campos con unidad (m², €) van en un `AffixInput` local, con la unidad fuera de la etiqueta.
   - **Apariencia 2026:** los pasos son una barra fina en azul de marca (antes, círculos con verde y escalado; en móvil solo se ve la etiqueta del paso activo). Las sugerencias de dirección, el recuadro de coordenadas, la zona de subida, Tenant PRO y las casillas usan los tokens `--ra-*`; las casillas, `accent-color` de marca. Se quita el emoji ℹ️. Textos con tildes («Galería», «publicación», «válido», «Ubicación»…), «Crear anuncio» y «Guardar cambios», y mensajes de validación en lenguaje claro («El tamaño mínimo es 10 m²» en vez de «Tamaño inválido (min 10m²)»).
   - Guarda en `onSubmit`: antes del último paso, enviar el formulario avanza de paso en vez de guardar. En el navegador, Intro no enviaba nada porque el formulario no tiene botón de envío, así que esto no corrige un fallo visible; protege por si se añade uno.
2. **`Input` y `Select` con `forwardRef`**, para poder usarlos con `register()` de react-hook-form. Con los 6 usos actuales no cambia nada.
3. **Formulario de avería (`TicketCreatePage`).** Deja su `fieldClass` propio (radio 8, foco gris) por `Select`, `Input` y `.ra-input`, y sus copias de botón por `buttonClassName`. Las pastillas del tipo de avería pasan a tokens `--ra-*`. Nuevas clases `.ra-field-hint` y `.ra-field-error` en `@layer components`.

**Commits.**
- `a024f2e` Interfaz: alta de inmueble al sistema 2026 y con los errores a la vista
- `3dfc989` Interfaz: el formulario de avería usa Select, Input y .ra-input
- Docs: este registro

**Verificación (resultados reales).**
- **Frontend.**
  - `npm --prefix frontend run lint`: sin errores. `npm --prefix frontend run build`: OK.
  - `npm --prefix frontend test`: **61 ficheros y 247 tests OK**.
  - Tests nuevos: `components/__tests__/PropertyFormRHF.test.tsx` (6 casos: etiquetas asociadas y error del título enlazado; error del tamaño visible sin salir de «Detalles»; planta fuera de rango; quitar foto con nombre; guardar con la fianza mal no envía, marca el campo y avisa; enviar antes del último paso no guarda) y un caso de `ref` en `Input.test.tsx`.
  - **Ojo al escribir tests de formularios:** `src/setupTests.ts` sustituye `zodResolver` por uno que nunca da errores. Por eso ningún test veía la validación. El test nuevo hace `vi.unmock('@hookform/resolvers/zod')`. Con node se comprobó que el resolver real sí valida, así que en la app funciona.
- **Backend:** sin cambios.
- **Playwright** (vite local en 3970, `/api/*` y Nominatim simulados). Capturas en `/tmp/ra-shots70` del alta (pasos 1 a 3, con y sin errores) y de la avería, a 1280 y 390 px:
  - campos de 44 px con radio 12;
  - con el formulario vacío, «Siguiente» marca en rojo los cuatro campos con su mensaje;
  - sin desbordamiento horizontal;
  - en móvil, los cuatro pasos caben (solo la etiqueta activa).
  - El paso 4 no se capturó: exige subir 3 fotos y la subida no estaba simulada. Lo cubren los tests.
- **GitNexus.** `impact` de `PropertyFormRHF` e `Input`: LOW (no sigue JSX; los importadores se revisaron con grep). `detect_changes`: riesgo medio, solo por los flujos de `TicketCreatePage`, que cambian únicamente en el render.

**Qué queda.**
- El mock global de `zodResolver` en `setupTests.ts` esconde la validación en todos los tests de formularios. Conviene quitarlo y ver qué tests dependían de él.
- `RentSuggestionCard`, la zona de `Dropzone` (sigue con `style` en línea) y los recuadros verde y ámbar del alta usan colores de Tailwind, no tokens.
- Nominatim se llama desde el navegador sin `User-Agent` ni límite propio. Su política pide máximo 1 petición por segundo; el debounce de 350 ms puede pasarse al escribir rápido.
- Pendientes anteriores: `ui/Badge`, `Alert`, `Pagination` y `Drawer` con estilos en línea; `pro/Profile` y la subida de foto del perfil; `.auth-input` frente a `.ra-input`; «Ingresos» fuera del menú del casero; el casero no puede descartar candidatos (Jorge); el frontend sin ESLint.

**Siguiente mejora propuesta.** Quitar el mock global de `zodResolver` en `setupTests.ts` y arreglar los tests que dependan de él, para que la validación real quede probada en todos los formularios. Después, subir el debounce de Nominatim a 1 s y cancelar la búsqueda al elegir una sugerencia.

### Ronda 71 — 2026-10-12 20:52

**Qué y por qué.** Lo que proponía la ronda 70: que la validación real quede probada. Al hacerlo salieron dos fallos del alta de inmueble, el primer paso del casero.

1. **Fuera el mock global de `zodResolver`** (`frontend/src/setupTests.ts`). Sustituía el resolver por uno que nunca daba errores, así que ningún test de formulario veía la validación. Solo lo usa `PropertyFormRHF`, cuyos tests ya pedían el real con `vi.unmock`. Sin el mock, la suite completa pasa igual (61 ficheros, 247 tests) y el `vi.unmock` sobra.
2. **Fallo: mensajes de zod en inglés.** Al vaciar un campo numérico (renta, fianza, tamaño, habitaciones, baños, latitud o longitud), `valueAsNumber` da `NaN` y el formulario enseñaba «Expected number, received nan». Ahora cada número tiene su texto («Escribe la renta mensual», «Escribe la fianza (0 si no hay)»…), igual que los rangos de latitud y longitud y el máximo de 20 fotos, que tampoco tenían texto propio.
3. **Fallo: la lista de direcciones se reabría.** Al elegir una sugerencia, la dirección que se escribía en el campo lanzaba otra búsqueda: la lista volvía a abrirse con la misma opción, o salía la pista «Si no aparece la dirección…». Al editar un anuncio, se buscaba la dirección guardada nada más abrir. Ahora la dirección elegida (o la guardada) no se busca. Además:
   - espera de 1 s entre búsquedas, en vez de 350 ms (Nominatim admite como mucho 1 petición por segundo);
   - «Buscando…» se ve desde que se escribe, para que la pista de «no aparece» no salga durante la espera;
   - una búsqueda cancelada ya no apaga el «Buscando…» de la siguiente.

**Commits.**
- `84e4857` Tests del frontend: fuera el mock global de zodResolver
- `8a417fa` Alta de inmueble: mensajes en español para números vacíos y búsqueda de dirección que no se reabre
- Docs: este registro, la nota de Nominatim en «Para Jorge» y PROJECT_MEMORY

**Verificación (resultados reales).**
- Antes de editar, con node y zod 3.25: `z.coerce.number().min(0,'…')` con `NaN` da «Expected number, received nan». Así se confirmó el fallo 2.
- `npm --prefix frontend run lint`: sin errores. `npm --prefix frontend run build`: OK.
- `npm --prefix frontend test`: **61 ficheros y 250 tests OK** (247 sin el mock, antes de los cambios del alta; después, 3 más).
- Tests nuevos en `PropertyFormRHF.test.tsx`: la fianza vacía da el mensaje en español y no envía; elegir una sugerencia rellena dirección, ciudad y latitud, `fetch` se llama una sola vez y no vuelven ni la lista ni la pista; al editar con dirección guardada no se llama a `fetch`.
- **GitNexus.** `impact` de `PropertyFormRHF`: LOW (lo importa `LandlordDashboard`, que en su test lo sustituye). `detect_changes`: riesgo bajo, sin flujos afectados.
- Backend sin cambios. No se hicieron capturas: el cambio visible es texto de errores y que la lista no se reabra, ya cubierto por los tests.

**Qué queda.**
- Nominatim como autocompletado va contra su política de uso (nota en «Para Jorge»).
- Las sugerencias no se manejan con el teclado (flechas, Escape) ni tienen `role="listbox"`. Para alguien que no usa ratón, la lista no es accesible.
- `RentSuggestionCard`, la zona de `Dropzone` y los recuadros verde y ámbar del alta siguen con colores de Tailwind.
- Pendientes anteriores: `ui/Badge`, `Alert`, `Pagination` y `Drawer` con estilos en línea; `pro/Profile`; `.auth-input` frente a `.ra-input`; «Ingresos» fuera del menú del casero; el frontend sin ESLint.

**Siguiente mejora propuesta.** Hacer accesibles las sugerencias de dirección: patrón combobox con `aria-expanded`, `aria-activedescendant`, flechas, Intro y Escape, y cerrar al perder el foco. Después, `Dropzone` y `RentSuggestionCard` a tokens `--ra-*`.

### Ronda 72 — 2026-10-12 21:10

**Qué y por qué.** Lo que proponía la ronda 71: la lista de sugerencias de dirección del alta de inmueble no se podía usar sin ratón. Es el primer paso del casero, y además Intro con la lista abierta pasaba de paso. Al revisar el alta con capturas salió otro fallo que bloqueaba en silencio.

1. **Sugerencias de dirección como combobox** (`PropertyFormRHF`).
   - El campo lleva `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` y `aria-activedescendant`. La lista es `role="listbox"` con opciones `role="option"` y `aria-selected`, en vez de botones sueltos.
   - Flechas arriba y abajo para moverse (dan la vuelta). Intro elige la opción resaltada y ya no pasa de paso. Escape o salir del campo cierran la lista sin enseñar la pista de «Si no aparece la dirección…»; la flecha la vuelve a abrir.
   - Al pasar el ratón se resalta la opción. El clic usa `mousedown` sin foco para que cerrar al perder el foco no se coma el clic.
2. **Fallo: «Galería» bloqueada sin decir por qué.** El error del campo `images` no se pintaba en ningún sitio. Con 3 fotos o más, si una tenía una dirección no válida (la subida devuelve `/uploads/…` relativa cuando falta `APP_URL`), «Siguiente» no hacía nada; el mensaje habría sido «Invalid url». Ahora sale en español bajo la zona de subida («Una de las fotos no se subió bien. Quítala y vuelve a subirla»), también el máximo de 20 fotos. Con menos de 3 lo sigue diciendo el recuadro ámbar.
3. **`Dropzone` y `RentSuggestionCard` con tokens 2026.**
   - `Dropzone`: fuera los estilos en línea y el fondo índigo al arrastrar (`rgba(79,70,229,…)`); ahora clases con `--ra-blue`, anillo de foco visible al llegar con Tab y Espacio sin hacer scroll de la página. El `padding: 24` del alta pasa a `p-6`.
   - `RentSuggestionCard`: de la paleta índigo de Tailwind a tarjeta blanca con `--ra-line`, tinta y gris del sistema; icono en azul de marca; el botón de recalcular tiene área de toque y fondo al pasar el ratón.
   - Los recuadros verde y ámbar del alta se quedan: son estados (listo / falta) y el sistema no tiene tokens de éxito ni de aviso.

**Commits.**
- `06660b8` Alta de inmueble: sugerencias de dirección con el teclado y la galería explica por qué no avanza
- `5beca72` Interfaz: Dropzone y la tarjeta de precio sugerido con tokens 2026
- Docs: este registro y la nota de `APP_URL` (ronda 34) ampliada en «Para Jorge»

**Verificación (resultados reales).**
- `npm --prefix frontend run lint`: sin errores. `npm --prefix frontend run build`: OK.
- `npm --prefix frontend test`: **61 ficheros y 254 tests OK** (250 antes).
- Tests nuevos en `PropertyFormRHF.test.tsx` (13 en total): atributos del combobox y flechas con vuelta; Intro elige la segunda opción, rellena la ciudad, cierra la lista y no cambia de paso; Escape y blur cierran sin la pista y la flecha reabre; fotos con dirección relativa dan el mensaje en español y no «Invalid url». El test de elegir sugerencia pasa de `button` a `option`.
- **Playwright** (vite local en 3972, `/api/*`, la subida, el precio sugerido y Nominatim simulados). Capturas en `/tmp/ra-shots72` a 1280 y 390 px: lista abierta con la segunda opción resaltada por teclado (`aria-activedescendant=pf-address-option-1`); tras Intro sigue en «Ubicación», ciudad «Alcalá de Henares», lista cerrada; `Dropzone` con 24 px de padding, sin atributo `style` y anillo de foco azul; tarjeta de precio en blanco con chips grises; sin desbordamiento horizontal. La primera pasada, con la subida devolviendo rutas relativas, es la que destapó el fallo 2.
- **GitNexus.** `impact` de `PropertyFormRHF`: LOW. `detect_changes`: riesgo medio, solo por el flujo `RentSuggestionCard → GetRentSuggestion`, que cambia únicamente en el render.
- Backend sin cambios.

**Qué queda.**
- La subida de imágenes depende de `APP_URL` para devolver URLs absolutas que acepten los esquemas. Se podría hacer que el backend construya la URL con el host de la petición o que el esquema acepte `/uploads/…`; toca el contrato de la API y los adjuntos del chat (ronda 34), así que no se ha cambiado.
- Pendientes anteriores: Nominatim como autocompletado (Jorge); `ui/Badge`, `Alert`, `Pagination` y `Drawer` con estilos en línea; `pro/Profile`; `.auth-input` frente a `.ra-input`; «Ingresos» fuera del menú del casero; el frontend sin ESLint.

**Siguiente mejora propuesta.** Cambiar de terreno tras cuatro rondas de interfaz: un test del backend que recorra `app.ts` y fije qué rutas de `/api/contracts` son públicas (para que ningún webhook quede detrás de `authenticate` sin querer, ni al revés), y revisar si `upload.routes.ts` debe dar URLs absolutas sin `APP_URL`. Si se vuelve a la interfaz: `ui/Badge`, `Alert`, `Pagination` y `Drawer` sin estilos en línea.

### Ronda 73 — 2026-10-12 21:35

**Qué y por qué.** Tras cuatro rondas de interfaz, lo que proponía la ronda 72: cerrar el fallo de las fotos sin `APP_URL` y fijar con un test qué rutas de contratos son públicas.

1. **Fallo: alta de inmueble bloqueada sin `APP_URL`, y fotos con `javascript:`.**
   - Sin `APP_URL`, la subida devuelve `/uploads/<nombre>`. El esquema del frontend la rechazaba (desde la ronda 72 al menos lo decía) y el del backend también (`z.string().url()`), así que el casero no podía publicar.
   - Se elige aceptar la ruta relativa en vez de construir la URL con el `Host` de la petición: los adjuntos del chat y las fotos de avería ya guardan `/uploads/…` y se validan con `isOwnUploadUrl`, y cambiar la subida habría roto el chat sin `APP_URL`.
   - Backend (`property.schema.ts`): cada foto es una URL `http(s)` o una subida propia (`isOwnUploadUrl`), con 500 caracteres como máximo. De paso, `z.string().url()` admitía `javascript:alert(1)` y `data:`; ya no.
   - Frontend (`PropertyFormRHF`): la misma regla con una expresión `PHOTO_URL`.
2. **Test de rutas públicas de `/api/contracts`** (`tests/security/contract-public-routes.test.ts`). Sin sesión y sin el atajo `ALLOW_TEST_AUTH`:
   - los webhooks de Firma.dev, el callback de firma y el de Stripe llegan a su controlador y rechazan por su propia firma, no por «Token requerido»;
   - 23 rutas privadas (listado, detalle, PDFs, historial, cobros, fianza, firma, co-titulares, ingresos) dan 401;
   - `/signature/webhook` y `/:id/signature/callback` quedan fijadas como 401 (punto #9 de `review-firma`, pendiente de Jorge). Si se decide hacerlas públicas, el test lo recuerda.

**Commits.**
- `f3aad54` Alta de inmueble: las fotos subidas sin APP_URL ya se aceptan y se rechazan javascript: y data:
- `25bb568` Tests: qué rutas de /api/contracts responden sin sesión
- Docs: este registro, la nota de `APP_URL` en «Para Jorge» actualizada y PROJECT_MEMORY

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand`:
  - `tests/properties` y `tests/uploads`: 9 suites, 43 tests OK. Seis casos nuevos en `property.routes.test.ts`: acepta `/uploads/…`, y rechaza `javascript:`, `data:`, `/uploads/../app.ts`, `/otra/ruta.jpg` y `javascript:` al editar.
  - `tests/security/contract-public-routes.test.ts`: 26 OK. La primera versión mandaba al callback de firma un ID de sobre y se quedaba esperando a Mongo; eso ya probaba que la ruta es pública. Ahora va sin ID y responde 400 antes de consultar la base.
- Frontend: `lint` sin errores, `build` OK, `npm --prefix frontend test` **61 ficheros y 255 tests OK** (254 antes). En `PropertyFormRHF.test.tsx`, un caso nuevo (`/uploads/…` pasa a «Condiciones») y el de error usa ahora una URL `blob:`.
- **GitNexus.** `impact` de `propertyCreateSchema`: LOW. `detect_changes`: riesgo bajo, sin flujos afectados.
- Sin capturas: el cambio visible es que «Galería» deja avanzar, y eso lo cubre el test.

**Qué queda.**
- Las fotos `/uploads/…` del anuncio se ven solo si el frontend se sirve desde el mismo dominio que la API, como el chat y las averías. En desarrollo con `REACT_APP_API_URL` en otro origen no se verían; `.env.example` trae `APP_URL`, así que no afecta a quien lo copie.
- Los anuncios ya guardados con fotos de otros dominios (`https://…`) se siguen aceptando. Restringir las fotos a subidas propias, como en el chat, cerraría los píxeles de rastreo en la ficha pública, pero hay datos y tests con URLs externas. Queda propuesto.
- Pendientes anteriores: `ui/Badge`, `Alert`, `Pagination` y `Drawer` con estilos en línea; `pro/Profile`; `.auth-input` frente a `.ra-input`; «Ingresos» fuera del menú del casero.

**Siguiente mejora propuesta.** Volver a la interfaz: `ui/Badge`, `Alert`, `Pagination` y `Drawer` sin estilos en línea y con tokens `--ra-*`, con capturas. Si se prefiere seguridad: el mismo test de rutas públicas para `/api/users`, `/api/tickets` y `/api/chat`.


### Ronda 74 — 2026-10-12 21:34

**Qué y por qué.** Lo que proponía la ronda 73: volver a la interfaz con los componentes base que seguían con estilos en línea y colores de la plantilla antigua. Las pastillas de estado salen en casi todas las listas (contratos, incidencias, pagos, propietarios de la agencia) y el panel lateral es el menú del móvil.

1. **`ui/Badge` con tokens 2026.** Fuera los estilos en línea (borde `var(--border)`, índigo en `highlight`, cian en `new`). Ahora clases `.ra-badge` y `.ra-badge-<tono>` con los cinco tonos de estado de `getStatusTone`: neutro (`--ra-paper`, `--ra-line`), info (azul de marca oscurecido, `#2f4fd6`, porque `--ra-blue` sobre su fondo da 4,0:1 y no llega a AA), éxito, aviso y error (estos tres sin token `--ra-*`; se dejan como colores de estado). Contraste medido: entre 5,8:1 y 8,8:1.
   - `StatusBadge` y `ContractStatusBadge` pasan el tono en vez de copiar `background/borderColor/color`; `STATUS_TONE_STYLES` desaparece.
   - «Propietarios» de la agencia tenía su propia pastilla con clases de Tailwind; ahora usa `Badge`.
2. **`ui/Drawer` sin estilos en línea** (salvo el ancho, que es una prop). Borde, sombra, desplazamiento y visibilidad pasan a `.drawer-panel-left/right` e `.is-open`, con `--ra-line` y la sombra en tinta del sistema. El truco de `visibility` (que los enlaces del panel cerrado no reciban el foco) se mantiene en CSS. Respeta `prefers-reduced-motion`. El fondo pierde el desenfoque y pasa por encima de la barra superior (antes `z-index` 40, por debajo de ella).
3. **Código muerto fuera:** `ui/Alert` y `ui/Pagination` (nadie los importaba), y `pages/Verification` con `services/verification`: pantalla sin ruta, con el estado en inglés («unverified») y un botón «Marcar como verificado (dev)».

**Commits.**
- `e0d3646` Interfaz: pastillas de estado y panel lateral con tokens 2026
- `85b7c1f` Limpieza: fuera ui/Alert, ui/Pagination, pages/Verification y services/verification
- Docs: este registro y PROJECT_MEMORY

**Verificación (resultados reales).**
- `npm --prefix frontend run lint`: sin errores. `npm --prefix frontend run build`: OK.
- `npm --prefix frontend test`: **63 ficheros y 260 tests OK** (5 nuevos: `Badge.test.tsx` con tono por clase, sin `style`, y el tono de `StatusBadge`/`ContractStatusBadge`; `Drawer.test.tsx` cerrado oculto y sin fondo, abierto con foco en el panel, Escape y clic en el fondo).
- Capturas con Playwright y la API simulada (`/tmp/ra-shots74`): lista de contratos a 1280 px (Activo, Pendiente de firma, Borrador, Rescindido), incidencias a 390 px y el menú móvil abierto. En el navegador real, el menú recibe el foco al abrir y, tras Escape, queda oculto y el foco vuelve a «Abrir menú».
- **GitNexus.** `impact` de `Badge` y `Drawer`: LOW. `detect_changes`: marca «high» por nueve flujos que pintan pastillas (`TenantDashboard`, `TenantApplications`, `ComplianceDashboard`, `AgencyLandlords`); `load` y `submit` de `AgencyLandlords` solo aparecen por el desplazamiento de líneas del import. Sin cambios de lógica.

**Qué queda.**
- `ComplianceDashboard` (administración) pinta sus propias pastillas con colores sueltos y en mayúsculas, y el título está en inglés («Compliance (Rental Public)», «Demo mode»).
- Pendientes anteriores: `pro/Profile`; `.auth-input` frente a `.ra-input`; «Ingresos» fuera del menú del casero; las fotos externas en los anuncios (píxeles de rastreo).

**Siguiente mejora propuesta.** Cambiar de terreno: el test de rutas públicas de la ronda 73 para `/api/users`, `/api/tickets` y `/api/chat` (qué responde sin sesión). Si se vuelve a la interfaz: `ComplianceDashboard` en español y con `Badge`.

### Ronda 75 — 2026-10-12 21:52

**Qué y por qué.** La ronda 74 proponía extender el test de rutas públicas a `/api/users`, `/api/tickets` y `/api/chat`. Al sondear `app.ts` con peticiones anónimas reales salió algo más grave: un flujo roto, también en producción.

1. **Fallo: las invitaciones públicas respondían 401.** `app.use('/api', authenticate, postsignRouter)` (antes en la línea 326) ejecuta `authenticate` en toda petición `/api/*` que llegue hasta él, no solo en `/api/postsign`. `GET /api/agency-invites/:token`, `POST /api/agency-invites/:token/accept` y `GET /api/invites/preview` se montaban después, así que sin JWT daban «Token requerido».
   - Consecuencia: el propietario invitado por una agencia (que aún no tiene cuenta) veía «Invitación no válida» y no podía activar su cuenta; el co-titular sin sesión, igual. Producción (726bf6f) tiene el mismo orden.
   - Por qué no lo veían los tests: `jest.setup.ts` pone `ALLOW_TEST_AUTH=true` en toda la suite, y con él `authenticate` inventa un usuario cuando no hay cabecera.
   - Arreglo mínimo: las tres rutas suben antes del primer `authenticate` global, con un comentario que explica por qué. No se ha reorganizado el resto de montajes.
2. **Test sin atajos** (`tests/security/invite-public-routes.test.ts`, 15 casos): con `ALLOW_TEST_AUTH=false` y `ALLOW_UNVERIFIED=false`, la agencia invita con un JWT real, el propietario anónimo ve la invitación y crea su cuenta (201), y con su JWT recién emitido (cuenta sin verificar) puede volver a abrirla. Además, la vista previa del co-titular responde sin sesión, y diez rutas privadas (`/api/users/me`, `/api/tickets`, `/api/chat/conversations`, `/api/agency/landlords`, la invitación de la agencia, `/api/me/tenant-pro`, el upsell de `postsign`, `/api/payments`, `/api/tax/report`, `/api/invites/accept`) siguen dando 401.
3. **Pantallas de invitación** (`InviteAccept`, `CoTenantInviteAccept`).
   - Cualquier fallo al cargar (red, 500, el 401 de arriba) se pintaba como «Invitación no válida». Ahora solo un 404; lo demás da «No se pudo cargar la invitación» con «Reintentar».
   - Al activar la cuenta de propietario, `user_already_exists`, `invite_expired`, `invite_already_accepted` e `invalid_payload` salían como el código en crudo (`formatApiError`). Ahora salen en español y, si el correo ya tiene cuenta, con un enlace a «Iniciar sesión» (estilo `.auth-alert a`).

**Commits.**
- `9bdbe75` Invitaciones: el propietario invitado por una agencia ya puede crear su cuenta y el co-titular ver la invitación sin sesión
- `e861f69` Invitaciones: la pantalla solo da el enlace por no válido con un 404 y explica los errores al activar
- Docs: este registro, la nota en «Para Jorge» y PROJECT_MEMORY

**Verificación (resultados reales).**
- Sondeo anónimo antes del arreglo: las tres rutas daban 401 `{"error":"Token requerido"}`.
- El test nuevo con el `app.ts` anterior: **5 fallos** (los cinco casos públicos) y 10 aciertos; con el arreglo, 15/15.
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/agency`, `tests/contracts/contract.cotenant.test.ts` y `tests/security`: **11 suites y 116 tests OK**.
- Frontend: `lint` sin errores, `build` OK, `npm --prefix frontend test` **64 ficheros y 266 tests OK** (260 antes): `InviteAccept.test.tsx` nuevo (5 casos) y un caso de reintento en `CoTenantInviteAccept.test.tsx`.
- **GitNexus.** `impact` de `InviteAccept`: LOW (solo la ruta en `AppRoutes`). `detect_changes`: riesgo medio por el flujo `submit → GetApiErrorRequestId`, que es el que se cambia. `app.ts` no tiene símbolos afectados (es montaje de nivel superior).
- Sin capturas: los cambios visibles son textos de estado y error, cubiertos por los tests.

**Qué queda.**
- Los `app.use('/api', authenticate|requireVerified, router)` sin prefijo (líneas de `postsign`, `appointmentsFlowRoutes`, `connectRoutes`, `serviceOfferRoutes`, `taxReportRoutes`) siguen aplicándose a todo lo que se monta detrás. Hoy no hay más rutas públicas después, pero es una trampa: lo correcto sería montar cada router con su prefijo (`/api/postsign`, `/api/tax`…), lo que cambia las rutas internas de cada router. Queda propuesto.
- `ALLOW_TEST_AUTH=true` global en `jest.setup.ts` esconde fallos de este tipo. Los flujos públicos críticos (registro, login, recuperación, invitaciones, webhooks) ya tienen test sin atajo; el resto no.
- Pendientes anteriores: `ComplianceDashboard` en inglés y con pastillas propias; `pro/Profile`; `.auth-input` frente a `.ra-input`; fotos externas en los anuncios.

**Siguiente mejora propuesta.** Montar `postsignRouter` y `taxReportRoutes` con su prefijo (`/api/postsign`, `/api/tax`) en vez de `app.use('/api', authenticate, …)`, con el test de esta ronda como red, para que una ruta pública nueva no vuelva a quedar detrás de `authenticate` sin querer. Si se prefiere interfaz: `ComplianceDashboard` en español y con `Badge`.

### Ronda 76 — 2026-10-12 22:40

**Qué y por qué.** Lo que proponía la ronda 75: quitar la trampa que dejó las invitaciones detrás de la sesión. Varios routers se montaban con `app.use('/api', authenticate|requireVerified, router)` sin prefijo, y ese middleware corre en toda petición `/api` que llegue hasta él. Cualquier ruta pública montada después quedaba cerrada sin que nadie lo notara.

1. **Cada router privado con su prefijo** (`src/app.ts`). `postsign`, `tenant-pro`, `me/tenant-pro`, `appointments`, `applications`, `payments`, `connect`, `service-offers` y `tax` se montan ya en `/api/<prefijo>` con su `authenticate` y, donde ya se aplicaba, `requireVerified`. Sus rutas internas pasan a relativas (`'/postsign/upsell/:id'` → `'/upsell/:id'`); las URLs que ve el frontend no cambian. Las dos rutas de citas de `serviceOffers.routes.ts` (`reschedule`, `cancel`) salen a `serviceOfferAppointmentRoutes` y van en `/api/appointments` junto a las de incidencias.
   - Se conserva tal cual lo que imponía el global: `/api/invites` y `/api/institution` exigían la identidad verificada (les llegaba el `requireVerified` antiguo) y ahora lo dicen explícitamente. Lo de institución queda anotado en «Para Jorge».
   - De paso, las rutas privadas montadas después ya no pasan dos veces por `authenticate` (dos consultas de `tokenVersion` a Mongo por petición).
2. **Mapa de sesión de toda la API** (`tests/security/route-auth-map.test.ts`, 4 casos). Sin atajo de cabeceras ni `ALLOW_UNVERIFIED`, recorre la pila de Express y saca las rutas de `/api` (unas 195). Comprueba que:
   - toda ruta fuera de una lista explícita de 27 públicas (webhooks, textos legales, acceso a la cuenta, anuncios, cláusulas, invitaciones) da 401 «Token requerido»;
   - ninguna de esas 27 da «Token requerido»;
   - `/api/no-existe` da 404.

   Una ruta nueva entra sola en la comprobación: si se monta sin sesión sin querer, o si una pública queda detrás de `authenticate` (como en la ronda 75), falla.

**Commits.**
- `32c4492` Rutas: cada router privado se monta con su prefijo y un test vigila qué rutas de /api responden sin sesión
- Docs: este registro, la nota del portal de institución en «Para Jorge» y PROJECT_MEMORY

**Verificación (resultados reales).**
- **Comparación con el código anterior** (worktree temporal en `HEAD`, ya borrado): un script de un solo uso llamó a cada ruta `/api` sin sesión y con JWT de inquilino, casero e institución sin verificar. Fueron 632 combinaciones de método y ruta. Respondieron igual en los dos códigos (mismo estado y mismo error), salvo `/api/no-existe`, que antes daba 401 (sin sesión) o 403 `owner_not_verified` y ahora 404.
- Backend: `npx tsc --noEmit` sin errores.
- Jest `--runInBand` de `tests/security`, `tests/appointments`, `tests/applications`, `tests/tenantPro`, `tests/agency`, `tests/institution`, los de cobros, disputas, recibos y co-titulares, `serviceOffer.payment`, `property.apply`, `ticket.access` y `src/__tests__/api.test.ts`: **25 suites OK**. Una primera tanda se cortó a los 10 minutos con 11 suites aprobadas y sin el total de tests; las 14 restantes se repitieron aparte (**69 tests OK**). `route-auth-map` pasa 4/4.
- **GitNexus.** `detect_changes`: riesgo bajo, sin flujos afectados (solo marca `shouldServeSpaFallback` y `publishSystem`, que únicamente se desplazan de línea).
- Frontend sin cambios: no se ha pasado ni el build ni sus tests.

**Qué queda.**
- La lista de rutas públicas incluye tres de `/api/verification` que, sin sesión, responden 403 desde su controlador y no 401. Funciona, pero se podría montar ese router con `authenticate` (lo hace `dev/verify` por dentro) y sacarlas de la lista.
- `/api/testing/inbound/leads` lista leads sin sesión fuera de producción (en producción no se monta). Sobra si nadie lo usa.
- Pendientes anteriores: `ComplianceDashboard` en inglés y con pastillas propias; `pro/Profile`; `.auth-input` frente a `.ra-input`; fotos externas en los anuncios.

**Siguiente mejora propuesta.** Volver a la interfaz tras dos rondas de backend: `ComplianceDashboard` en español, con `Badge` y tokens `--ra-*`, revisado con capturas. Si se prefiere backend: `/api/verification` detrás de `authenticate` y fuera de la lista de públicas.

### Ronda 77 — 2026-10-12 22:42

**Qué y por qué.** Lo que proponía la ronda 76: volver a la interfaz tras dos rondas de backend. El panel de cumplimiento de rentas (`/admin/compliance`) era la última pantalla de administración con el título en inglés, pastillas propias en mayúsculas y estilos en línea. Al revisarlo salió además un fallo en las cifras.

1. **Fallo: cifras de «cumple» e «incumple» mal calculadas.** La API (`getComplianceDashboard`) solo daba evaluados y en riesgo. La pantalla contaba «Non-compliant» con las 25 filas de la página y sacaba «Compliant» restando esa cifra, así que con más de una página las dos tarjetas salían mal.
   - Ahora `totals` trae también `compliant` y `nonCompliant`, contados sobre todo el filtro. Son campos nuevos; el portal de institución usa el mismo servicio y no cambia.
   - De paso: con un filtro de estado puesto, «en riesgo» contaba todos los contratos en riesgo, porque `{...query, status: 'risk'}` pisaba el estado pedido. Ahora da 0 si se filtra por otro estado. Esto corrige también la tarjeta «en riesgo» del portal de institución cuando se filtra por estado.
2. **Pantalla en español y con el sistema 2026** (`ComplianceDashboard.tsx`).
   - Usa `PageHeader`, tarjetas `Card`, filtros `Input`/`Select` con etiqueta, tabla con `--ra-line` y `Badge`: Cumple, En riesgo e Incumple; gravedad Informativa, Aviso y Crítica.
   - La zona se elige en un desplegable con las zonas que devuelve el servidor. Antes había que escribir a mano la clave, del tipo «galicia|oleiros|».
   - La renta sale en euros con el porcentaje de subida, y cada fila enlaza al contrato.
   - `invalid_date_range` se explica en español, también al exportar el CSV: el error llega dentro del Blob y antes salía «Request failed with status code 400». Hay botón «Reintentar».
   - Una lista vacía distingue «todavía no hay contratos revisados» de «ningún contrato coincide», con un botón «Quitar filtros».
   - El modo de ejemplo se anuncia como «Datos de ejemplo».
   - El menú lateral, la miga de pan, el inicio y los informes de administración dicen ya «Cumplimiento» y «Eventos del sistema».

**Commits.**
- `3c94470` Cumplimiento: el panel recibe del servidor cuántos contratos cumplen e incumplen
- `2bd641a` Interfaz: el panel de cumplimiento de rentas en español y con el sistema 2026
- Docs: este registro y PROJECT_MEMORY

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand` de `tests/admin/admin.compliance.test.ts` y `tests/institution/institution.compliance.test.ts`: **2 suites y 9 tests OK**. El caso nuevo crea 6 revisiones, pide páginas de 2 y comprueba `{evaluated: 6, risk: 2, compliant: 3, nonCompliant: 1}`; con `status=compliant`, `{3, 0, 3, 0}`.
- Frontend: `lint` sin errores, `build` OK. `npm --prefix frontend test`: **65 ficheros y 272 tests OK** (266 antes). `ComplianceDashboard.test.tsx` es nuevo, con 6 casos:
  - totales que vienen del servidor;
  - pastillas y textos en español;
  - filtro por zona desde el desplegable;
  - paginación;
  - error de fechas;
  - lista vacía con y sin filtros;
  - error del CSV leído del Blob.
- Capturas con Playwright y la API simulada (`/tmp/ra-shots77`), a 1280 y 390 px. La primera captura en móvil partía en dos líneas los enlaces de la cabecera; se arregló con `whitespace-nowrap` y salto de línea entre botones. Un primer vite no recogía los cambios y hubo que reiniciarlo con `--force`.
- **GitNexus.** `impact` de `getComplianceDashboard` y `ComplianceDashboard`: LOW. `detect_changes`: riesgo medio, solo por el flujo `ComplianceDashboard → FetchComplianceDashboard` (el que se cambia) y por `AdminReports`, al que solo se le cambia una etiqueta.

**Qué queda.**
- El CSV de cumplimiento sigue con cabeceras en inglés (`property_id,areaKey,…`). Puede haber quien lo procese, así que no se ha tocado.
- Las otras pantallas de administración enlazadas desde aquí siguen con estilos en línea y textos en inglés: `SystemEvents` («System Events», «Type», «Resource»), `AdminCompliancePage` y `AdminUsersPage`/`AdminTenantProPage` (tablas en línea). El portal de institución (`institution-frontend`) no muestra todavía «cumple» ni «incumple».
- Pendientes anteriores: `/api/verification` en la lista de rutas públicas; `pro/Profile`; `.auth-input` frente a `.ra-input`; fotos externas en los anuncios.

**Siguiente mejora propuesta.** Seguir con administración y pasar `SystemEvents` y `AdminCompliancePage` al español y al sistema 2026 (mismas piezas que esta ronda). Si se prefiere backend: montar `/api/verification` detrás de `authenticate` y sacarla de la lista de rutas públicas.

### Ronda 78 — 2026-10-16 04:19

**Qué y por qué.** Seguí lo que proponía la ronda 77: pasar al español y al sistema 2026 las dos pantallas de administración que enlaza el panel de cumplimiento, «Eventos del sistema» (`/admin/system-events`) y «Políticas» (`/admin/compliance/policies`). Al revisarlas salieron dos fallos y un hueco de seguridad, que se corrigieron antes que la apariencia.

1. **Inyección de fórmulas en el CSV de aceptaciones de políticas** (seguridad). `AdminCompliancePage` montaba el CSV en el navegador uniendo valores con comas.
   - El User-Agent lo manda quien acepta las políticas, así que un `=HYPERLINK(...)` se ejecutaba al abrir el fichero en Excel. Era el único exportador que se había quedado fuera de la corrección del 2026-10-11, porque no pasa por el backend.
   - Una coma o una comilla en el valor descolocaba además las columnas.
   - Ahora usa `frontend/src/utils/csv.ts`, con las mismas reglas que el `utils/csv.ts` del backend. La auditoría de seguridad lo recoge.
2. **Fechas de los eventos del sistema** (backend, `systemEvents.service.ts`).
   - «Hasta 2026-10-12» se convertía en la medianoche de ese día, así que los eventos del propio día no salían, tampoco en el CSV.
   - Una fecha no válida o un rango al revés daba 500, y `?page=abc` también.
   - Ahora usa `parseDateRange`, igual que el panel de cumplimiento: «hasta» incluye el día entero y los errores responden 400 `invalid_date_range`. Una paginación con valores raros vuelve a 1 y 25.
3. **«Eventos del sistema» en español y con el sistema 2026.**
   - El filtro solo ofrecía dos de los cuatro tipos que escribe el backend. Faltaban los avisos de precio por encima del límite (`LISTING_PRICE_LIMIT_EXCEEDED`) y las limpiezas (`SYSTEM_EVENTS_RETENTION_RUN`), y no se podía filtrar por inmueble ni por sistema.
   - Ahora cada evento sale con una `Badge` y su nombre en español, y el recurso enlaza a la ficha del contrato o del inmueble.
   - El detalle se abre en `ui/Modal` con el JSON sobre `--ra-paper` (antes era un bloque oscuro) y con el ID de petición para copiar. La columna «ID de petición» se quitó de la tabla, porque solo la tiene un tipo de evento y desbordaba a 1280 px.
   - Hay botón CSV: la API ya lo tenía y la pantalla no. Si falla, lee el error que viene dentro del Blob.
   - Además: `invalid_date_range` explicado, «Reintentar» y lista vacía con «Quitar filtros».
4. **«Aceptación de políticas» con el sistema 2026.**
   - Usa `PageHeader`, `Card`, `Select` con etiqueta, tabla con `--ra-line` y la versión en una `Badge`. El User-Agent sale recortado, con el texto completo en `title`.
   - Se añade «Cookies» al filtro: `cookies_policy` existe en el modelo y faltaba.
   - La lista vacía ofrece «Ver también versiones anteriores».
   - La miga de pan decía «policies» y «audit-trails»; ahora dice «Políticas» y «Pistas de firma».
   - `utils/download.ts` reúne la descarga de un Blob y la lectura del error que viene dentro. `ComplianceDashboard` la usa también.

**Commits.**
- `0e595d7` Eventos del sistema: «hasta» incluye el día entero y una fecha no válida da 400
- `b02656c` Políticas: el CSV de aceptaciones ya no ejecuta fórmulas y la pantalla pasa al español y al sistema 2026
- `d113036` Interfaz: «Eventos del sistema» en español, con el sistema 2026 y todos los tipos de evento
- Docs: este registro, la nota en `auditoria-seguridad-2026-10-05.md` y PROJECT_MEMORY

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. `tests/admin/admin.system-events.test.ts` es nuevo (primer test de esta API) y pasa con Jest `--runInBand`: **3/3**. Comprueba:
  - que solo entra el administrador;
  - que «hasta» incluye el día entero;
  - los filtros por recurso;
  - que el CSV respeta las fechas;
  - el 400 con fecha no válida o rango al revés, también en el CSV;
  - la paginación con `page=abc`.
- Frontend: `lint` sin errores y `build` OK. `npm --prefix frontend test`: **67 ficheros y 280 tests OK** (antes 272). Hay 5 tests nuevos de `SystemEvents` y 3 de `AdminCompliancePage`; uno de estos últimos comprueba que `=HYPERLINK("…")` sale en el CSV como `"'=HYPERLINK(""…"")"`.
- Capturas con Playwright y la API simulada (`/tmp/ra-shots78`), a 1280 y 390 px:
  - La primera captura a 1280 cortaba la columna «Ver detalle»; se quitó la columna del ID de petición.
  - En móvil, la página de eventos medía 550 px de ancho. La causa era el `<th>` con `sr-only`: es absoluto y se escapaba del contenedor con scroll. Se arregló con `relative` en ese contenedor (medido: 390 px). Ninguna otra tabla tiene ese patrón.
- **GitNexus.** `impact` de `buildSystemEventsQuery`: LOW (2 llamadores, los dos controladores). `detect_changes`: riesgo medio, solo por los flujos `SystemEvents → FetchSystemEvents` y `ComplianceDashboard → FetchComplianceDashboard`, que son los que se cambian.

**Qué queda.**
- `GET /api/admin/policies/acceptances` devuelve todas las aceptaciones sin paginar. Con muchos usuarios convendrá paginarlo y exportar el CSV desde el servidor, como los demás.
- El CSV de eventos y el de cumplimiento siguen con cabeceras en inglés (puede haber quien los procese).
- `parseDateRange` pone el fin del día en la hora local del servidor y el inicio en UTC. En un VPS en UTC da igual; si el servidor estuviera en hora de Madrid, el rango se desplazaría una o dos horas. No se ha tocado porque lo comparten cumplimiento, institución y contratos.
- Pendientes anteriores: `AdminUsersPage`/`AdminTenantProPage` con tablas en línea, `/api/verification` en la lista de rutas públicas, `pro/Profile`, `.auth-input` frente a `.ra-input` y fotos externas en los anuncios.

**Siguiente mejora propuesta.** Paginar `GET /api/admin/policies/acceptances` (con total) y mover su CSV al servidor con `csvRow`, para que la pantalla no cargue todas las aceptaciones de golpe. Si se prefiere interfaz: `AdminUsersPage` y `AdminTenantProPage` con el sistema 2026.

### Ronda 79 — 2026-10-16 04:35

**Qué y por qué.** Lo que proponía la ronda 78. «Aceptación de políticas» (`/admin/compliance/policies`) era la única pantalla de administración que cargaba todo sin paginar y montaba el CSV en el navegador. Con muchos usuarios (cada uno acepta tres o cuatro políticas por versión) la respuesta crecía sin límite, y el CSV solo podía salir de lo cargado.

1. **API paginada** (`src/services/policyAcceptances.service.ts`, nuevo; el controlador solo lo llama).
   - «Solo versiones vigentes» se filtraba en memoria después de traer todas las aceptaciones. Ahora va en la consulta, como pares política/versión vigentes, así que se puede paginar. Si no hay ninguna versión vigente, la lista sale vacía sin consultar.
   - Responde `{ data, total, page, pageSize }`; `data` sigue siendo la lista, así que quien leyera `data` no se rompe. `?page=abc` vuelve a 1 y 25, y el máximo es 100 por página.
   - Un `userId` mal formado daba 500 (CastError) y una política que no existe, una lista vacía sin más. Ahora dan 400 `invalid_user_id` e `invalid_policy_type`.
2. **CSV desde el servidor**: `GET /api/admin/policies/acceptances/export.csv`, con los mismos filtros, todas las filas y `csvRows` (fórmulas neutralizadas). Mantiene las cabeceras que tenía el CSV del navegador.
3. **Pantalla.**
   - Pide páginas de 25 y muestra «1–25 de N aceptaciones» con Anterior y Siguiente, igual que «Eventos del sistema». Al cambiar el filtro vuelve a la primera página.
   - El botón CSV descarga el del servidor. Si falla, explica el error que viene dentro del Blob.
   - Se quita `frontend/src/utils/csv.ts`, que se creó en la ronda 78 solo para esta pantalla y ya no tenía uso. La nota de la auditoría de seguridad lo recoge.

Al revisar los filtros vi que `?userId[$ne]=x` ya lo corta `rejectMongoOperators` (400 `invalid_input`) y que `hpp` reduce las listas a un solo valor. No había inyección; la validación nueva solo cubre ids mal formados y políticas desconocidas.

**Commits.**
- `6a4f2cc` Políticas: las aceptaciones se paginan en el servidor y el CSV sale de la API
- `1354ff8` Interfaz: «Aceptación de políticas» pagina con el total del servidor y descarga el CSV de la API
- Docs: este registro, la nota de la auditoría de seguridad y PROJECT_MEMORY

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand`:
  - `tests/admin/admin.policy-acceptances.test.ts` es nuevo y pasa **5/5**. Comprueba que solo entra el administrador (también al CSV); el total y la paginación; «solo vigentes» en la consulta, sin colar la v1.0 de otra política; el filtro por usuario; `page=abc`; la lista vacía sin versiones vigentes; los 400; y que el CSV trae todas las filas del filtro con `=HYPERLINK` neutralizado.
  - `admin.compliance`, `security/admin.errors` y `security/route-auth-map`: OK (la ruta nueva del CSV da 401 sin sesión, como exige el mapa). En total, 4 suites y 22 tests. La primera tanda tuvo un fallo en el test nuevo: esperaba mi código de error y respondía antes `rejectMongoOperators`. Se corrigió el test, no el código.
- Frontend: `lint` sin errores y `build` OK. `npm --prefix frontend test`: **67 ficheros y 282 tests OK** (antes 280). `AdminCompliancePage.test.tsx` pasa de 3 a 5 casos: CSV pedido al servidor con los filtros, error del CSV leído del Blob, y paginación con vuelta a la página 1 al cambiar el filtro.
- Capturas con Playwright y la API simulada (137 aceptaciones), en `/tmp/ra-shots79`, a 1280 y 390 px: pie con «1–25 de 137 aceptaciones» y «Página 1 de 6». El ancho del documento mide 1280 y 390 (sin desbordar).
- **GitNexus.** `impact` de `listPolicyAcceptances` y `AdminCompliancePage`: LOW. `detect_changes`: riesgo bajo, sin flujos afectados.

**Qué queda.**
- El CSV de aceptaciones, el de eventos y el de cumplimiento no tienen tope de filas (el de pistas de firma corta en 5000). Con cientos de miles de filas convendría transmitirlos por partes (stream).
- Los CSV siguen con cabeceras en inglés.
- `parseDateRange` mezcla hora local y UTC (ronda 78).
- Pendientes anteriores: `AdminUsersPage` y `AdminTenantProPage` con tablas en línea, `/api/verification` en la lista de rutas públicas, `pro/Profile`, `.auth-input` frente a `.ra-input` y fotos externas en los anuncios.

**Siguiente mejora propuesta.** Interfaz: `AdminUsersPage` y `AdminTenantProPage` con el sistema 2026 (`PageHeader`, `Card`, `Badge`, tabla con `--ra-line`), revisadas con capturas. Si se prefiere backend: montar `/api/verification` detrás de `authenticate` y sacarla de la lista de rutas públicas.

### Ronda 80 — 2026-10-16 04:50

**Qué y por qué.** La ronda 79 proponía dos cosas: montar `/api/verification` detrás de `authenticate` y pasar a 2026 las pantallas de usuarios y Tenant PRO. Antes de la apariencia, la revisión de Tenant PRO destapó un flujo roto: **el administrador aprobaba la solvencia sin poder ver los justificantes**. Se guardan cifrados y no había ninguna ruta para leerlos. Por eso este lote es verificación, el backend de Tenant PRO y su pantalla. `AdminUsersPage` queda para la siguiente.

1. **`/api/verification`** (`src/routes/verification.routes.ts`).
   - `approve`, `reject` y `dev/verify` no pasaban por `authenticate`. `requireAdmin` no encontraba `req.user`, así que respondían 403 a todos, también al administrador, y el mapa de sesión las tenía como públicas.
   - Ahora `router.use(authenticate)` va delante de todas las rutas: sin sesión, 401.
   - Un id mal formado da 400 `invalid_user_id` y una cuenta que no existe, 404 `user_not_found`. Antes se creaba un registro suelto con `upsert`.
   - `notes` solo admite texto, con un máximo de 1000 caracteres.
   - Las tres rutas salen de la lista de públicas de `route-auth-map.test.ts`.
2. **Revisión Tenant PRO, backend** (`src/routes/admin.tenantPro.routes.ts`).
   - Nuevo `GET /api/admin/tenant-pro/:userId/docs/:docId`. Descifra al vuelo, reconoce PDF, PNG y JPEG por la cabecera y responde `inline` con `no-store` y `nosniff`. Un documento purgado da 410 `doc_purged`.
   - Decisión validada:
     - `decision` distinto de `approved`/`rejected` contaba como rechazo; ahora da 400 `invalid_decision`;
     - aprobar sin renta dejaba 0 € y «mil» daba 500; ahora se exige de 1 a 100.000 (400 `invalid_max_rent`);
     - un segundo clic reescribía la decisión ya tomada; ahora da 409 `not_pending`;
     - un id mal formado daba 500; ahora 400.
   - La lista de pendientes ya no envía el nombre del fichero cifrado, el hash ni el historial de purgas. Trae nombre, fecha de alta y si cada documento sigue disponible, ordenada de la más antigua a la más reciente.
3. **«Revisión Tenant PRO», interfaz** (`AdminTenantProPage.tsx`). Antes era una tabla con estilos en línea, botones verde, rojo y negro, tipos en crudo («nomina»), «Max rent» y un panel lateral que repetía lo mismo. Ahora:
   - cada solicitud es una `Card` con nombre, correo, fecha de alta y un aviso si falta el consentimiento;
   - los documentos salen con su nombre en español y su fecha. «Abrir» los muestra en `ui/Modal` (PDF o imagen, con «Descargar»), y los ya borrados salen como «Eliminado»;
   - a la derecha van «Renta máxima validada» (€/mes), Aprobar y Rechazar (pide confirmación, porque avisa por correo) y «Eliminar documentación»;
   - aprobar sin cifra se explica sin llamar a la API, y los errores salen en español; si la solicitud ya estaba resuelta, la lista se recarga;
   - además: `PageHeader` con «Actualizar», búsqueda por nombre o correo, `ErrorCard` con «Reintentar» y lista vacía.

**Commits.**
- `a85fdb3` Verificación: todas las rutas de /api/verification piden sesión y el administrador ya puede aprobar y rechazar
- `655fd92` Tenant PRO: el administrador puede abrir los documentos que revisa y la decisión se valida
- `495ecf0` Interfaz: «Revisión Tenant PRO» con el sistema 2026 y los documentos a la vista
- Docs: este registro, la nota en `auditoria-seguridad-2026-10-05.md`, PROJECT_MEMORY y «Para Jorge»

**Verificación (resultados reales).**
- Backend: `npx tsc --noEmit` sin errores. Jest `--runInBand`:
  - `tests/verification`, `security/route-auth-map`, `security/route-protection` y `security/admin.errors`: **4 suites y 24 tests OK** (luego el test de verificación se reescribió en un caso y volvió a pasar, 3/3);
  - `tests/tenantPro`: **3 suites y 12 tests OK**, entre ellos el nuevo `admin.review.test.ts` (4 casos: lista sin datos internos, documento descifrado con su tipo y 410 si se purgó, validación de la decisión con 409 al segundo clic, rechazo sin renta). El flujo antiguo con cabeceras de prueba sigue pasando.
- Frontend: `lint` sin errores y `build` OK. `npm --prefix frontend test`: **68 ficheros y 287 tests OK** (antes 282). `AdminTenantProPage.test.tsx` es nuevo, con 5 casos.
- Capturas con Playwright y la API simulada (`/tmp/ra-shots80`), a 1280 y 390 px, sin desbordar (ancho del documento: 1280 y 390).
  - La primera tanda tenía «1200» de ejemplo en la renta, que parecía un valor ya escrito, y en móvil cortaba la fecha de alta. Se quitó el ejemplo y el correo y la fecha van en líneas separadas.
  - El PDF sale en blanco en la captura porque Chromium sin interfaz no tiene visor de PDF; el `iframe` recibe el `blob:` (lo comprueba el test).
- **GitNexus.** `impact` de `AdminTenantProPage`: LOW. `detect_changes`: riesgo bajo en los dos commits de backend. En el de interfaz, riesgo medio, solo por los tres flujos de esta pantalla (`ListPendingTenantPro`, `DecideTenantPro`, `PurgeTenantPro`).

**Qué queda.**
- `AdminUsersPage` sigue con estilos en línea, roles en inglés («Tenant», «Landlord») y un CSV montado en el navegador solo con la página visible. Además, la búsqueda no vuelve a la página 1 y un error al cargar no se muestra.
- No hay pantalla para el flujo manual de `/api/verification` (DNI subido por el usuario). Hoy la verificación real va por `/api/kyc`; si el flujo manual no se usa, conviene retirarlo.
- El nombre del fichero cifrado de Tenant PRO lleva el nombre original del documento (`<fecha>_<nombre>.bin`), que puede incluir el nombre de la persona. Convendría un nombre aleatorio.
- Pendientes anteriores: CSV sin tope de filas ni cabeceras en español, `parseDateRange` con hora local y UTC mezcladas, `pro/Profile`, `.auth-input` frente a `.ra-input` y fotos externas en los anuncios.

**Siguiente mejora propuesta.** `AdminUsersPage` con el sistema 2026: roles en español con `Badge`, búsqueda que vuelve a la página 1 (con espera al teclear), error visible con «Reintentar» y CSV generado en el servidor con `csvRows`. Si se prefiere backend: nombre aleatorio para los ficheros de Tenant PRO.

