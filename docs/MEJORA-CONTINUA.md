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
