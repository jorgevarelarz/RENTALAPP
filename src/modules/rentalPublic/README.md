# Rental Public (MVP)

Objetivo inicial
- Registrar historial de precios de alquiler por vivienda.
- Detectar zonas tensionadas.
- Evaluar cumplimiento (cumple / riesgo) en creacion de contratos.

Regla MVP (es-housing:v1)
- Si `isTensionedArea=true` y `newRent > previousRent` => `status = risk`, reason `RENT_INCREASE_TENSIONED_AREA`.
- En otro caso => `status = compliant`.
- `non_compliant` reservado para fase 2.

Extensiones futuras
- Topes y formula normativa por region.
- Consolidacion de zonas con codigos oficiales.
- Reglas por tipo de contrato o periodo.
