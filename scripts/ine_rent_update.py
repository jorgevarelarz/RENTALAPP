#!/usr/bin/env python3
"""
Builds the per-region factor that carries a SERPAVI year up to the latest
month, from INE's CPI "Alquiler de vivienda" index by autonomous community
(Tempus table 76137). Output feeds scripts/import_serpavi.ts --factors.

  factor = index(latest published month) / mean(index over the base year)

This corrects for time only: both SERPAVI and the CPI follow rents of
contracts in force, so the gap to new-contract prices is handled by using the
upper quartile, not by this factor.

Usage:
  python3 scripts/ine_rent_update.py 2024 > ine-factors.json
Uses curl (INE's chain fails Python's default CA bundle on some Macs).
"""
import datetime
import json
import statistics
import subprocess
import sys

API = 'https://servicios.ine.es/wstempus/js/ES'

# INE series name prefix → region key used by the app (REGION_ALIASES).
INE_REGIONS = {
    'Andalucía': 'andalucia', 'Aragón': 'aragon', 'Asturias, Principado de': 'asturias',
    'Balears, Illes': 'illes balears', 'Canarias': 'canarias', 'Cantabria': 'cantabria',
    'Castilla y León': 'castilla y leon', 'Castilla - La Mancha': 'castilla-la mancha',
    'Cataluña': 'catalunya', 'Comunitat Valenciana': 'comunitat valenciana',
    'Extremadura': 'extremadura', 'Galicia': 'galicia', 'Madrid, Comunidad de': 'madrid',
    'Murcia, Región de': 'murcia', 'Navarra, Comunidad Foral de': 'navarra',
    'País Vasco': 'pais vasco', 'Rioja, La': 'la rioja', 'Ceuta': 'ceuta', 'Melilla': 'melilla',
}


def get(path):
    return json.loads(subprocess.check_output(['curl', '-sf', f'{API}/{path}']))


def main():
    if len(sys.argv) != 2:
        sys.exit('Usage: ine_rent_update.py <base year, e.g. 2024>')
    base_year = sys.argv[1]

    series = {}
    for page in range(1, 10):
        batch = get(f'SERIES_TABLA/76137?page={page}')
        if not batch:
            break
        for item in batch:
            name = item['Nombre']
            if 'Alquiler de vivienda. Índice' in name:
                series[name.split('.')[0].strip()] = item['COD']

    out = {}
    for ine_name, region in INE_REGIONS.items():
        cod = series.get(ine_name)
        if not cod:
            sys.exit(f'No CPI rent series for {ine_name}')
        points = [
            (datetime.datetime.fromtimestamp(p['Fecha'] / 1000 + 43200, datetime.timezone.utc).strftime('%Y-%m'), p['Valor'])
            for p in get(f'DATOS_SERIE/{cod}?nult=60')['Data']
            if p['Valor'] is not None
        ]
        base = [value for month, value in points if month.startswith(base_year)]
        if len(base) != 12:
            sys.exit(f'{ine_name}: {len(base)} months of {base_year}, expected 12')
        month, latest = points[-1]
        out[region] = {
            'factor': round(latest / statistics.mean(base), 4),
            'series': cod,
            'base': base_year,
            'to': month,
            # Whole monthly series, so other baselines (e.g. a deposit-registry
            # window) can be carried forward with the same index.
            'months': dict(points),
        }
        print(f'{region:22} {out[region]["factor"]:.4f} ({cod}, {base_year} → {month})', file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
