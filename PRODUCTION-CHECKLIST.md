# Production checklist

- [ ] Managed PostgreSQL provisioned and `DATABASE_URL` set
- [ ] `JWT_SECRET` replaced with a generated secret
- [ ] `APP_ORIGIN` set to exact HTTPS origin
- [ ] Bootstrap admin password changed
- [ ] Waiter and kitchen accounts have unique passwords
- [ ] HTTPS/custom domain active
- [ ] PostgreSQL automatic backups enabled
- [ ] `/api/health` returns OK
- [ ] Public menu and restaurant information reviewed
- [ ] Reservation test reaches CRM
- [ ] Waiter order reaches kitchen live
- [ ] Kitchen status updates reach admin/waiter
- [ ] Table payment closes active orders and frees table
- [ ] QR ordering tested from a phone
- [ ] Staff role restrictions tested
- [ ] Fiscal receipt/legal integration requirements confirmed separately
