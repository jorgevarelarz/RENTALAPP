# RentalApp: preparación para apertura comercial

Fecha: 1 de octubre de 2026. Revisión del checkout canónico `rentalapp 2.3`, rama `feat/precio-sugerido`.

## Diagnóstico

La aplicación ya tiene un despliegue accesible: `/health` y `/ready` responden 200 por HTTPS y Mongo conectado. Esto acredita disponibilidad, no el funcionamiento completo de firmas, cobros, recuperación de cuenta o permisos. La revisión es de código y comprobaciones locales; no es una auditoría exhaustiva ni una certificación de proveedores reales.

Hay infraestructura, controles de acceso y pruebas que conviene conservar. El backlog anual generado de 10.500 tareas no es el criterio de lanzamiento. Este documento recoge 50 acciones concretas, con prioridad y criterio verificable.

Estados: **confirmado** = problema observado en código o herramientas; **validar** = comprobación pendiente, no fallo demostrado; **local** = corregido aquí, aún sin desplegar; **externo** = requiere configuración, decisión o prueba de un servicio real.

## P0: antes de abrir firmas y cobros a clientes

| ID | Estado | Acción | Evidencia y criterio de cierre |
| --- | --- | --- | --- |
| 01 | local | Autenticar todos los callbacks de firma antes de consultar o modificar contratos. | `contract.signature.controller.ts`: el webhook público no llamaba al verificador existente. Se añade HMAC sobre bytes originales y rechazo sin secreto fuera de mocks locales. Pruebas de firma ausente, incorrecta y cuerpo manipulado, sin efectos en contrato/auditoría/eventos. |
| 02 | externo | Validar la autenticación y el formato de eventos con Signaturit real. | El contrato HMAC `x-signature` existe en los tests del proyecto; su soporte por el proveedor no está acreditado. Ensayar una firma completa. Si no firma eventos así, verificar el estado por API autenticada o usar un mecanismo oficialmente soportado antes de habilitarlo. |
| 03 | confirmado | Eliminar o deshabilitar las firmas ficticias en producción. | `signature.service.ts:initSignature` genera enlaces `sign.example.com`; `docusign.provider.ts` fabrica identificadores y un PDF de ejemplo. Cierre: ningún proveedor seleccionado como real devuelve datos simulados. |
| 04 | confirmado | Hacer reintentables los webhooks cuando falla la transición o la persistencia. | El webhook inserta `ProcessedEvent` antes de completar el procesamiento; una repetición puede salir como duplicada tras un fallo parcial. Cierre: fallo inducido + reintento completa exactamente una operación. |
| 05 | confirmado | Evitar auditorías duplicadas al repetir un webhook. | `recordSignatureEvent` ocurre antes de comprobar la deduplicación. Cierre: el mismo evento recibido dos veces produce una sola evidencia. |
| 06 | confirmado | Construir el enlace de recuperación con el dominio configurado. | `auth.controller.ts:requestPasswordReset` contiene `https://frontend/reset`. Cierre: email con URL HTTPS de la aplicación, token de un uso y prueba del recorrido completo. |
| 07 | confirmado / externo | Asegurar entrega y seguimiento del correo transaccional. | `utils/email.ts` registra y devuelve éxito si falta SMTP o falla el envío. Revisar la configuración real, probar recuperación/invitación/recibo y hacer visible el fallo con reintento seguro. |
| 08 | confirmado | Actualizar las dependencias vulnerables de producción. | `npm audit --omit=dev`: raíz 8 avisos (4 altos, 4 moderados); frontend 9 (6 altos, 2 moderados, 1 bajo); portal 2 moderados. Son recuentos por paquete, no vulnerabilidades únicas ni prueba de explotación. Resolver por compatibilidad y volver a probar, sin `--force` indiscriminado. |
| 09 | confirmado | Endurecer la validación de configuración de producción. | `loadEnv` continúa tras fallar el esquema, admite nombres de proveedores desconocidos y permite discrepancias de mayúsculas. Cierre: configuración inválida impide arrancar, valores reales soportados sí arrancan, y tests de ambos casos. |
| 10 | confirmado | Reparar el acceso administrativo a aprobar/rechazar verificaciones. | `verification.routes.ts` usa `requireAdmin` sin `authenticate` en esas rutas, montadas públicamente. Cierre: admin autenticado puede operar; resto recibe 401/403. |
| 11 | validar | Completar el recorrido de KYC hasta habilitar las operaciones del usuario. | El webhook de Identity actualiza `IdentityCheck`, mientras `requireVerified` consulta el token o `Verification`. Verificar y conectar ambos estados; un resultado fallido nunca verifica al usuario. |
| 12 | validar | Comprobar autorización por recurso en firmas, contratos, pagos y archivos. | Revisar especialmente `initiateSignature`/`getSignature`: sus servicios buscan por ID sin comprobar la pertenencia. Cierre: matriz de dos propietarios, dos inquilinos, agencia, admin y tercero; ninguna lectura/escritura cruzada. |
| 13 | validar / externo | Ejecutar pago, fallo, reintento, devolución y conciliación con Stripe. | Los E2E actuales simulan el proveedor. Comprobar importe/moneda/contrato, idempotencia y contabilidad ante eventos duplicados o desordenados; empezar en sandbox. |
| 14 | confirmado / externo | Sacar los backups del VPS y restaurar también los documentos. | El script diario guarda Mongo en el mismo servidor, con rotación de 7 días; Compose persiste uploads y storage aparte. Cierre: copia cifrada externa de BD y documentos, claves recuperables y restauración aislada comprobada. |

