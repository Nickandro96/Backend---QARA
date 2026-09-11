const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

if (!email || !password) {
  throw new Error("E2E_EMAIL and E2E_PASSWORD are required; values are never printed.");
}

async function trpc(path, { method = "GET", input = null, cookie = "" } = {}) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  const response = await fetch(`${baseUrl}/trpc/${path}${method === "GET" ? `?input=${encoded}` : ""}`, {
    method,
    headers: {
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: method === "POST" ? JSON.stringify({ json: input }) : undefined,
    redirect: "manual",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}`);
  return { response, data: body?.result?.data?.json ?? body?.result?.data ?? null };
}

const login = await trpc("system.login", { method: "POST", input: { email, password } });
const setCookies = typeof login.response.headers.getSetCookie === "function"
  ? login.response.headers.getSetCookie()
  : [login.response.headers.get("set-cookie")].filter(Boolean);
const cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
if (!cookie.includes("session=")) throw new Error("Login did not set the session cookie.");

const authenticated = await trpc("auth.me", { cookie });
if (!authenticated.data?.id) throw new Error("Session was not recognized after login.");

const logout = await trpc("auth.logout", { method: "POST", cookie });
const cleared = (typeof logout.response.headers.getSetCookie === "function"
  ? logout.response.headers.getSetCookie()
  : [logout.response.headers.get("set-cookie")].filter(Boolean)).join(";");
if (!/session=;|Max-Age=-1|Expires=/i.test(cleared)) throw new Error("Logout did not clear the session cookie.");

console.log("Auth E2E passed: login, session recognition and logout.");
