# Revisión de código: firma con Firma.dev, HMAC de webhooks y referencias de Galicia

- Fecha: 2026-10-05
- Agente: Claude Code
- Alcance revisado: merge `7051df5` ("Consolidate parallel work: Firma.dev signing, webhook HMAC, Galicia references").
- Rama de corrección: `claude/practical-planck-wizknd`.

Estado: `pendiente`, `corregido` (con test cuando aplica) o `decisión` (necesita que Jorge elija cómo debe funcionar).

## Graves

| # | Archivo | Problema | Estado |
|---|---------|----------|--------|
| 1 | `src/services/signature.service.ts` / `contract.signature.controller.ts` | `POST /:id/signature/init` solo comprueba el rol, no que quien llama sea parte del contrato. Con Firma devuelve los enlaces reales de las dos partes: un arrendador cualquiera crea un sobre de pago sobre un contrato ajeno y obtiene el enlace del inquilino. `GET /:id/signature/status` tampoco comprueba la parte y devuelve `recipientUrls`. | corregido: solo el arrendador del contrato o un admin; cada parte recibe solo su enlace; `signature/status` exige ser parte y filtra enlaces |
| 2 | `signature.service.ts` (`ensureFirmaSignature`) | En un contrato ya firmado (`signature.status='completed'`), volver a llamar a `sign-session` crea un sobre nuevo, reenvía emails y sobrescribe `envelopeId`/estado/enlaces; deja de verse el PDF firmado. | corregido: 409 `contract_already_signed` |
| 3 | `contract.signature.controller.ts` (`firmaWebhook`) | Un evento tardío no final (`viewed`, `recipient.signed`) tras `completed` vuelve a poner `signature.status='sent'`. | corregido: un estado `completed` no se sobrescribe |
| 4 | `contract.signature.controller.ts` (`firmaWebhook`) | Las llamadas a BD después de `ProcessedEvent.create` están fuera de try/catch: rechazo no gestionado, sin respuesta, y el evento queda marcado como procesado, así que el reintento de Firma se ignora y el contrato nunca pasa a `signed`. | corregido: todo el procesamiento en try/catch; si falla, 500 y se libera el evento |
| 5 | `signature.service.ts` (`ensureFirmaSignature`) | Sin bloqueo: dos llamadas simultáneas crean dos sobres de pago; solo se guarda uno y las firmas del otro se pierden. | corregido: bloqueo `signature.lockedAt` (TTL 2 min); la segunda petición recibe 409 `signature_in_progress` |

## Medios

| # | Archivo | Problema | Estado |
|---|---------|----------|--------|
| 6 | `signature.service.ts` / `src/signature/firma.ts` | Si `/users` de Firma no casa el email de un firmante, se guarda el enlace vacío con estado `sent` y nunca se repara (502 en cada `sign-session`). | corregido: en la siguiente llamada se piden de nuevo los enlaces a Firma (`fetchFirmaSignerLinks`) |
| 7 | `signature.service.ts` | Solo `draft` exacto pasa a `pending_signature`; `generated` o sin estado se quedan en borrador y el webhook de completado falla (`invalid_transition`) y Firma reintenta sin fin. | corregido: se usa `normalizeContractStatus` |
| 8 | `contract.signature.controller.ts` | El evento de auditoría (cadena de hashes) se escribe antes de saber si el procesamiento sale bien; en cada reintento se duplica. Lo mismo en `signatureWebhook`, que lo escribe antes de deduplicar. | corregido: el evento de auditoría se escribe al final, solo si todo fue bien; en `signatureWebhook`, después de deduplicar |
| 9 | `contract.signature.controller.ts:191` (`signatureWebhook`) | Exige `x-signature` HMAC hex a todo proveedor salvo DocuSign. Sin confirmar si Signaturit lo envía; sin secreto fuera de producción se rechaza todo lo que no sea mock. | decisión |
| 10 | `src/controllers/contract.controller.ts` (`requestSignature`) | Con `SIGN_PROVIDER=firma`, `POST /:id/signature` del arrendador cae en el stub de Signaturit en vez de en Firma. | corregido: Jorge confirmó que el proveedor es Firma.dev; `POST /:id/signature` usa `initSignature`, y los errores 4xx ya no salen como 500 |
| 11 | `signature.service.ts` / `src/utils/pdfGenerator.ts` | El PDF con anclas sobrescribe `uploads/contracts/<id>.pdf`, cuyo hash se guardó como `contract.pdfHash`. | corregido: el PDF con anclas va a `<id>-firma.pdf` y se borra tras enviarlo |
| 12 | `src/utils/pdfGenerator.ts` | Anclas y líneas de firma en coordenadas fijas sin comprobar el final de página: pueden quedar en páginas distintas. | corregido: salto de página si el bloque de firma no cabe |

## Menores

| # | Archivo | Problema | Estado |
|---|---------|----------|--------|
| 13 | `contract.controller.ts` (`createSigningSession`) | Los errores de Firma (409 partes incompletas, errores de API) salen como 500 genérico y se registran como "Error Signaturit". | corregido: se respeta `error.status` (502 para fallos de API) |
| 14 | `scripts/import_zone_rent_reference.ts` | La validación del `ineCode` compara la región solo en minúsculas con nombres sin tildes: "Castilla y León" se rechaza. | corregido: compara sin tildes ni guiones y acepta alias (`REGION_ALIASES`) |
| 15 | `signature.service.ts` / `contract.controller.ts` | `renderClauses` duplica literalmente el bloque de `requestSignature`. | corregido: `renderClausesForSignature` compartido |

## Notas de la corrección

- #9 sigue abierto: con `SIGN_PROVIDER=firma`, la ruta genérica `/api/contracts/signature/webhook` ya no es el camino de Firma (Firma usa `/api/contracts/signature/firma`). Hay que decidir si se elimina o se deja solo para mock/tests.
- La API key de Firma.dev va en la variable de entorno `FIRMA_API_KEY` del servidor; nunca en el repo. Hace falta también `FIRMA_WEBHOOK_SECRET`.
- Tests nuevos en `tests/contracts/signature.firma.test.ts` (y ajuste en `contracts.signature.test.ts`: el arrendador ya no recibe el enlace del inquilino). **No se pudieron ejecutar en la sesión cloud** porque su red bloquea la descarga de MongoDB para `mongodb-memory-server`. Compilan (`tsc`). Hay que ejecutarlos en local o en CI antes de hacer merge.
