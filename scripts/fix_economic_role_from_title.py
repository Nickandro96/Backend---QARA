import os
import re
from urllib.parse import urlparse, unquote
import mysql.connector

ROLE_MAP = {
    "fabricant": "manufacturer",
    "mandataire": "authorized_representative",
    "representant autorise": "authorized_representative",
    "représentant autorisé": "authorized_representative",
    "importateur": "importer",
    "distributeur": "distributor",
}

def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = (
        s.replace("é", "e")
         .replace("è", "e")
         .replace("ê", "e")
         .replace("à", "a")
         .replace("ç", "c")
    )
    return s

def extract_role_and_clean_title(title: str):
    if not title:
        return None, None
    m = re.match(r"^\s*\[(.*?)\]\s*(.*)$", title.strip())
    if not m:
        return None, None
    role_label = norm(m.group(1))
    clean_title = (m.group(2) or "").strip()
    role = ROLE_MAP.get(role_label)
    return role, clean_title

def parse_database_url(db_url: str):
    if not db_url:
        raise SystemExit("❌ DATABASE_URL is missing.")
    # Accept mysql:// or mysqls://
    p = urlparse(db_url)

    if p.scheme not in ("mysql", "mysqls"):
        raise SystemExit(f"❌ DATABASE_URL must start with mysql:// (got scheme={p.scheme})")

    host = p.hostname
    port = p.port or 3306
    user = unquote(p.username) if p.username else None
    password = unquote(p.password) if p.password else None
    database = (p.path or "").lstrip("/")

    if not host or not user or password is None or not database:
        raise SystemExit("❌ DATABASE_URL parse failed (host/user/password/database missing).")

    return host, port, user, password, database

def main():
    db_url = os.environ.get("DATABASE_URL")
    host, port, user, password, database = parse_database_url(db_url)

    print(f"🔌 Connexion MySQL -> host={host} port={port} db={database} user={user}")

    conn = mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        autocommit=False,
    )
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT id, title
        FROM questions
        WHERE economicRole = 'all'
          AND title IS NOT NULL
          AND title LIKE '[%]%'
        ORDER BY id ASC
    """)
    rows = cur.fetchall()
    print(f"📦 Lignes à corriger détectées: {len(rows)}")

    updated = 0
    skipped = 0

    for r in rows:
        qid = r["id"]
        title = r["title"] or ""
        role, clean_title = extract_role_and_clean_title(title)

        if not role:
            skipped += 1
            continue

        new_title = clean_title if clean_title else title

        cur.execute(
            "UPDATE questions SET economicRole=%s, title=%s WHERE id=%s",
            (role, new_title, qid),
        )
        updated += 1

        if updated % 200 == 0:
            print(f"✅ {updated} lignes mises à jour...")

    conn.commit()
    print(f"✅ Terminé. updated={updated} skipped={skipped}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
