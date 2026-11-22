import "dotenv/config";

function required(name: string, ...fallbacks: string[]): string {
  const value = [name, ...fallbacks].map(key => process.env[key]).find(Boolean);
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

// APP_ID / APP_SECRET are not used by the game; requiring them crashed the
// production server at boot whenever the platform did not set them.
export const env = {
  appId: process.env.APP_ID ?? "",
  appSecret: process.env.APP_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Railway's MySQL service exposes MYSQL_URL; accept it so one variable reference is enough.
  databaseUrl: required("DATABASE_URL", "MYSQL_URL"),
};
