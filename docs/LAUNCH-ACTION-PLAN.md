# Launch Action Plan

| Area | Task | Owner (suggested) | Target Date | Status |
| --- | --- | --- | --- | --- |
| Configuración | Completar secretos en vault (staging/prod) usando `deployment/env/*.template` | DevOps | DD/MM | ☐ |
| Configuración | Cargar `.env` locales para QA (sin secretos) | QA Lead | DD/MM | ☐ |
| Integraciones | Verificar Stripe (intent + webhook) en staging | Backend + QA | DD/MM | ☐ |
| Integraciones | Verificar SMTP (correo real) en staging | Backend | DD/MM | ☐ |
| Integraciones | Verificar Twilio (SMS) | Backend | DD/MM | ☐ |
| Integraciones | Validar DocuSign sandbox / o confirmar `mock` | Product + Legal | DD/MM | ☐ |
| Infraestructura | Provisionar MongoDB gestionado + backups | DevOps | DD/MM | ☐ |
| Infraestructura | Montar volumen `storage/tenant-pro` (staging/prod) | DevOps | DD/MM | ☐ |
| Infraestructura | Desplegar backend con HTTPS | DevOps | DD/MM | ☐ |
| Infraestructura | Desplegar frontend (CDN/NGINX) apuntando al backend | DevOps | DD/MM | ☐ |
| Observabilidad | Activar scraping `/metrics` + dashboards | Observability | DD/MM | ☐ |
| Observabilidad | Configurar alertas (uptime, 5xx, Stripe/SMTP fallos) | Observability | DD/MM | ☐ |
| QA | Smoke test completo en staging (ver checklist release) | QA | DD/MM | ☐ |
| Seguridad/Legal | Revisar textos legales finales y versionar en admin | Legal | DD/MM | ☐ |
| Seguridad | Ejecutar escaneo OWASP/penetration básico | Security | DD/MM | ☐ |
| Soporte | Definir plan de soporte/on-call + FAQ | Support Lead | DD/MM | ☐ |
| Comunicación | Preparar release notes y GO/NO-GO meeting | Product | DD/MM | ☐ |

> Actualiza propietarios/fechas en este documento o en tu gestor de tareas. Mantén sincronizado con `docs/RELEASE-CHECKLIST.md`.
