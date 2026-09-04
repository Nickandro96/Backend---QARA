import os from "node:os";

// Some restricted Windows runners cannot resolve the interactive account and
// make tsx fail before tests start. This only supplies the temporary-directory
// metadata tsx needs; application authentication is unaffected.
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || "qara-test",
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: null,
  });
}
