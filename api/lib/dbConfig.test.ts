import { describe, expect, it } from "vitest";
import { mysqlOptions } from "./dbConfig";

describe("database connection options", () => {
  it("uses TLS for TiDB Cloud and keeps the rest of the URL", () => {
    const o = mysqlOptions("mysql://u.root:p@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/rolit", {});
    expect(o.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(o.uri).toBe("mysql://u.root:p@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/rolit");
  });
  it("turns ssl-mode=REQUIRED into TLS and strips the flag mysql2 does not know", () => {
    const o = mysqlOptions("mysql://u:p@db.example.com:3306/x?ssl-mode=REQUIRED", {});
    expect(o.ssl).toBeTruthy();
    expect(o.uri).not.toContain("ssl-mode");
  });
  it("leaves local and private databases on plain connections", () => {
    expect(mysqlOptions("mysql://r:pw@127.0.0.1:3306/rolit", {}).ssl).toBeUndefined();
    expect(mysqlOptions("mysql://r:pw@mysql.railway.internal:3306/railway", {}).ssl).toBeUndefined();
  });
  it("lets DB_SSL override detection", () => {
    expect(mysqlOptions("mysql://r:pw@127.0.0.1/x", { DB_SSL: "true" }).ssl).toBeTruthy();
    expect(mysqlOptions("mysql://u:p@x.tidbcloud.com:4000/x", { DB_SSL: "false" }).ssl).toBeUndefined();
  });
});
