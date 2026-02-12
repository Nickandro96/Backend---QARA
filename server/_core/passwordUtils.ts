export const hashPassword = (password: string) => password;
export const verifyPassword = (password: string, hash: string) => password === hash;
