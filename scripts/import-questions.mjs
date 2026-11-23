#!/usr/bin/env node
// Import user-authored paired prompts as opaque data. Never rewrite their wording.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/import-questions.mjs path/to/100-questions.json");
  process.exit(1);
}
const source = JSON.parse(readFileSync(input, "utf8"));
if (!Array.isArray(source) || source.length !== 100) throw new Error("Expected exactly 100 numbered pairs");
const seen = new Set();
const stages = { 1: [], 2: [], 3: [], 4: [] };
for (const [index, item] of source.entries()) {
  const n = index + 1;
  if (!item || item.id !== n || typeof item["مذكر"] !== "string" || typeof item["مؤنث"] !== "string"
      || !item["مذكر"].trim() || !item["مؤنث"].trim()) throw new Error(`Invalid pair #${n}`);
  if (seen.has(item.id)) throw new Error(`Duplicate id #${n}`);
  seen.add(item.id);
  const stage = n <= 16 ? 1 : n <= 34 ? 2 : n <= 68 ? 3 : 4;
  stages[stage].push({ "مذكر": item["مذكر"], "مؤنث": item["مؤنث"] });
}
const checksum = createHash("sha256").update(readFileSync(input)).digest("hex");
const header = `// Generated from user-authored source. SHA256: ${checksum}\n// Do not manually edit question strings.\nimport type { CardPair } from "./cards";\n\n`;
const generated = header + `export const importedStages: Record<number, CardPair[]> = ${JSON.stringify(stages, null, 2)};\n`;
writeFileSync("contracts/importedCards.ts", generated, "utf8");
console.log("Imported 100 pairs (200 prompts). Stage counts: 16, 18, 34, 32. SHA256:", checksum);
