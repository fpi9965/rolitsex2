import type { ConnectionOptions } from "mysql2";

// Turns DATABASE_URL into mysql2 options, adding TLS for hosted databases that
// require it. Free hosted MySQL (TiDB Cloud) refuses plain connections, and
// mysql2 ignores the `ssl-mode=REQUIRED` style flag that providers put in their
// URLs, so TLS has to be switched on explicitly.
//
// TLS is used when any of these holds:
//   - the host is TiDB Cloud (*.tidbcloud.com)
//   - the URL carries ssl-mode / sslmode = REQUIRED | VERIFY_CA | VERIFY_IDENTITY
//   - DB_SSL=true
// DB_SSL=false turns it off.
const TLS_MODES = new Set(["required", "verify_ca", "verify_identity", "require", "verify-full"]);

export function mysqlOptions(databaseUrl: string, env: NodeJS.ProcessEnv = process.env): ConnectionOptions {
  const url = new URL(databaseUrl);
  let wantsTls = /(^|\.)tidbcloud\.com$/i.test(url.hostname);

  for (const key of ["ssl-mode", "sslmode", "ssl_mode"]) {
    const mode = url.searchParams.get(key);
    if (mode !== null) {
      if (TLS_MODES.has(mode.toLowerCase())) wantsTls = true;
      url.searchParams.delete(key);
    }
  }
  if (env.DB_SSL === "true") wantsTls = true;
  if (env.DB_SSL === "false") wantsTls = false;

  return {
    uri: url.toString(),
    ...(wantsTls ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } } : {}),
  };
}
