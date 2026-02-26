import os
import csv
import time
import mysql.connector
from urllib.parse import urlparse, parse_qs

DATABASE_URL = os.environ.get("DATABASE_URL", "")

def parse_db_url(url: str) -> dict:
    u = urlparse(url)
    qs = parse_qs(u.query)
    ssl_val = (qs.get("ssl", ["on"])[0] or "on").lower()
    ssl_required = ssl_val not in ("0", "false", "off", "no")
    return {
        "host": u.hostname,
        "port": u.port or 3306,
        "user": u.username,
        "password": u.password,
        "database": u.path.lstrip("/"),
        "ssl_required": ssl_required,
    }

def connect_with_retry(max_attempts: int = 10):
    info = parse_db_url(DATABASE_URL)
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            kwargs = dict(
                host=info["host"],
                port=info["port"],
                user=info["user"],
                password=info["password"],
                database=info["database"],
                connection_timeout=25,
            )
            if info["ssl_required"]:
                kwargs.update(ssl_disabled=False, ssl_verify_cert=False, ssl_verify_identity=False)
            else:
                kwargs.update(ssl_disabled=True)

            conn = mysql.connector.connect(**kwargs)
            conn.ping(reconnect=True, attempts=3, delay=2)
            return conn
        except Exception as e:
            last_err = e
            wait_s = min(2 ** attempt, 20)
            print(f"[DB] connect attempt {attempt}/{max_attempts} failed: {e}")
            print(f"[DB] retrying in {wait_s}s...")
            time.sleep(wait_s)
    raise last_err

def run():
    conn = connect_with_retry()
    cur = conn.cursor()

    # Export only ISO referentials (2 & 3)
    cur.execute("""
      SELECT
        referentialId,
        questionKey,
        processId,
        article,
        title,
        questionText
      FROM questions
      WHERE referentialId IN (2,3)
      ORDER BY referentialId, processId, id
    """)

    os.makedirs("artifacts", exist_ok=True)
    out_path = "artifacts/iso_question_keys.csv"

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["referentialId","questionKey","processId","article","title","questionText"])
        for row in cur.fetchall():
            w.writerow(row)

    cur.close()
    conn.close()

    print(f"[EXPORT] Wrote: {out_path}")

if __name__ == "__main__":
    run()
