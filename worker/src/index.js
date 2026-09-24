/**
 * ojisan-sagashi worker
 *
 * エンドポイント:
 *   POST /hunter  {token, lat, lng, acc?, ts?}  自分(ハンター)の位置を保存
 *   POST /target  {token, lat, lng, acc?, ts?, source?}  相手(ターゲット)の位置を保存(mock|real)
 *   POST /judge   {token, found, probability}  jev-judgeの結果を保存
 *   GET  /state?token=...  距離(m)・方角(度)・更新時刻・判定だけを返す(座標は返さない)
 *   GET  /            スマホ用HTML画面を配信
 *
 * プライバシー方針: 座標そのものはKVに書くが、GET /state のレスポンスには一切含めない。
 * 意図的な簡略化: 認証は単一の共有トークンのみ(本人+ポーラーの2者間利用が前提の遊び用途のため)。
 *   複数ユーザー・不特定多数向けに拡張する場合は署名付きJWT等に置き換えること。
 */
import { distanceMeters, bearingDegrees } from "./geo.js";

const TTL_SECONDS = 2 * 60 * 60; // 2時間で自動失効

function cors(origin, allowedOrigin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin && (origin === allowedOrigin || allowedOrigin === "*")) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function checkToken(request, env, bodyToken) {
  const url = new URL(request.url);
  const token = bodyToken ?? url.searchParams.get("token") ?? request.headers.get("x-token");
  return token && env.SHARED_TOKEN && token === env.SHARED_TOKEN;
}

async function handleHunterPost(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !checkToken(request, env, body.token)) return json({ error: "unauthorized" }, 401);
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return json({ error: "lat/lng required" }, 400);
  }
  const record = {
    lat: body.lat,
    lng: body.lng,
    acc: body.acc ?? null,
    updated_at: body.ts ?? Date.now(),
  };
  await env.OJISAN_KV.put("hunter", JSON.stringify(record), { expirationTtl: TTL_SECONDS });
  return json({ ok: true });
}

async function handleTargetPost(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !checkToken(request, env, body.token)) return json({ error: "unauthorized" }, 401);
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return json({ error: "lat/lng required" }, 400);
  }
  const record = {
    lat: body.lat,
    lng: body.lng,
    acc: body.acc ?? null,
    source: body.source === "real" ? "real" : "mock",
    updated_at: body.ts ?? Date.now(),
  };
  await env.OJISAN_KV.put("target", JSON.stringify(record), { expirationTtl: TTL_SECONDS });
  return json({ ok: true });
}

async function handleJudgePost(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !checkToken(request, env, body.token)) return json({ error: "unauthorized" }, 401);
  const record = {
    found: !!body.found,
    probability: typeof body.probability === "number" ? body.probability : null,
    updated_at: Date.now(),
  };
  await env.OJISAN_KV.put("judge", JSON.stringify(record), { expirationTtl: TTL_SECONDS });
  return json({ ok: true });
}

async function handleState(request, env) {
  if (!checkToken(request, env, null)) return json({ error: "unauthorized" }, 401);
  const [hunterRaw, targetRaw, judgeRaw] = await Promise.all([
    env.OJISAN_KV.get("hunter"),
    env.OJISAN_KV.get("target"),
    env.OJISAN_KV.get("judge"),
  ]);
  const hunter = hunterRaw ? JSON.parse(hunterRaw) : null;
  const target = targetRaw ? JSON.parse(targetRaw) : null;
  const judge = judgeRaw ? JSON.parse(judgeRaw) : null;

  let distance_m = null;
  let bearing_deg = null;
  if (hunter && target) {
    distance_m = Math.round(distanceMeters(hunter.lat, hunter.lng, target.lat, target.lng));
    bearing_deg = Math.round(bearingDegrees(hunter.lat, hunter.lng, target.lat, target.lng));
  }

  return json({
    has_hunter: !!hunter,
    has_target: !!target,
    distance_m,
    bearing_deg,
    hunter_updated_at: hunter?.updated_at ?? null,
    target_updated_at: target?.updated_at ?? null,
    target_source: target?.source ?? null,
    judge,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(origin, allowedOrigin) });
    }

    let response;
    if (url.pathname === "/hunter" && request.method === "POST") {
      response = await handleHunterPost(request, env);
    } else if (url.pathname === "/target" && request.method === "POST") {
      response = await handleTargetPost(request, env);
    } else if (url.pathname === "/judge" && request.method === "POST") {
      response = await handleJudgePost(request, env);
    } else if (url.pathname === "/state" && request.method === "GET") {
      response = await handleState(request, env);
    } else if (url.pathname === "/" && request.method === "GET") {
      return new Response(HTML_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    } else {
      response = json({ error: "not found" }, 404);
    }

    const corsHeaders = cors(origin, allowedOrigin);
    for (const [k, v] of Object.entries(corsHeaders)) response.headers.set(k, v);
    return response;
  },
};

