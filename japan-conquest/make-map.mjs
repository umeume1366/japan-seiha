/**
 * 日本地図（SVG の形）を作って japan-map.html に書き出します。
 *   node make-map.mjs
 * 地図の形を app.html に組み込むので、スマホでも外部サイトを読みに行かずにすぐ表示されます。
 * 元データ：amCharts 5 Geodata（japanLow）。amCharts の無料ライセンス（リンク表記が条件）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import geo from "@amcharts/amcharts5-geodata/japanLow.js";

// app.html の中の変換処理（codeOf〜build）をそのまま使う
const html = readFileSync(new URL("./app.html", import.meta.url), "utf8");
const a = html.indexOf("    var EN = ["), b = html.indexOf("    async function mount(");
const src = html.slice(a, b).replace(/function loadGeo\(\)[\s\S]*?\n    }\n/, "");
const build = new Function(src + "\nreturn build;")();
const data = build(geo);
const out = { W: data.W, H: data.H, box: data.box, C: data.C, items: data.items.map((it) => ({ code: it.code, d: it.d })) };
writeFileSync(new URL("./japan-map.html", import.meta.url),
  "<!-- 自動生成（node make-map.mjs）。Map data: amCharts 5 Geodata, https://www.amcharts.com/ -->\n<script>window.JAPAN_MAP=" + JSON.stringify(out) + ";</script>\n");
console.log("japan-map.html を作りました：" + out.items.length + " 区画");
