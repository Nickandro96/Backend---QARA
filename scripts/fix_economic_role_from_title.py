import os
import re
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
    s = s.strip().lower()
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

def main():
    db_host = os.environ.get("MYSQLHOST")
    db_port = int(os.environ.get("MYSQLPORT", "3306"))
    db_user = os.environ.get("MYSQLUSER")
    db_pass = os.environ.get("MYSQLPASSWORD")
    db_name = os.environ.get("MYSQLDATABASE")

    if not all([db_host, db_user, db_pass, db_name]):
        raise SystemExit("❌ Missing MySQL env vars (MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE).")

    print(f"🔌 Connexion MySQL -> host={db_host} port={db_port} db={db_name} user={db_user}")

    conn = mysql.connector.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_pass,
        database=db_name,
        autocommit=False,
    )
    cur = conn.cursor(dictionary=True)

    # Corrige uniquement economicRole='all' et title commençant par '['
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

        # title nettoyé sans le [Rôle]
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
