#!/usr/bin/env python3
import os
import sys
from urllib.parse import unquote, urlparse

raw = (os.getenv("DATABASE_URL") or "").strip()
if not raw:
    sys.exit("ERROR: DATABASE_URL env is missing")

p = urlparse(raw)

host = p.hostname or ""
port = str(p.port or 3306)
user = unquote(p.username or "")
password = unquote(p.password or "")
db = (p.path or "").lstrip("/")

if not host or not user or not db:
    sys.exit("ERROR: DATABASE_URL invalid (need host/user/dbname)")

github_env = os.environ.get("GITHUB_ENV")
if not github_env:
    sys.exit("ERROR: GITHUB_ENV is missing")

with open(github_env, "a", encoding="utf-8") as f:
    f.write(f"DB_HOST={host}\n")
    f.write(f"DB_PORT={port}\n")
    f.write(f"DB_USER={user}\n")
    f.write(f"DB_PASSWORD={password}\n")
    f.write(f"DB_NAME={db}\n")

print("OK: parsed DATABASE_URL -> DB_HOST/DB_PORT/DB_USER/DB_NAME set (password hidden)")
