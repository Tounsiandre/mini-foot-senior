// Mini Foot Senior — member accounts API (Cloudflare Pages Functions + D1)
// Routes: POST /api/login, POST /api/logout, GET /api/me, POST /api/admin-create (admin key required; no public sign-up)
const COOKIE = "mfs_session";
const SESSION_DAYS = 30;
const PBKDF2_ITER = 100000; // Workers limit
const MAX_FAILS = 8, FAIL_WINDOW = 15 * 60; // 8 failures / 15 min

const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const now = () => Math.floor(Date.now() / 1000);

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sha256Hex(text) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))); }

function getCookie(request, name) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? m[1] : null;
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function sameOrigin(request) {
  const o = request.headers.get("Origin");
  if (!o) return true; // non-browser or same-origin GET-like
  return new URL(o).host === new URL(request.url).host;
}
async function readBody(request) {
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) return null;
  try { return await request.json(); } catch { return null; }
}

async function createSession(env, userId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const exp = now() + SESSION_DAYS * 86400;
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha256Hex(token), userId, exp).run();
  return cookieHeader(token, SESSION_DAYS * 86400);
}
async function currentUser(env, request) {
  const token = getCookie(request, COOKIE);
  if (!token) return null;
  return await env.DB.prepare(
    "SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?"
  ).bind(await sha256Hex(token), now()).first();
}

async function tooManyFails(env, key) {
  const row = await env.DB.prepare("SELECT n, ts FROM attempts WHERE k = ?").bind(key).first();
  return !!row && now() - row.ts < FAIL_WINDOW && row.n >= MAX_FAILS;
}
async function addFail(env, key) {
  const t = now();
  await env.DB.prepare(
    "INSERT INTO attempts (k, n, ts) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN ? - ts >= ? THEN 1 ELSE n + 1 END, ts = CASE WHEN ? - ts >= ? THEN ? ELSE ts END"
  ).bind(key, t, t, FAIL_WINDOW, t, FAIL_WINDOW, t).run();
}
const clearFails = (env, key) => env.DB.prepare("DELETE FROM attempts WHERE k = ?").bind(key).run();

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export async function onRequest({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: "server_config" }, 500);
  const route = (params.path || []).join("/");
  const method = request.method;

  if (route === "me" && method === "GET") {
    const user = await currentUser(env, request);
    return user ? json({ ok: true, user: { name: user.name, email: user.email } }) : json({ ok: false }, 401);
  }
  if (method !== "POST") return json({ ok: false, error: "not_found" }, 404);
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);

  if (route === "logout") {
    const token = getCookie(request, COOKIE);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0) });
  }

  const body = await readBody(request);
  if (!body) return json({ ok: false, error: "invalid" }, 400);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ip = request.headers.get("CF-Connecting-IP") || "?";

  if (route === "admin-create") {
    // Accounts are created by the administrator only (secret ADMIN_KEY set in Cloudflare).
    const adminKey = env.ADMIN_KEY || "";
    const given = request.headers.get("X-Admin-Key") || "";
    const aKey = "adm:" + ip;
    if (await tooManyFails(env, aKey)) return json({ ok: false, error: "too_many" }, 429);
    if (adminKey.length < 12 || !safeEqual(await sha256Hex(given), await sha256Hex(adminKey))) {
      await addFail(env, aKey);
      return json({ ok: false, error: "forbidden" }, 403);
    }
    const name = String(body.name || "").trim().replace(/\s+/g, " ");
    if (!EMAIL_RE.test(email) || name.length < 2 || name.length > 80 || password.length < 8 || password.length > 200)
      return json({ ok: false, error: "invalid" }, 400);
    const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (exists) return json({ ok: false, error: "email_taken" }, 409);
    const { hash, salt } = await hashPassword(password);
    try {
      await env.DB.prepare("INSERT INTO users (name, email, pw_hash, pw_salt, created_at) VALUES (?, ?, ?, ?, ?)").bind(name, email, hash, salt, now()).run();
    } catch { return json({ ok: false, error: "email_taken" }, 409); }
    return json({ ok: true });
  }

  if (route === "login") {
    if (!EMAIL_RE.test(email) || !password || password.length > 200) return json({ ok: false, error: "bad_credentials" }, 401);
    const key = "login:" + email + ":" + ip;
    if (await tooManyFails(env, key)) return json({ ok: false, error: "too_many" }, 429);
    const user = await env.DB.prepare("SELECT id, pw_hash, pw_salt FROM users WHERE email = ?").bind(email).first();
    // always hash, so timing does not reveal whether the e-mail exists
    const calc = await hashPassword(password, user ? user.pw_salt : "AAAAAAAAAAAAAAAAAAAAAA==");
    if (!user || !safeEqual(calc.hash, user.pw_hash)) { await addFail(env, key); return json({ ok: false, error: "bad_credentials" }, 401); }
    await clearFails(env, key);
    const cookie = await createSession(env, user.id);
    return json({ ok: true }, 200, { "Set-Cookie": cookie });
  }

  return json({ ok: false, error: "not_found" }, 404);
}
