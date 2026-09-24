#!/usr/bin/env bash
# Backup diario de la BD de RentalApp EN el VPS (mongodump comprimido, rotación 7 días).
# Lo lanza /etc/cron.d/rentalapp-backup a las 03:40. Para una copia puntual al
# Mac está scripts/mongo_backup_valeris.sh.
set -euo pipefail
DIR=/opt/rentalapp/backups/mongo
FILE="$DIR/rentalapp-mongo-$(date +%F).archive.gz"
mkdir -p "$DIR"
docker exec rental_mongo mongodump --quiet --archive --gzip --db rentalapp > "$FILE.tmp"
gunzip -t "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
find "$DIR" -name "rentalapp-mongo-*.archive.gz" -mtime +7 -delete
echo "$(date -Is) ok $FILE $(du -h "$FILE" | cut -f1)"
