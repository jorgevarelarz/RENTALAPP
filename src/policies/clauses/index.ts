import { ZodTypeAny } from "zod";
import { CLAUSES_BASE, CLAUSES_BY_REGION, CLAUSE_POLICY_VERSION } from "./catalog.v1";

type ClauseDef = {
  id: string;
  version: string;
  label: string;
  paramsSchema: ZodTypeAny;
  render: (params: any) => string;
};
type Catalog = Record<string, ClauseDef>;

/**
 * La región del inmueble es texto libre («Comunidad de Madrid», «Cataluña», «A Coruña, Galicia»…);
 * el catálogo solo conoce `madrid`, `galicia` y `catalunya`. Devuelve la clave o null si no encaja.
 * Misma regla que `contractRegion` del asistente (frontend/src/pages/contracts/contractDraft.ts).
 */
export function contractRegionKey(region?: string): string | null {
  const r = String(region || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!r) return null;
  if (r.includes("madrid")) return "madrid";
  if (r.includes("galicia") || r.includes("galiza")) return "galicia";
  if (r.includes("catalu") || r.includes("catalonia")) return "catalunya";
  return null;
}

/** Une base + cláusulas autonómicas según region */
export function getCatalogByRegion(region?: string): Catalog {
  const base: Catalog = CLAUSES_BASE as any;
  const r = (region || "").toLowerCase();
  if (r && !(CLAUSES_BY_REGION as any)[r]) {
    return {} as Catalog;
  }
  const regional: Catalog = (r && (CLAUSES_BY_REGION as any)[r]) || {};
  return { ...base, ...regional };
}

/** Serializa un schema Zod a metadatos simples para formularios del front */
export function zodToMeta(schema: ZodTypeAny): any {
  const def: any = (schema as any)?._def;

  // Objetos
  if (def?.typeName === "ZodObject") {
    const shape = (schema as any).shape;
    const fields: Record<string, any> = {};
    for (const k of Object.keys(shape)) fields[k] = zodToMeta(shape[k]);
    return { type: "object", fields };
  }

  // Defaults / Effects (unwrap)
  if (def?.typeName === "ZodDefault") {
    const inner = zodToMeta(def.innerType);
    inner.default = def.defaultValue();
    return inner;
  }
  if (def?.typeName === "ZodEffects") {
    return zodToMeta(def.schema);
  }

  // Primitivos
  if (def?.typeName === "ZodNumber") {
    return {
      type: "number",
      int: !!def.checks?.find((c: any) => c.kind === "int"),
      min: def.checks?.find((c: any) => c.kind === "min")?.value,
      max: def.checks?.find((c: any) => c.kind === "max")?.value,
    };
  }
  if (def?.typeName === "ZodBoolean") return { type: "boolean" };
  if (def?.typeName === "ZodString") return { type: "string" };

  return { type: "unknown" };
}

export { CLAUSE_POLICY_VERSION };