## P1: antes del piloto con usuarios reales

| ID | Estado | Acción | Evidencia y criterio de cierre |
| --- | --- | --- | --- |
| 15 | validar | Revisar caducidad, cierre e invalidación de sesiones. | JWT de 7 días y logout local en `services/auth.ts`. Cierre: bloqueo de cuenta/cambio de contraseña invalida acceso según una política explícita. |
| 16 | confirmado | Planificar sesión en cookie HttpOnly con protección CSRF. | El token se guarda en `localStorage`. Cambiar backend y ambos clientes juntos, con pruebas de login, expiración, logout y OAuth; no mover sólo el almacenamiento. |
| 17 | validar | Revisar contraseñas y abuso del reset. | Registro/reset admiten 6 caracteres; el límite IP está en login/register/request-reset, no en reset. Cierre: política acordada, límites y pruebas sin enumeración de cuentas. |
| 18 | validar | Comprobar la revocación de verificación y roles en sesiones existentes. | `requireVerified` acepta inmediatamente `user.isVerified` del JWT. Cierre: una verificación revocada o un cambio de privilegios no conserva permisos antiguos indefinidamente. |
| 19 | validar | Revisar subidas y descarga privada por tipo de documento. | `/uploads/contracts` está bloqueado, pero `/uploads` es estático. Inventariar todas las rutas de escritura; probar contenido real, tamaño, extensión, traversal y permisos. |
| 20 | validar | Completar errores asíncronos en rutas Express. | Hay handlers `async` directos, incluidos webhooks, y Express 4. Cierre: un fallo de BD/proveedor devuelve respuesta controlada y deja el evento reintentable. |
| 21 | confirmado | Añadir timeout a solicitudes externas y smoke. | `signaturitFetch` y `scripts/smoke_production.js` usan `fetch` sin timeout. Cierre: un proveedor que no responde termina en tiempo acotado y muestra error recuperable. |
| 22 | confirmado | Separar sandbox y producción de firma en CSP y configuración. | La CSP permite dominios `*.sandbox.signaturit.com`; el cliente de firma usa sandbox por defecto. Cierre: navegación real con proveedor elegido sin bloqueos CSP ni mezcla de entornos. |
| 23 | validar | Garantizar transiciones y recibos seguros bajo concurrencia. | `transitionContract` hace lectura y guardado; el job hace consulta y creación pese al índice único de recibos. Probar ejecuciones concurrentes y que un conflicto no detenga el resto del lote. |
| 24 | confirmado | Definir fecha de vencimiento y zona horaria del recibo. | `runRentGeneration` calcula `dueDate` pero no lo guarda; usa mes local del servidor. Cierre: regla de negocio explícita, vencimiento persistido y pruebas de fin de mes. |
| 25 | confirmado | Distinguir cobro de fianza de depósito ante la autoridad. | `depositToAuthority` sólo simula y espera. Cierre: estado y evidencia reales de tramitación o proceso manual operativo; no presentarlo como completado automáticamente. |
| 26 | validar | Revisar precisión de importes, comisiones y redondeo. | `depositToEscrow` convierte con `amount * 100`. Cierre: importes válidos en céntimos y conciliación de céntimos límite, devoluciones y comisiones. |
| 27 | validar | Verificar permisos y aislamiento del portal institucional. | Portal separado, scope institucional y endpoints dedicados. Cierre: institución A no puede leer datos de B ni acceder a PII fuera del alcance previsto. |
| 28 | validar | Revisar reintentos de comisiones y pagos a agencias. | Hay `partner-earnings:retry` y modelos de ganancias. Cierre: repetir el trabajo no duplica transferencias y los fallos quedan conciliables. |
| 29 | confirmado | Hacer que `SMS_PROVIDER=disabled` desactive el envío de verdad. | `notification.ts` crea cliente Twilio si hay credenciales y no es `mock`, incluso con `disabled`. Cierre: prueba que credenciales presentes + disabled no envía SMS. |
| 30 | validar | Establecer retención efectiva de eventos y documentos. | Hay servicio de limpieza de eventos y job de documentos; verificar que se ejecutan y respetan el plazo acordado. No purgar evidencias contractuales por una regla genérica. |
| 31 | validar | Revisar qué información personal aparece en logs. | Se registran destinatarios y errores de proveedores. Cierre: redacción de tokens/datos sensibles y acceso/retención definidos. |
| 32 | validar / externo | Activar alertas de disponibilidad, disco, backups y proveedores. | Health, readiness y smoke ya existen. Cierre: una alerta de prueba llega al responsable con procedimiento de actuación. |
| 33 | validar | Comprobar renovación TLS y rollback del despliegue. | HTTPS funciona en esta revisión; no se inspeccionó el programador de renovación ni el servidor. Cierre: renovación comprobada y versión anterior recuperable sin pérdida de datos. |
| 34 | confirmado | Ejecutar E2E en CI como puerta de lanzamiento. | CI ejecuta backend, frontend y builds, pero no `test:e2e`. Reusar los E2E existentes con BD desechable y proveedores simulados. |
| 35 | confirmado | Estabilizar el arranque de Mongo en tests sin ocultar fallos funcionales. | Primera ejecución local sufrió timeout de MongoMemoryServer a 10 s; diagnóstico aislado arrancó correctamente. Cierre: ejecutar suite secuencial completa y estudiar recursos/arranque si se repite. |
| 36 | validar | Probar recorrido real en navegador móvil y escritorio. | Las pruebas HTTP no acreditan UI. Cierre: registro, verificación, anuncio, solicitud, contrato, firma, pago e incidencia con captura de consola y errores. |

