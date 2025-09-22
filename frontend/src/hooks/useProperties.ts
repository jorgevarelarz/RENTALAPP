import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchProperties, type SearchParams } from '../services/properties';

function toNum(v: string | null | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toBool(v: string | null | undefined): boolean | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

export function usePropertyFilters() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();

  const filters: SearchParams & { onlyTenantPro?: boolean } = useMemo(() => ({
    q: sp.get('q') || undefined,
    region: sp.get('region') || undefined,
    city: sp.get('city') || undefined,
    priceMin: toNum(sp.get('priceMin')),
    priceMax: toNum(sp.get('priceMax')),
    roomsMin: toNum(sp.get('roomsMin')),
    roomsMax: toNum(sp.get('roomsMax')),
    bathMin: toNum(sp.get('bathMin')),
    furnished: toBool(sp.get('furnished')),
    petsAllowed: toBool(sp.get('petsAllowed')),
    sort: (sp.get('sort') as any) || 'createdAt',
    dir: (sp.get('dir') as any) || 'desc',
    page: toNum(sp.get('page')) || 1,
    limit: toNum(sp.get('limit')) || 12,
    // extra
    // @ts-ignore: backend tolera este param; si no existe, filtramos client-side
    onlyTenantPro: toBool(sp.get('onlyTenantPro')),
  }), [sp]);

  const setFilters = (next: Partial<SearchParams & { onlyTenantPro?: boolean }>) => {
    const merged = { ...filters, ...next, page: next.page ?? 1 };
    const obj: Record<string, string> = {};
    Object.entries(merged).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      obj[k] = String(v);
    });
    setSp(obj, { replace: false });
    // ensure we stay on the same route
    navigate({ search: '?' + new URLSearchParams(obj).toString() }, { replace: false });
  };

  return { filters, setFilters };
}

type SearchResponse = { items: any[]; page: number; limit: number; total: number };

export function usePropertiesQuery(filters: SearchParams & { onlyTenantPro?: boolean }) {
  return useQuery<SearchResponse, Error>({
    queryKey: ['properties', filters],
    queryFn: async () => searchProperties(filters),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}
