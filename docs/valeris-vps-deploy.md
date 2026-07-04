# Valeris VPS Deploy Runbook

## Canonical repo

Use this working copy and GitHub remote:

```bash
cd "/Users/jorge/Desktop/02 RentalApp/rentalapp 2.3"
git remote -v
```

Deploy branch: `main`.

## Server prerequisites

The Valeris VPS is AlmaLinux with Apache/httpd already serving ports `80` and `443`.
Do not install Nginx over it.

Required services:

```bash
sudo systemctl enable --now docker httpd
docker compose version
httpd -M | grep -E 'proxy|proxy_http|ssl|headers|rewrite'
```

Keep the app bound to localhost on `3100` because the VPS already uses host port `3000` for another service.
`rentalapp.es` must have an A record to `5.250.186.153` before TLS can be issued.
Optionally point `www.rentalapp.es` to the same IP and add it as a `ServerAlias`.

## First deploy

```bash
git clone https://github.com/jorgevarelarz/RENTALAPP.git rentalapp
cd rentalapp
cp .env.valeris.example .env.valeris
```

Edit `.env.valeris` with real secrets. Generate required secrets:

```bash
openssl rand -hex 32 # JWT_SECRET
openssl rand -hex 32 # IBAN_ENCRYPTION_KEY
openssl rand -hex 16 # INSTITUTION_CASEID_SALT
```

Build and start:

```bash
docker compose -f docker-compose.valeris.yml up -d --build
docker compose -f docker-compose.valeris.yml logs -f api
```

Health checks:

```bash
curl -fsS http://127.0.0.1:3100/health
curl -fsS http://127.0.0.1:3100/ready
```

## Apache reverse proxy

Create `/etc/httpd/conf.d/rentalapp.conf`:

```apache
<VirtualHost *:80>
    ServerName rentalapp.es
    ServerAlias www.rentalapp.es

    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "http"
    ProxyPass / http://127.0.0.1:3100/
    ProxyPassReverse / http://127.0.0.1:3100/
</VirtualHost>
```

Validate and reload:

```bash
sudo apachectl configtest
sudo systemctl reload httpd
curl -H 'Host: rentalapp.es' -fsS http://127.0.0.1/ready
```

After DNS resolves, issue TLS with the server's existing certificate tooling or Certbot Apache plugin if available:

```bash
sudo certbot --apache -d rentalapp.es -d www.rentalapp.es
```

## Update deploy

```bash
cd rentalapp
git pull --ff-only
docker compose -f docker-compose.valeris.yml up -d --build
docker compose -f docker-compose.valeris.yml ps
curl -fsS https://rentalapp.es/ready
```

## Rollback

```bash
git log --oneline -5
git checkout <last-good-commit>
docker compose -f docker-compose.valeris.yml up -d --build
```

## Production rules

- Do not set `ALLOW_TEST_AUTH=true`.
- Do not set `ALLOW_UNVERIFIED=true`.
- Do not set `RENTAL_PUBLIC_DEMO_MODE=true`.
- Do not use `SIGN_PROVIDER=mock`, `SMS_PROVIDER=mock`, or `ESCROW_DRIVER=mock` in production.
- Keep `.env.valeris` out of Git.
