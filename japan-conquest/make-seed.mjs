/**
 * catalog-data.mjs から seed.sql（地方・県・都市・体験の初期データ）を作ります。
 *   node make-seed.mjs            → seed.sql を書き出す
 * できた seed.sql を D1 の Console で実行するか、
 *   npx wrangler d1 execute japan-conquest-db --remote --file=./seed.sql
 * 何度実行しても大丈夫です（同じIDは上書き）。
 */
import { writeFileSync } from "node:fs";
import { buildCatalog } from "./catalog-data.mjs";

const c = buildCatalog();
const q = (v) => (typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const row = (vals) => "(" + vals.map(q).join(",") + ")";
const upsert = (table, cols, rows, key) =>
  `INSERT INTO ${table} (${cols.join(",")}) VALUES\n  ${rows.map(row).join(",\n  ")}\n` +
  `ON CONFLICT (${key}) DO UPDATE SET ${cols.filter((x) => x !== key).map((x) => `${x}=excluded.${x}`).join(", ")};\n`;

const sql = [
  "-- 自動生成ファイル（編集は catalog-data.mjs で行い、node make-seed.mjs で作り直す）",
  upsert("regions", ["id", "name_en", "name_ja", "sort_order"], c.regions.map((r) => [r.id, r.en, r.ja, r.sort]), "id"),
  upsert("prefectures", ["id", "slug", "name_en", "name_ja", "region_id"], c.prefectures.map((p) => [p.id, p.slug, p.en, p.ja, p.region]), "id"),
  upsert("cities", ["id", "prefecture_id", "name_en", "name_ja", "sort_order"], c.cities.map((x) => [x.id, x.pref, x.en, x.ja, x.sort]), "id"),
  upsert("experiences", ["id", "city_id", "category", "name_en", "name_ja", "desc_en", "desc_ja", "sort_order"],
    c.experiences.map((e) => [e.id, e.city, e.cat, e.en, e.ja, e.den, e.dja, e.sort]), "id"),
].join("\n");

writeFileSync(new URL("./seed.sql", import.meta.url), sql);
console.log(`seed.sql を作りました：地方 ${c.regions.length} / 県 ${c.prefectures.length} / 都市 ${c.cities.length} / 体験 ${c.experiences.length}` +
  `（食 ${c.experiences.filter((e) => e.cat === "food").length}・アクティビティ ${c.experiences.filter((e) => e.cat === "activity").length}）`);
