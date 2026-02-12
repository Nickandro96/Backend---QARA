export const getSessionCookieOptions = (req: any) => {
  return {
    path: '/',
    domain: process.env.COOKIE_DOMAIN,
    secure: true,
    sameSite: 'none' as const,
  };
};
