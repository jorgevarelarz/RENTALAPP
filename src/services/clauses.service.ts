import type { ClauseDefinition, RegionKey } from "../policies/clauses/catalog.v1";
import { CLAUSE_POLICY_VERSION, CLAUSES_BASE, CLAUSES_BY_REGION } from "../policies/clauses/catalog.v1";

export type ClauseScope = "base" | "regional";

export interface ClauseCatalogEntry {
  id: string;
  label: string;
  version: string;
  scope: ClauseScope;
}

export interface ClauseCatalog {
  version: string;
  region?: RegionKey;
  regions: RegionKey[];
  base: ClauseCatalogEntry[];
  regional: ClauseCatalogEntry[];
}

export interface ClauseInput {
  id: string;
  params?: unknown;
}

export interface ResolvedClause {
  id: string;
  version: string;
  label: string;
  params: Record<string, unknown>;
  text: string;
  scope: ClauseScope;
}

export const listRegions = (): RegionKey[] => Object.keys(CLAUSES_BY_REGION) as RegionKey[];

export const normalizeRegion = (value?: string | null): RegionKey | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  return (Object.prototype.hasOwnProperty.call(CLAUSES_BY_REGION, normalized)
    ? (normalized as RegionKey)
    : undefined);
};

const definitionToCatalogEntry = (
  definition: ClauseDefinition,
  scope: ClauseScope,
): ClauseCatalogEntry => ({
  id: definition.id,
  label: definition.label,
  version: definition.version,
  scope,
});

export const buildClauseCatalog = (region?: string | null): ClauseCatalog => {
  const normalizedRegion = normalizeRegion(region);
  if (region && !normalizedRegion) {
    throw new Error(`Región no soportada: ${region}`);
  }
  const regionalDefinitions = normalizedRegion ? CLAUSES_BY_REGION[normalizedRegion] : undefined;
  return {
    version: CLAUSE_POLICY_VERSION,
    region: normalizedRegion,
    regions: listRegions(),
    base: Object.values(CLAUSES_BASE).map(def => definitionToCatalogEntry(def, "base")),
    regional: regionalDefinitions
      ? Object.values(regionalDefinitions).map(def => definitionToCatalogEntry(def, "regional"))
      : [],
  };
};

export const resolveClauses = (region: string, clauses: ClauseInput[]): ResolvedClause[] => {
  if (!Array.isArray(clauses)) {
    throw new Error("El formato de cláusulas es inválido");
  }
  const normalizedRegion = normalizeRegion(region);
  if (!normalizedRegion) {
    throw new Error(`Región no soportada: ${region}`);
  }

  const availableClauses = new Map<string, { definition: ClauseDefinition; scope: ClauseScope }>();
  Object.values(CLAUSES_BASE).forEach(definition => {
    availableClauses.set(definition.id, { definition, scope: "base" });
  });
  Object.values(CLAUSES_BY_REGION[normalizedRegion]).forEach(definition => {
    availableClauses.set(definition.id, { definition, scope: "regional" });
  });

  const seenIds = new Set<string>();
  return clauses.map((clause, index) => {
    if (!clause || typeof clause !== "object") {
      throw new Error(`Cláusula en la posición ${index} inválida`);
    }
    if (typeof clause.id !== "string" || clause.id.trim() === "") {
      throw new Error(`Cláusula en la posición ${index} carece de identificador`);
    }
    const trimmedId = clause.id.trim();
    if (seenIds.has(trimmedId)) {
      throw new Error(`Cláusula duplicada: ${trimmedId}`);
    }
    seenIds.add(trimmedId);

    const entry = availableClauses.get(trimmedId);
    if (!entry) {
      throw new Error(`La cláusula "${trimmedId}" no está permitida en ${normalizedRegion}`);
    }

    const params = entry.definition.paramsSchema.parse(clause.params ?? {});
    const text = entry.definition.render(params as never);

    return {
      id: entry.definition.id,
      version: entry.definition.version,
      label: entry.definition.label,
      params: params as Record<string, unknown>,
      text,
      scope: entry.scope,
    };
  });
};
