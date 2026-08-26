# DEL GUSTO · Restaurant OS

Production-oriented full-stack restaurant web + CRM/POS for Del Gusto Sarajevo.

## What is included

- Public Del Gusto website at `/`
- Public menu pulled from PostgreSQL
- Online reservation form saved to PostgreSQL and shown live in CRM
- Visible **CRM Login** button on the Del Gusto website
- Staff portal at `/login` and `/app`
- Admin dashboard, floor/table view, reservations, menu management, orders, kitchen board, staff accounts, settings, notifications and QR ordering
- Waiter workflow: table → items → kitchen
- Kitchen workflow: new → preparation → ready
- QR guest workflow: `/qr?table=ID`
- Transactional table payment and order history
- Socket.IO real-time updates
- PostgreSQL + Prisma
- bcrypt password hashing
- HttpOnly/SameSite session cookie (JWT)
- CSRF token check for protected writes
- rate limiting, Helmet/CSP, input validation and role guards
- tenant-ready data model through `restaurantId`, while this deployment exposes only Del Gusto
- Docker Compose and Render deployment configuration

## Local production-like test

Requirements: Docker Desktop.

```bash
# IMPORTANT: change the secrets/password in docker-compose.yml first if others can reach your machine
docker compose up --build
```

Open: `http://localhost:5000`

Initial accounts created by the seed use the value of `SEED_ADMIN_PASSWORD`:

- Admin: `admin@delgusto.ba`
- Waiter: `konobar@delgusto.ba`
- Kitchen: `kuhinja@delgusto.ba`

The example password is only a bootstrap value. Change it before a public deploy.

## Recommended public deployment: Render + PostgreSQL

This repository contains `render.yaml`.

1. Push this folder to a private GitHub repository.
2. In Render choose **New > Blueprint** and select the repository.
3. Render creates the web service and PostgreSQL database.
4. Set `SEED_ADMIN_PASSWORD` to a unique strong initial password.
5. Set `APP_ORIGIN` to the final HTTPS web URL, e.g. `https://delgusto-crm.onrender.com` or your custom domain.
6. Deploy. Startup runs `prisma migrate deploy`, seeds Del Gusto if needed, then starts the app.
7. Open `/api/health` and verify `{ "ok": true }`.
8. Sign in as admin and create/change staff credentials before daily use.

## Custom domain

Point a domain/subdomain to the deployed service, for example:

- `delgusto.ba` → public website
- `delgusto.ba/login` → staff login
- `delgusto.ba/app` → CRM

If the existing marketing site must stay on the root domain, use a subdomain such as `app.delgusto.ba` for this system and adjust the routing/design accordingly.

## Environment variables

Copy `.env.example` to `.env` for non-Docker local development.

Required in production:

- `DATABASE_URL`
- `JWT_SECRET` — long random secret
- `APP_ORIGIN` — exact public HTTPS origin
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Never commit a real `.env` file.

## Database safety

Use managed PostgreSQL automated backups. Before schema upgrades run a manual backup/snapshot. Prisma migrations live in `prisma/migrations` and production startup uses `prisma migrate deploy`.

## Important before handing it to a restaurant

1. Change every bootstrap password.
2. Use HTTPS only.
3. Configure automated PostgreSQL backups.
4. Test on at least: admin laptop, waiter phone/tablet, kitchen screen and a guest phone on QR ordering.
5. Run a complete test: reservation → waiter order → kitchen → ready → payment → table free.
6. Verify your real fiscal/POS requirements separately. This application records orders/payments internally; it is **not itself a certified fiscal cash register integration**.

## Adding more restaurants later

The database is already designed around `Restaurant` + `restaurantId`. This deployment intentionally exposes only `del-gusto`. A future platform/admin layer can create additional restaurants without redesigning the core database. Keep tenant checks on every API query when that layer is added.