const HTML_PAGE = String.raw`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>おじさん探し</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 18px;
    background: radial-gradient(circle at 50% 30%, #1a2a3a, #05070a 70%);
    color: #eafcff; font-family: -apple-system, "Hiragino Sans", sans-serif;
    text-align: center; padding: 24px;
  }
  h1 { font-size: 22px; margin: 0; letter-spacing: 0.05em; }
  #arrow-wrap { width: 220px; height: 220px; display:flex; align-items:center; justify-content:center;
    border-radius: 50%; background: radial-gradient(circle, rgba(0,255,200,0.12), transparent 70%);
    border: 2px solid rgba(0,255,200,0.35); }
  #arrow { font-size: 120px; transition: transform 0.3s ease; transform: rotate(0deg); color: #00ffc8;
    filter: drop-shadow(0 0 12px rgba(0,255,200,0.6)); }
  #distance { font-size: 48px; font-weight: 800; }
  #distance small { font-size: 20px; font-weight: 500; opacity: 0.7; }
  #status { font-size: 15px; opacity: 0.8; line-height: 1.6; }
  #judge { font-size: 26px; font-weight: 800; padding: 10px 20px; border-radius: 999px; }
  #judge.found { background: #ff2d55; color: white; animation: pulse 1s infinite; }
  #judge.notfound { background: rgba(255,255,255,0.08); color: #9fb; }
  @keyframes pulse { 0%,100%{ transform: scale(1);} 50%{ transform: scale(1.06);} }
  button { font-size: 16px; padding: 10px 18px; border-radius: 10px; border: none;
    background: #00ffc8; color: #003; font-weight: 700; }
</style>
</head>
<body>
  <h1>🕵️ おじさん探しゲーム</h1>
  <div id="arrow-wrap"><div id="arrow">⬆️</div></div>
  <div id="distance">--<small> m</small></div>
  <div id="judge" class="notfound">未発見</div>
  <div id="status">位置情報を取得しています…</div>
  <button id="perm-btn" style="display:none">向きの許可をON</button>

<script>
(function () {
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const statusEl = document.getElementById("status");
  if (!token) {
    statusEl.textContent = "URLにtokenが必要です";
    return;
  }
  const API = location.origin;
  let heading = 0;
  let bearingToTarget = null;

  function applyRotation() {
    const arrow = document.getElementById("arrow");
    if (bearingToTarget == null) return;
    const rel = (bearingToTarget - heading + 360) % 360;
    arrow.style.transform = "rotate(" + rel + "deg)";
  }

  function onOrientation(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === "number") {
      h = e.webkitCompassHeading;
    } else if (e.alpha != null) {
      h = 360 - e.alpha;
    }
    if (h != null) { heading = h; applyRotation(); }
  }

  function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      const btn = document.getElementById("perm-btn");
      btn.style.display = "inline-block";
      btn.onclick = () => {
        DeviceOrientationEvent.requestPermission().then((res) => {
          if (res === "granted") {
            window.addEventListener("deviceorientation", onOrientation);
            btn.style.display = "none";
          }
        }).catch(() => {});
      };
    } else {
      window.addEventListener("deviceorientation", onOrientation);
    }
  }
  requestOrientationPermission();

  async function sendHunter(lat, lng, acc) {
    try {
      await fetch(API + "/hunter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, lat, lng, acc, ts: Date.now() }),
      });
    } catch (_) {}
  }

  async function pollState() {
    try {
      const res = await fetch(API + "/state?token=" + encodeURIComponent(token));
      if (!res.ok) { statusEl.textContent = "サーバーエラー(" + res.status + ")"; return; }
      const data = await res.json();
      if (!data.has_target) {
        statusEl.textContent = "相手の位置がまだありません(共有待ち)";
        document.getElementById("distance").innerHTML = "--<small> m</small>";
        return;
      }
      if (data.distance_m != null) {
        document.getElementById("distance").innerHTML = data.distance_m + "<small> m</small>";
      }
      bearingToTarget = data.bearing_deg;
      applyRotation();
      const src = data.target_source === "real" ? "実共有" : "テスト(mock)";
      const t = data.target_updated_at ? new Date(data.target_updated_at).toLocaleTimeString("ja-JP") : "--";
      statusEl.textContent = "相手位置: " + src + " / 最終更新 " + t;

      const judgeEl = document.getElementById("judge");
      if (data.judge && data.judge.found) {
        const p = data.judge.probability != null ? Math.round(data.judge.probability * 100) : "?";
        judgeEl.textContent = "見つけた！(" + p + "%)";
        judgeEl.className = "found";
      } else {
        judgeEl.textContent = "未発見";
        judgeEl.className = "notfound";
      }
    } catch (_) {
      statusEl.textContent = "通信エラー";
    }
  }

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (pos) => sendHunter(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => { statusEl.textContent = "位置情報の取得に失敗しました(許可を確認)"; },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  } else {
    statusEl.textContent = "この端末は位置情報に対応していません";
  }

  pollState();
  setInterval(pollState, 5000);
})();
</script>
</body>
</html>`;
