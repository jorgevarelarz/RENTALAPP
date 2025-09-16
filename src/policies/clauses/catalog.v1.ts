import { z, ZodTypeAny } from "zod";

export const CLAUSE_POLICY_VERSION = "1.0.0";

export interface ClauseDefinition<T extends ZodTypeAny = ZodTypeAny> {
  readonly id: string;
  readonly version: string;
  readonly label: string;
  readonly paramsSchema: T;
  readonly render: (params: z.infer<T>) => string;
}

export type ClauseDictionary = Record<string, ClauseDefinition>;

/**
 * Cláusulas base — aplican en toda España (LAU)
 */
export const CLAUSES_BASE = {
  duracion_prorroga: {
    id: "duracion_prorroga",
    version: CLAUSE_POLICY_VERSION,
    label: "Duración y prórroga tácita",
    paramsSchema: z.object({
      mesesIniciales: z.number().int().min(1).max(60),
      mesesProrroga: z.number().int().min(0).max(36),
    }),
    render: p =>
      `La duración inicial del contrato será de ${p.mesesIniciales} meses. ` +
      `Transcurrido dicho periodo, podrá prorrogarse tácitamente por periodos de ${p.mesesProrroga} meses salvo preaviso en contrario.`,
  },

  uso_vivienda: {
    id: "uso_vivienda",
    version: CLAUSE_POLICY_VERSION,
    label: "Uso exclusivo de vivienda",
    paramsSchema: z.object({
      permiteActividadProfesional: z.boolean().default(false),
    }),
    render: p =>
      p.permiteActividadProfesional
        ? "El inmueble podrá destinarse a vivienda y a actividad profesional inocua sin atención al público."
        : "El inmueble se destina a uso exclusivo de vivienda habitual. Queda prohibido cualquier uso profesional o comercial.",
  },

  mascotas: {
    id: "mascotas",
    version: CLAUSE_POLICY_VERSION,
    label: "Mascotas",
    paramsSchema: z.object({
      permitidas: z.boolean(),
      limite: z.number().int().min(0).max(3).default(0),
    }),
    render: p =>
      p.permitidas
        ? `Se permiten mascotas, hasta ${p.limite} animales, siendo el inquilino responsable de daños y limpieza.`
        : "No se permiten mascotas salvo autorización expresa y por escrito del arrendador.",
  },

  subarriendo: {
    id: "subarriendo",
    version: CLAUSE_POLICY_VERSION,
    label: "Cesión y subarriendo",
    paramsSchema: z.object({
      permitido: z.boolean().default(false),
    }),
    render: p =>
      p.permitido
        ? "Se permite el subarriendo parcial con autorización previa y por escrito del arrendador."
        : "Se prohíbe la cesión y el subarriendo salvo autorización expresa del arrendador.",
  },

  retraso_pago: {
    id: "retraso_pago",
    version: CLAUSE_POLICY_VERSION,
    label: "Retraso en el pago",
    paramsSchema: z.object({
      diasGracia: z.number().int().min(0).max(15).default(5),
      recargoPct: z.number().min(0).max(0.05).default(0),
    }),
    render: p =>
      `Se concede un periodo de gracia de ${p.diasGracia} días naturales. ` +
      `Tras dicho plazo, se aplicará un recargo del ${(p.recargoPct * 100).toFixed(2)}% mensual sobre cantidades vencidas.`,
  },
} satisfies Record<string, ClauseDefinition>;

/**
 * Cláusulas autonómicas — se aplican según la CCAA del inmueble
 */
export const CLAUSES_BY_REGION = {
  galicia: {
    fianza_autonomica: {
      id: "fianza_autonomica",
      version: CLAUSE_POLICY_VERSION,
      label: "Depósito de fianza en IGVS",
      paramsSchema: z.object({}),
      render: () =>
        "El arrendador deberá depositar la fianza en el Instituto Galego da Vivenda e Solo (IGVS), conforme normativa autonómica de Galicia.",
    },
  },

  catalunya: {
    fianza_autonomica: {
      id: "fianza_autonomica",
      version: CLAUSE_POLICY_VERSION,
      label: "Depósito de fianza en INCASÒL",
      paramsSchema: z.object({}),
      render: () =>
        "El arrendador deberá depositar la fianza en el Institut Català del Sòl (INCASÒL), conforme normativa autonómica de Cataluña.",
    },
  },

  madrid: {
    fianza_autonomica: {
      id: "fianza_autonomica",
      version: CLAUSE_POLICY_VERSION,
      label: "Depósito de fianza en IVIMA",
      paramsSchema: z.object({}),
      render: () =>
        "El arrendador deberá depositar la fianza en el Instituto de la Vivienda de Madrid (IVIMA), conforme normativa autonómica de la Comunidad de Madrid.",
    },
  },
} satisfies Record<string, Record<string, ClauseDefinition>>;

export type RegionKey = keyof typeof CLAUSES_BY_REGION;
