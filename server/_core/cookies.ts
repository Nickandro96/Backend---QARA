export const getSessionCookieOptions = (_req: any) => {
  const isProd = process.env.NODE_ENV === "production";

  // IMPORTANT:
  // - Do NOT set "domain" unless you fully control a parent domain for BOTH apps.
  // - For Vercel <-> Railway cross-site cookies, domain should usually be omitted.
  return {
    path: "/",
    httpOnly: true,
    secure: isProd, // must be true in production (HTTPS)
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  };
};
