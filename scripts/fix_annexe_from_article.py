import os
import re
from urllib.parse import urlparse, unquote
import mysql.connector

def parse_database_url(db_url: str):
    if not db_url:
        raise SystemExit("❌ DATABASE_URL is missing.")
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

def extract_annexe(article: str) -> str | None:
    """
    Examples:
      'MDR 2017/745 – Article 113' -> 'Article 113'
      'MDR 2017/745 - Article 1'   -> 'Article 1'
    """
    if not article:
        return None
    m = re.search(r"\bArticle\s+(\d+)\b", article, flags=re.IGNORECASE)
    if not m:
        return None
    return f"Article {m.group(1)}"

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

    # Rows where annexe is null/empty but article contains "Article <num>"
    cur.execute("""
        SELECT id, article, annexe
        FROM questions
        WHERE (annexe IS NULL OR annexe = '')
          AND article IS NOT NULL
          AND article LIKE '%Article%'
        ORDER BY id ASC
    """)
    rows = cur.fetchall()
    print(f"📦 Lignes à corriger détectées: {len(rows)}")

    updated = 0
    skipped = 0

    for r in rows:
        qid = r["id"]
        art = r["article"] or ""
        ann = extract_annexe(art)

        if not ann:
            skipped += 1
            continue

        cur.execute(
            "UPDATE questions SET annexe=%s WHERE id=%s",
            (ann, qid),
        )
        updated += 1

        if updated % 500 == 0:
            print(f"✅ {updated} lignes mises à jour...")

    conn.commit()
    print(f"✅ Terminé. updated={updated} skipped={skipped}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
