# Mongo Backup And Restore

Production uses the `rental_mongo` Docker container on Valeris VPS.

## Backup

```bash
npm run backup:mongo:valeris
```

Optional variables:

```bash
VALERIS_SSH_HOST=valeris-vps BACKUP_OUT_DIR=backups/mongo npm run backup:mongo:valeris
```

## Restore Drill

Never restore over production for a drill. Restore into a temporary Mongo container:

```bash
docker run --rm -d --name rental_restore_drill -p 127.0.0.1:37017:27017 mongo:6
docker cp backups/mongo/<backup>.archive.gz rental_restore_drill:/tmp/restore.archive.gz
docker exec rental_restore_drill mongorestore --archive=/tmp/restore.archive.gz --gzip --drop
docker exec rental_restore_drill mongosh --quiet rentalapp --eval 'db.runCommand({ ping: 1 }).ok'
docker rm -f rental_restore_drill
```

Record each real backup or restore drill in `docs/PROJECT_MEMORY.md`.
