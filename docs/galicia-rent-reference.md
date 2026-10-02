# Referencias de alquiler de Galicia

Fuente: [Observatorio de Vivenda / IGVS, Las fianzas en las ciudades y sus zonas de influencia, 2.º trimestre de 2026](https://www.observatoriodavivenda.gal/es/documentos/las-fianzas-en-las-ciudades-y-sus-zonas-de-influencia-2o-trimestre-2026), publicado el 13 de agosto de 2026, consultado el 28 de septiembre.

[PDF oficial](https://www.observatoriodavivenda.gal/sites/w_igvobs/files/ovg_fianzas_zonas_influencia_2026m06_v1_es.pdf): página 13, barras azules **Ciudad** para los importes medios por m²; página 11 para el número de fianzas. Son siete municipios (4.104 fianzas); las zonas de influencia quedan fuera. El informe considera los depósitos hasta el 31 de julio de 2026. Las cifras son revisables por depósitos posteriores.

Se conservan en `scripts/data/igvs-cities-2026-q2.csv`, con códigos INE para que las variantes del nombre de ciudad encuentren la misma referencia.

Esta carga sustituye, para esas siete ciudades, la aproximación SERPAVI p75 × IPC por la media observada de los contratos del 2T de 2026. No mezcla euros por vivienda con euros por m², no aplica otro incremento por IPC ni presenta la cifra como precio de oferta actual o tasación individual. Los ajustes por características del inmueble y los límites existentes siguen aplicándose. El resto de municipios conserva sus referencias anteriores.

## Revisar e importar

La fecha efectiva es la de publicación. El importador valida todo el archivo antes de conectar a MongoDB. La simulación no necesita credenciales:

```bash
node -r ts-node/register scripts/import_zone_rent_reference.ts \
  --file scripts/data/igvs-cities-2026-q2.csv \
  --source 'IGVS Observatorio de Vivenda' --from 2026-08-13 --dry-run
```

Para cargar, hacer primero una copia de la base y ejecutar el mismo comando sin `--dry-run`, con `MONGO_URI` apuntando al entorno elegido. Repetir la carga con la misma fecha actualiza las siete referencias; no duplica las anteriores. Las referencias SERPAVI previas se conservan y la consulta elige la fecha efectiva más reciente.

Para revertir esta carga, desactivar únicamente los documentos con `source = IGVS Observatorio de Vivenda` y `effectiveFrom = 2026-08-13T00:00:00.000Z`; la consulta volverá a las referencias anteriores. Una próxima actualización debe conservar su URL, periodo y fecha de publicación, y usar una nueva fecha efectiva.