## P2: calidad del piloto y operación continua

| ID | Estado | Acción | Evidencia y criterio de cierre |
| --- | --- | --- | --- |
| 37 | confirmado | Sustituir el lint ficticio por una comprobación real. | `frontend/package.json` imprime `Lint pendiente`. Reusar tooling disponible o retirar la falsa señal verde hasta configurarlo. |
| 38 | confirmado | Añadir typecheck al portal institucional. | Su build sólo ejecuta Vite. Cierre: CI falla ante un error TypeScript deliberado y el build válido pasa. |
| 39 | validar | Revisar accesibilidad de formularios, modales y pagos. | Prueba de teclado, foco, etiquetas, mensajes de error y contraste; no se ha realizado una auditoría visual en esta sesión. |
| 40 | validar | Revisar carga, error, vacío y doble envío de acciones críticas. | Cierre: usuario entiende qué ocurrió y un doble clic no duplica solicitudes, firmas o pagos. |
| 41 | confirmado | Quitar pantallas de testing de la navegación de producción. | `/testing/inbound` sigue declarado como ruta pública del frontend aunque su API se desactiva en producción. Cierre: ruta oculta o inaccesible fuera del entorno de pruebas. |
| 42 | validar | Completar publicación de inmuebles y edición de disponibilidad. | Cierre: anuncio borrador no se publica por accidente; filtros/precio/fotos/retirada quedan coherentes tras recarga. |
| 43 | validar | Probar mensajería, citas, incidencias y adjuntos entre usuarios reales de prueba. | Cierre: participantes correctos, historial persistido, estados y notificaciones verificables. |
| 44 | externo | Completar Apple OAuth o mantenerlo oculto. | Memoria previa indica credenciales pendientes. Cierre: sólo aparecen proveedores configurados; probar callback, cancelación y cuenta ya existente. |
| 45 | validar / externo | Revisar los textos y operaciones de privacidad con el responsable correspondiente. | Existen páginas y textos legales. Verificar identidad del titular, proveedores, consentimientos, solicitudes de acceso/borrado y plazos; no se emite aquí una conclusión jurídica. |
| 46 | validar | Revisar reglas territoriales y actualización de referencias de renta. | Hay importación IGVS pendiente ajena a este cambio. Validar fuente, vigencia, incertidumbre y copy; una estimación de mercado no debe presentarse como límite legal. |
| 47 | validar | Medir consultas lentas y paginación con datos representativos. | Probar listado, chat, contratos y administración; añadir índices sólo con evidencia de consulta lenta. |
| 48 | validar | Medir rendimiento web en dispositivos representativos. | Hay división por rutas. Usar mediciones de carga e interacción para elegir mejoras de imágenes, caché y bundles. |
| 49 | validar | Definir soporte y resolución operativa de incidencias. | Cierre: responsable, canal, tiempos y procedimientos para cuenta bloqueada, pago duplicado, firma fallida y restauración. |
| 50 | validar | Hacer una liberación trazable y un piloto pequeño. | Integrar cambios revisados, identificar commit/imagen desplegados, ejecutar smoke y flujo completo, acordar criterio de parada y rollback. |

