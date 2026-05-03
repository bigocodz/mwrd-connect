// k6 load test — minimal happy-path coverage.
//
// Run:   k6 run -e BASE_URL=http://localhost:8001 -e EMAIL=... -e PASSWORD=... loadtest/k6.js
// Goals: 100 concurrent users, 5 min, p95 < 500ms on read endpoints.
//
// Endpoints exercised: login, /me, /catalog/products, /rfqs/, /notifications.
// Mutations are deliberately excluded — keeping the corpus stable for each
// run avoids skew from monotonic id growth across attempts.
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://localhost:8001";
const EMAIL = __ENV.EMAIL || "demo@client.local";
const PASSWORD = __ENV.PASSWORD || "demo-password-12chars";

const meTrend = new Trend("me_latency", true);
const catTrend = new Trend("catalog_latency", true);

export const options = {
  scenarios: {
    steady: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "1m",  target: 50 },
        { duration: "2m",  target: 100 },
        { duration: "1m",  target: 25 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    me_latency:      ["p(95)<500"],
    catalog_latency: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup() {
  const r = http.post(`${BASE}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } });
  check(r, { "login 200": (x) => x.status === 200 });
  return { cookies: r.cookies };
}

export default function (data) {
  const jar = http.cookieJar();
  for (const name of Object.keys(data.cookies || {})) {
    jar.set(BASE, name, data.cookies[name][0].value);
  }

  const me = http.get(`${BASE}/api/auth/me`);
  meTrend.add(me.timings.duration);
  check(me, { "me 200": (r) => r.status === 200 });

  const cat = http.get(`${BASE}/api/catalog/products?limit=20`);
  catTrend.add(cat.timings.duration);
  check(cat, { "catalog 200": (r) => r.status === 200 });

  http.get(`${BASE}/api/rfqs/`);
  http.get(`${BASE}/api/notifications`);

  sleep(1 + Math.random() * 2);
}
