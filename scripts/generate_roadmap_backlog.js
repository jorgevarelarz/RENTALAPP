const fs = require('fs');
const path = require('path');

const areas = [
  ['landing', 'EPIC-LANDING', 'public', 'Landing/SEO/conversión', { P0: 60, P1: 180, P2: 240, P3: 120 }],
  ['auth', 'EPIC-AUTH', 'public', 'Auth/onboarding', { P0: 90, P1: 160, P2: 140, P3: 60 }],
  ['tenant', 'EPIC-TENANT', 'tenant', 'Tenant', { P0: 100, P1: 250, P2: 220, P3: 80 }],
  ['landlord', 'EPIC-LANDLORD', 'landlord', 'Landlord', { P0: 120, P1: 260, P2: 240, P3: 80 }],
  ['pro', 'EPIC-PRO', 'pro', 'Pro/servicios', { P0: 70, P1: 180, P2: 180, P3: 70 }],
  ['admin', 'EPIC-ADMIN', 'admin', 'Admin/soporte', { P0: 150, P1: 260, P2: 240, P3: 100 }],
  ['agency', 'EPIC-AGENCY', 'agency', 'Agency', { P0: 60, P1: 160, P2: 170, P3: 60 }],
  ['institution', 'EPIC-INSTITUTION', 'institution_viewer', 'Institution/compliance', { P0: 80, P1: 160, P2: 150, P3: 60 }],
  ['contracts', 'EPIC-CONTRACTS', 'tenant,landlord,admin', 'Contratos/firma/PDFs', { P0: 150, P1: 240, P2: 190, P3: 70 }],
  ['payments', 'EPIC-PAYMENTS', 'tenant,landlord,admin', 'Pagos/Stripe/escrow', { P0: 150, P1: 200, P2: 140, P3: 60 }],
  ['tickets', 'EPIC-TICKETS', 'tenant,landlord,pro', 'Tickets/incidencias', { P0: 80, P1: 160, P2: 150, P3: 60 }],
  ['chat', 'EPIC-CHAT-NOTIFICATIONS', 'all', 'Chat/notificaciones', { P0: 60, P1: 140, P2: 140, P3: 60 }],
  ['ai', 'EPIC-AI', 'all', 'IA/automatización', { P0: 30, P1: 120, P2: 180, P3: 70 }],
  ['ux', 'EPIC-UX', 'all', 'UX/UI/accesibilidad', { P0: 100, P1: 240, P2: 220, P3: 90 }],
  ['security', 'EPIC-SECURITY', 'all', 'Seguridad/legal/GDPR', { P0: 160, P1: 170, P2: 120, P3: 50 }],
  ['backend', 'EPIC-BACKEND', 'internal', 'Backend arquitectura', { P0: 120, P1: 230, P2: 220, P3: 80 }],
  ['frontend', 'EPIC-FRONTEND', 'internal', 'Frontend arquitectura', { P0: 90, P1: 200, P2: 190, P3: 70 }],
  ['tests', 'EPIC-TESTS', 'internal', 'Tests/CI/observabilidad', { P0: 120, P1: 200, P2: 170, P3: 60 }],
  ['performance', 'EPIC-PERFORMANCE', 'all', 'Performance/SEO técnico', { P0: 60, P1: 120, P2: 120, P3: 50 }],
  ['ops', 'EPIC-OPS', 'internal', 'Operaciones/documentación', { P0: 40, P1: 90, P2: 80, P3: 40 }],
];

