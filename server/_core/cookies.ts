export const getSessionCookieOptions = (_req: any) => {
  const isProd = process.env.NODE_ENV === "production";

  // IMPORTANT:
  // - Do NOT set "domain" unless you fully control a parent domain for BOTH apps.
  // - For Vercel <-> Railway cross-site cookies, domain should usually be omitted.
  return {
    path: "/",
    httpOnly: true,
    secure: isProd, // must be true in production (HTTPS)
    // Le frontend relaie /trpc vers Railway : le cookie reste same-origin et
    // peut utiliser Lax, plus robuste et plus protecteur contre les requêtes CSRF.
    sameSite: "lax" as const,
  };
};
