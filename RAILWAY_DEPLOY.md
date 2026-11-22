# Private Railway deployment

This is a **private test deployment**, not a public release. The app requires Node.js and MySQL.

1. In Railway, create a project from the GitHub repository and select branch `deploy/railway-private-access-20261122`.
2. Add a **MySQL service**. In the app service, set `DATABASE_URL` to the MySQL service's internal connection URL using Railway variable references (e.g. `${{MySQL.MYSQL_URL}}`, adjusting the service name and provided variable).
3. Set `ACCESS_USERNAME=player` and generate a unique random `ACCESS_PASSWORD` of at least **16 characters**. Never commit the password. Set `NODE_ENV=production`.
4. Before exposing the domain, run `npm run db:migrate` in the app service with `DATABASE_URL` configured (for a fresh database with no migration history, `npm run db:push` is an alternative; do not use push on an existing database without reviewing changes).
5. Deploy the app and enable a Railway-generated HTTPS domain. Railway uses `PORT` automatically.
6. Visiting the URL prompts for the username and password. Only share credentials with intended adult testers.
7. Verify `/api/health` returns 200 with `database: connected`; test room creation and joining on two devices. Rotate `ACCESS_PASSWORD` after testing.

**Security notes:** HTTP Basic authentication is appropriate only over HTTPS. The health endpoint intentionally remains public for platform probes; all other paths, including assets and tRPC, require credentials. Browser Basic credentials can persist until browser restart. For a public launch, replace this shared password with per-user accounts and rate limiting. This protects the preview but does not address all game security findings.

**Costs:** Railway trial/usage limits and MySQL resource costs can change. Check the current dashboard before enabling services; do not assume the deployment will remain free.
