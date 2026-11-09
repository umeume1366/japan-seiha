/**
 * 日本制覇スタンプ（Japan Conquest）— Cloudflare Workers（Hono）＋ D1
 *
 *  だれでも
 *   GET    /api/catalog            地方・県・都市・体験の一覧
 *   POST   /api/signup             新規登録 { username, password, country? } → ログイン状態になる
 *   POST   /api/login              ログイン { username, password }
 *   POST   /api/logout             ログアウト
 *  ログインが必要
 *   GET    /api/me                 ログイン中のユーザー
 *   GET    /api/progress           自分の「行った都市」と「スタンプ」
 *   PUT    /api/visits/:cityId     行った都市にする
 *   DELETE /api/visits/:cityId     行った都市から外す（その都市のスタンプは残る）
 *   PUT    /api/stamps/:expId      スタンプを押す（その都市も自動で「行った」になる）
 *   DELETE /api/stamps/:expId      スタンプを消す
 *   POST   /api/import             ゲスト中にブラウザへ保存していた記録をまとめて取り込む
 *
 *  画面
 *   GET /  → app.html（地図・県ページ・スタンプ帳・ログインを1ページで切り替え）
 *
 * 必要な設定：wrangler.toml の D1（binding = "DB"）、シークレット JWT_SECRET
 */
import { Hono } from "hono";
import {
  hashPassword, verifyPassword, DUMMY_HASH, signToken, verifyToken,
  readCookie, sessionCookie, clearCookie, SESSION_COOKIE, SESSION_DAYS,
} from "./auth.js";
import appPage from "./app.html";
import mapPart from "./japan-map.html";

const app = new Hono();

/* ---------- 共通 ---------- */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Server error" }, 500);
});

function secretOf(c) {
  const s = c.env.JWT_SECRET;
  if (!s || s.length < 16) throw new HttpError(500, "JWT_SECRET is not set (16+ chars)");
  return s;
}
function checkOrigin(c) {
  const origin = c.req.header("Origin");
  if (origin && origin !== new URL(c.req.url).origin) throw new HttpError(403, "Cross-site requests are not allowed");
}
async function readJson(c) {
  try { return await c.req.json(); } catch { throw new HttpError(400, "Invalid JSON"); }
}
async function requireUser(c) {
  const token = readCookie(c.req.header("Cookie"), SESSION_COOKIE);
  const payload = token ? await verifyToken(token, secretOf(c)) : null;
  if (!payload) throw new HttpError(401, "Please log in");
  const user = await c.env.DB.prepare("SELECT id, username, country FROM users WHERE id = ?").bind(payload.sub).first();
  if (!user) throw new HttpError(401, "Please log in");
  return user;
}
async function issueSession(c, user) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signToken({ sub: user.id, name: user.username, iat: now, exp: now + SESSION_DAYS * 86400 }, secretOf(c));
  return { "Set-Cookie": sessionCookie(token, c.req.url) };
}
const noStore = { "Cache-Control": "no-store" };

/* ---------- カタログ ---------- */
app.get("/api/catalog", async (c) => {
  const db = c.env.DB;
  const [regions, prefs, cities, exps] = await db.batch([
    db.prepare("SELECT id, name_en AS en, name_ja AS ja, sort_order AS sort FROM regions ORDER BY sort_order"),
    db.prepare("SELECT id, slug, name_en AS en, name_ja AS ja, region_id AS region FROM prefectures ORDER BY id"),
    db.prepare("SELECT id, prefecture_id AS pref, name_en AS en, name_ja AS ja, sort_order AS sort FROM cities ORDER BY prefecture_id, sort_order"),
    db.prepare("SELECT id, city_id AS city, category AS cat, name_en AS en, name_ja AS ja, desc_en AS den, desc_ja AS dja, sort_order AS sort FROM experiences WHERE active = 1 ORDER BY city_id, sort_order"),
  ]);
  return c.json(
    { regions: regions.results, prefectures: prefs.results, cities: cities.results, experiences: exps.results },
    200, { "Cache-Control": "public, max-age=300" },
  );
});

/* ---------- 登録・ログイン ---------- */
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

app.post("/api/signup", async (c) => {
  checkOrigin(c);
  const body = await readJson(c);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const country = String(body.country || "").trim().toUpperCase().slice(0, 2) || null;
  if (!USERNAME_RE.test(username)) throw new HttpError(400, "Username: 3–20 letters, numbers or _");
  if (password.length < 8 || password.length > 200) throw new HttpError(400, "Password must be at least 8 characters");
  const exists = await c.env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first();
  if (exists) throw new HttpError(409, "That username is taken");
  const user = { id: crypto.randomUUID(), username };
  await c.env.DB.prepare("INSERT INTO users (id, username, password_hash, country) VALUES (?1, ?2, ?3, ?4)")
    .bind(user.id, username, await hashPassword(password), country).run();
  return c.json({ success: true, username }, 201, await issueSession(c, user));
});

