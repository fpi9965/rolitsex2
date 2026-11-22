# Deploy private game on Render + Aiven MySQL

This branch prepares a **private test deployment**. Nothing is deployed automatically by creating this branch.

## 1. Database on Aiven
- Create an Aiven for MySQL service on a currently available free plan **if offered in your region/account**. Check limits and billing before provisioning.
- Copy the service URI (host, port, database, username, password). Set the Render `DATABASE_URL` environment variable to the complete MySQL connection URI.
- **Aiven MySQL requires TLS.** Obtain the Aiven CA certificate and configure TLS trust for the Node mysql2 client and for schema migration. Verify a secure database connection before enabling the public URL; do not use `rejectUnauthorized: false`.
- Create tables before testing. Run `npm run db:migrate` against an existing schema or `npm run db:push` for a fresh database after verifying the connection and reviewing schema changes. Do not run destructive pushes against real data.

## 2. Render
1. In Render select **New > Blueprint**, connect GitHub repo `fpi9965/rolitsex2`, and select branch `deploy/render-aiven-private-20261122` (or create a Web Service with the same build/start commands if Blueprint branch selection is unavailable).
2. The `render.yaml` declares a free Node web service. Check that the free instance type is available and verify any account/payment requirements.
3. Set secret `DATABASE_URL`, and `ACCESS_PASSWORD` (random 16+ characters). `ACCESS_USERNAME` defaults to `player`. Keep secrets in Render, not GitHub.
4. Build with `npm ci && npm run build`; start with `npm start`. Render injects `PORT` and the app listens on it.
5. Use the Render HTTPS domain. Browser requests for the game and API require HTTP Basic username/password. `/api/health` is intentionally public for health checks.
6. Confirm the health endpoint reports `database: connected`, then test joining from two phones, turn sync, card timers and secret round.

## Limitations
- Render free services can sleep after inactivity, leading to cold starts. Free quotas and provider availability may change.
- Aiven's free tier may not be available in every account/region. Confirm the actual cost in both dashboards before creating resources.
- HTTP Basic credentials can remain cached by browsers. Share only with intended adult testers, and rotate after the trial.
- The current application connection code needs validation against Aiven's TLS requirements before claiming a successful deployment. No live database, build, or two-device test has been executed as part of this PR.
