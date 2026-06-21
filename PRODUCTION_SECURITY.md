# Production Security Checklist

## Required configuration

1. Copy `backend/.env.example` to `backend/.env` on the server.
2. Copy `frontend/.env.example` to `frontend/.env.production.local`.
3. Generate a JWT secret:

   ```powershell
   cd backend
   npm run security:generate-secret
   ```

   Store the output in the server secret manager as `JWT_SECRET`. Never commit it.

4. Use a dedicated MySQL account with access only to `radiology_db`. Do not use `root`.
5. Set `FRONTEND_URL` to the exact HTTPS frontend origin.
6. Configure TLS at Nginx, IIS, Apache, or the cloud load balancer.
7. Forward `X-Forwarded-Proto` and configure `TRUST_PROXY` to match the number of trusted proxies.

## Validate before starting

Run with the production environment loaded:

```powershell
cd backend
npm run security:check
```

The backend refuses to start when:

- `JWT_SECRET` is short or uses a known development value;
- the database password is empty;
- `FRONTEND_URL` is missing, invalid, or does not use HTTPS.

## Rotate the default administrator password

Set the new password only in the process environment:

```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_NEW_PASSWORD = "Use-A-Unique-Strong-Password!"
npm run security:rotate-admin
Remove-Item Env:ADMIN_NEW_PASSWORD
```

The password must contain at least 12 characters, upper/lowercase letters, a number, and a symbol.

## Deployment notes

- The authentication cookie is `HttpOnly`, `SameSite=Strict`, and `Secure` in production.
- HTTP requests are redirected to HTTPS when `ENFORCE_HTTPS=true`.
- CORS accepts only origins listed in `FRONTEND_URL`.
- Do not expose MySQL to the public internet.
- Back up the database before deployment and test restoring the backup.
- Delete test accounts and temporary uploaded files before go-live.

## Backup and restore drill

Create a consistent database and result-image backup:

```powershell
cd backend
npm run backup
```

Restore to a test database without touching the live upload directory:

```powershell
$env:DB_NAME = "radiology_restore_test"
npm run migrate
npm run restore -- backup-YYYYMMDD-HHMMSS --yes --skip-uploads
```

Always compare table counts and foreign-key relationships before considering the backup verified.