app.post("/api/login", async (c) => {
  checkOrigin(c);
  const body = await readJson(c);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!username || !password) throw new HttpError(400, "Enter your username and password");
  const user = await c.env.DB.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").bind(username).first();
  const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Wrong username or password");
  return c.json({ success: true, username: user.username }, 200, await issueSession(c, user));
});

app.post("/api/logout", (c) => c.json({ success: true }, 200, { "Set-Cookie": clearCookie(c.req.url) }));

app.get("/api/me", async (c) => {
  const u = await requireUser(c);
  return c.json({ id: u.id, username: u.username, country: u.country }, 200, noStore);
});

/* ---------- 自分の記録 ---------- */
async function progressOf(db, userId) {
  const [v, s] = await db.batch([
    db.prepare("SELECT city_id AS city, visited_at AS at FROM visits WHERE user_id = ?").bind(userId),
    db.prepare("SELECT experience_id AS exp, stamped_at AS at FROM stamps WHERE user_id = ?").bind(userId),
  ]);
  return { visits: v.results, stamps: s.results };
}

app.get("/api/progress", async (c) => {
  const u = await requireUser(c);
  return c.json(await progressOf(c.env.DB, u.id), 200, noStore);
});

async function mustExist(db, table, id) {
  const row = await db.prepare(`SELECT ${table === "experiences" ? "city_id" : "id"} AS v FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) throw new HttpError(404, "Not found");
  return row.v;
}

app.put("/api/visits/:city", async (c) => {
  checkOrigin(c);
  const u = await requireUser(c);
  const city = c.req.param("city");
  await mustExist(c.env.DB, "cities", city);
  await c.env.DB.prepare("INSERT OR IGNORE INTO visits (user_id, city_id) VALUES (?, ?)").bind(u.id, city).run();
  return c.json({ success: true });
});

app.delete("/api/visits/:city", async (c) => {
  checkOrigin(c);
  const u = await requireUser(c);
  await c.env.DB.prepare("DELETE FROM visits WHERE user_id = ? AND city_id = ?").bind(u.id, c.req.param("city")).run();
  return c.json({ success: true });
});

app.put("/api/stamps/:exp", async (c) => {
  checkOrigin(c);
  const u = await requireUser(c);
  const exp = c.req.param("exp");
  const city = await mustExist(c.env.DB, "experiences", exp);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO stamps (user_id, experience_id) VALUES (?, ?)").bind(u.id, exp),
    c.env.DB.prepare("INSERT OR IGNORE INTO visits (user_id, city_id) VALUES (?, ?)").bind(u.id, city),
  ]);
  return c.json({ success: true });
});

app.delete("/api/stamps/:exp", async (c) => {
  checkOrigin(c);
  const u = await requireUser(c);
  await c.env.DB.prepare("DELETE FROM stamps WHERE user_id = ? AND experience_id = ?").bind(u.id, c.req.param("exp")).run();
  return c.json({ success: true });
});

// ゲストの記録を取り込む（存在しないIDは無視、日時は ISO または "YYYY-MM-DD HH:MM:SS"）
app.post("/api/import", async (c) => {
  checkOrigin(c);
  const u = await requireUser(c);
  const body = await readJson(c);
  const toAt = (v) => {
    const t = new Date(String(v || ""));
    return isNaN(t) ? null : t.toISOString().slice(0, 19).replace("T", " ");
  };
  const visits = (Array.isArray(body.visits) ? body.visits : []).slice(0, 2000);
  const stamps = (Array.isArray(body.stamps) ? body.stamps : []).slice(0, 2000);
  const db = c.env.DB, stmts = [];
  for (const v of visits) {
    stmts.push(db.prepare(
      "INSERT OR IGNORE INTO visits (user_id, city_id, visited_at) SELECT ?1, id, COALESCE(?3, datetime('now')) FROM cities WHERE id = ?2"
    ).bind(u.id, String(v.city || ""), toAt(v.at)));
  }
  for (const s of stamps) {
    stmts.push(db.prepare(
      "INSERT OR IGNORE INTO stamps (user_id, experience_id, stamped_at) SELECT ?1, id, COALESCE(?3, datetime('now')) FROM experiences WHERE id = ?2"
    ).bind(u.id, String(s.exp || ""), toAt(s.at)));
    stmts.push(db.prepare(
      "INSERT OR IGNORE INTO visits (user_id, city_id, visited_at) SELECT ?1, city_id, COALESCE(?3, datetime('now')) FROM experiences WHERE id = ?2"
    ).bind(u.id, String(s.exp || ""), toAt(s.at)));
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  return c.json(await progressOf(db, u.id), 200, noStore);
});

/* ---------- 画面 ---------- */
const html = appPage.replace("<!--DEMO_CATALOG-->", "").replace("<!--JAPAN_MAP-->", () => mapPart);
app.get("/", (c) => c.body(html, 200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }));
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
app.all("*", (c) => c.redirect("/", 302));

export default app;