## Primer cambio ejecutado

- Dos archivos de aplicación: verificación HMAC antes de efectos en callbacks de firma; la entrada pública DocuSign reutiliza su verificador; una firma de longitud incorrecta devuelve rechazo en vez de lanzar `RangeError`.
- `SIGNATURE_WEBHOOK_SECRET` es el nombre canónico; `SIGN_WEBHOOK_SECRET` se conserva como alias de compatibilidad. Sólo se permiten avisos sin secreto para proveedor mock fuera de producción.
- Las nuevas pruebas usan el servidor Express real y Mongo temporal. Las 8 fallaron antes del cambio, reproduciendo la ausencia de autenticación y el error de longitud de DocuSign.
- **Límite operativo:** este cambio es una contención de seguridad local, no una certificación de la integración Signaturit. No desplegarlo como firma funcional hasta completar el punto 02; de lo contrario, los callbacks legítimos que no usen ese contrato serán rechazados.
- No se cambiaron credenciales, datos reales, despliegues, ni los cambios pendientes del importador IGVS/E2E.

## Referencia del proveedor

Se consultó la [documentación oficial de Signaturit v3](https://docs.signaturit.com/api/v3), que describe `events_url` y la consulta autenticada de solicitudes. La página revisada no documenta el contrato HMAC `x-signature` del proyecto; no se presupone que lo envíe el proveedor.

## Orden de trabajo

1. Cerrar autenticación + interoperabilidad + autorización de firma (01–05, 12).
2. Recuperación de cuenta y entrega de correo (06–07), con dependencias y configuración (08–09).
3. KYC, cobros y recuperación de datos (10–14).
4. Piloto cerrado después de superar los P0 y las comprobaciones P1 aplicables; P2 se prioriza por uso y mediciones.

Pendiente incorporar el resultado final de regresión de esta sesión.
