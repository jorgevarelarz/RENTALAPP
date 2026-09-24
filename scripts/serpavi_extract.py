#!/usr/bin/env python3
"""
Extracts the municipal reference rent from the SERPAVI workbook (Sistema Estatal
de Referencia del Precio del Alquiler de Vivienda, MIVAU) into a TSV that
scripts/import_serpavi.ts loads.

The workbook is the "Base de datos" XLSX linked from
https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi
(the site blocks some non-Spanish IPs; downloading from the VPS works).

Figures: median and upper quartile of the monthly rent per m² of the year
(ALQM2_LV_M_VC_YY / ALQM2_LV_75_VC_YY) for collective housing (flats).
Municipalities with no flat figure fall back to single-family homes (VU) and
are flagged as such. The ministry only publishes figures backed by at least 10
contracts. medianRentEur is the median monthly rent per home, which is what
new-contract registries (deposit data) can be compared against.

Usage:
  python3 scripts/serpavi_extract.py serpavi.xlsx 2024 > serpavi-2024.tsv
Requires: openpyxl
"""
import sys

import openpyxl


def main():
    if len(sys.argv) != 3:
        sys.exit('Usage: serpavi_extract.py <workbook.xlsx> <year, e.g. 2024>')
    path, year = sys.argv[1], sys.argv[2]
    yy = year[-2:]

    sheet = openpyxl.load_workbook(path, read_only=True)['Municipios']
    rows = sheet.iter_rows(values_only=True)
    header = list(next(rows))
    col = {name: i for i, name in enumerate(header)}
    for needed in (f'ALQM2_LV_M_VC_{yy}', f'ALQM2_LV_M_VU_{yy}'):
        if needed not in col:
            sys.exit(f'Column {needed} not found: is {year} in this workbook?')

    print('\t'.join(['ineCode', 'officialName', 'province', 'medianPerM2', 'p75PerM2', 'medianRentEur', 'housingType', 'sampleSize', 'period']))
    kept = 0
    for row in rows:
        if not row[col['CUMUN']]:
            continue
        for kind, suffix in (('collective', 'VC'), ('single_family', 'VU')):
            price = row[col[f'ALQM2_LV_M_{suffix}_{yy}']]
            p75 = row[col[f'ALQM2_LV_75_{suffix}_{yy}']]
            if isinstance(price, (int, float)) and price > 0 and isinstance(p75, (int, float)) and p75 > 0:
                sample = row[col[f'BI_ALVHEPCO_T{suffix}_{yy}']]
                rent = row[col[f'ALQTBID12_M_{suffix}_{yy}']]
                print('\t'.join([
                    str(row[col['CUMUN']]),
                    str(row[col['NMUN']]),
                    str(row[col['NPRO']]),
                    f'{price:.2f}',
                    f'{p75:.2f}',
                    f'{rent:.0f}' if isinstance(rent, (int, float)) else '',
                    kind,
                    str(int(sample)) if isinstance(sample, (int, float)) else '',
                    year,
                ]))
                kept += 1
                break
    print(f'{kept} municipalities with a {year} figure', file=sys.stderr)


if __name__ == '__main__':
    main()
