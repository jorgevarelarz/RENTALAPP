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
