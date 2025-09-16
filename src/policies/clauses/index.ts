import { CLAUSES_BASE, CLAUSES_BY_REGION, type ClauseDefinition, type RegionKey } from "./catalog.v1";

export type ClauseCatalogByRegion = Record<string, ClauseDefinition>;

function normalizeRegion(region: string): string {
  return region.trim().toLowerCase();
}

export function getCatalogByRegion(region: string): ClauseCatalogByRegion | null {
  if (!region || typeof region !== "string") {
    return null;
  }
  const normalized = normalizeRegion(region);
  const regionalCatalog =
    normalized === "general"
      ? {}
      : CLAUSES_BY_REGION[normalized as RegionKey] ?? null;

  if (normalized !== "general" && regionalCatalog === null) {
    return null;
  }

  return {
    ...CLAUSES_BASE,
    ...(regionalCatalog ?? {}),
  };
}