const templates = {
  landing: ['Optimizar conversión de landing', 'Añadir contenido SEO', 'Mejorar CTA público', 'Crear bloque de confianza'],
  auth: ['Mejorar onboarding por rol', 'Endurecer flujo de autenticación', 'Pulir formulario de acceso', 'Añadir estado de verificación'],
  tenant: ['Mejorar dashboard tenant', 'Pulir flujo de búsqueda', 'Añadir mejora Tenant PRO', 'Mejorar pagos tenant'],
  landlord: ['Mejorar dashboard landlord', 'Pulir gestión de propiedades', 'Añadir alerta operativa landlord', 'Mejorar gestión de candidatos'],
  pro: ['Mejorar panel profesional', 'Pulir marketplace de servicios', 'Añadir mejora de presupuestos', 'Mejorar reputación profesional'],
  admin: ['Mejorar panel admin', 'Añadir herramienta de soporte', 'Pulir moderación interna', 'Mejorar auditoría operativa'],
  agency: ['Mejorar cartera agency', 'Añadir permiso delegado', 'Pulir reporte de agencia', 'Mejorar invitaciones agency'],
  institution: ['Mejorar portal institucional', 'Pulir dashboard compliance', 'Añadir export institucional', 'Mejorar métricas agregadas'],
  contracts: ['Mejorar flujo de contrato', 'Pulir firma digital', 'Añadir mejora de PDF', 'Mejorar timeline legal'],
  payments: ['Mejorar Stripe Connect', 'Pulir recibos automáticos', 'Añadir control de impagos', 'Mejorar webhook financiero'],
  tickets: ['Mejorar flujo de incidencia', 'Pulir presupuesto de profesional', 'Añadir cierre con evidencia', 'Mejorar matching de servicios'],
  chat: ['Mejorar chat por contexto', 'Añadir notificación in-app', 'Pulir email transaccional', 'Mejorar preferencia de comunicación'],
  ai: ['Añadir asistencia IA contextual', 'Mejorar resumen automático', 'Añadir scoring explicable', 'Detectar anomalía operativa'],
  ux: ['Pulir responsive mobile', 'Mejorar accesibilidad', 'Unificar estado vacío', 'Mejorar componente visual'],
  security: ['Endurecer privacidad', 'Mejorar control de acceso', 'Reducir exposición de datos', 'Añadir auditoría de seguridad'],
  backend: ['Extraer servicio backend', 'Normalizar respuesta API', 'Añadir validación de payload', 'Mejorar idempotencia'],
  frontend: ['Consolidar layout frontend', 'Unificar navegación por rol', 'Añadir componente reutilizable', 'Reducir deuda de estado'],
  tests: ['Añadir test crítico', 'Mejorar smoke test', 'Cubrir flujo por rol', 'Añadir observabilidad'],
  performance: ['Optimizar carga frontend', 'Mejorar métrica web vital', 'Reducir latencia API', 'Pulir SEO técnico'],
  ops: ['Actualizar runbook', 'Añadir control de backup', 'Mejorar rollback', 'Documentar operación'],
};

const acceptance = {
  P0: 'No rompe producción, seguridad, datos, dinero ni firma; incluye verificación automática o manual documentada.',
  P1: 'Mejora un flujo principal y queda visible para el rol afectado con estado de éxito/error claro.',
  P2: 'Reduce fricción, deuda o tiempo operativo sin cambiar contratos públicos innecesariamente.',
  P3: 'Pulido verificable, sin regresión visual ni funcional en rutas críticas.',
};

function releaseFor(index) {
  return `Sprint ${String((index % 26) + 1).padStart(2, '0')}`;
}

const tasks = [];
let id = 1;

for (const [key, epic, role, area, counts] of areas) {
  for (const priority of ['P0', 'P1', 'P2', 'P3']) {
    for (let i = 0; i < counts[priority]; i += 1) {
      const title = templates[key][i % templates[key].length];
      tasks.push({
        id: `RA-${String(id).padStart(5, '0')}`,
        epic,
        area,
        priority,
        role,
        title: `${title} #${i + 1}`,
        acceptance: acceptance[priority],
        release: releaseFor(id - 1),
        status: 'todo',
      });
      id += 1;
    }
  }
}

const outDir = path.resolve(process.cwd(), 'docs/roadmap');
fs.mkdirSync(outDir, { recursive: true });

const summary = areas.map(([, epic, role, area, counts]) => ({
  epic,
  area,
  role,
  total: Object.values(counts).reduce((sum, value) => sum + value, 0),
  priorities: counts,
}));

fs.writeFileSync(
  path.join(outDir, 'backlog.json'),
  JSON.stringify({ generatedAt: 'static', total: tasks.length, summary, tasks }, null, 2) + '\n',
);

fs.writeFileSync(
  path.join(outDir, 'README.md'),
  `# RentalApp Roadmap Backlog\n\n` +
    `Backlog maestro generado para el plan anual ampliado.\n\n` +
    `- Total tareas: ${tasks.length}\n` +
    `- Épicas: ${summary.length}\n` +
    `- Sprints: 26\n` +
    `- Fuente: \`scripts/generate_roadmap_backlog.js\`\n\n` +
    `Regenerar:\n\n` +
    `\`\`\`bash\nnpm run roadmap:generate\n\`\`\`\n\n` +
    `Validar:\n\n` +
    `\`\`\`bash\nnpm run roadmap:check\n\`\`\`\n`,
);

console.log(`Generated ${tasks.length} roadmap tasks in ${outDir}`);
