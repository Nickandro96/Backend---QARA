def get_column_type(cur, table: str, col: str) -> str:
    cur.execute("""
      SELECT DATA_TYPE, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s
      LIMIT 1
    """, (table, col))
    row = cur.fetchone()
    if not row:
        return ""
    # row = (DATA_TYPE, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH)
    return f"{row[0]}|{row[1]}|{row[2]}"

def normalize_criticality_value(v: str | None):
    """
    Returns canonical level: LOW / MEDIUM / HIGH / CRITICAL or None
    Accepts numbers, french labels, etc.
    """
    if not v:
        return None
    s = str(v).strip().lower()
    if s in ("nan", ""):
        return None

    # numeric forms
    # examples: 1,2,3,4 or 1/4, 3/5 etc.
    import re
    m = re.match(r"^\s*(\d+)\s*(?:/(\d+))?\s*$", s)
    if m:
        n = int(m.group(1))
        # map 1-4
        if n <= 1:
            return "LOW"
        if n == 2:
            return "MEDIUM"
        if n == 3:
            return "HIGH"
        return "CRITICAL"

    # french labels
    if any(x in s for x in ["faible", "low", "mineur", "minor"]):
        return "LOW"
    if any(x in s for x in ["moyen", "medium", "modere", "modérée", "moderate"]):
        return "MEDIUM"
    if any(x in s for x in ["eleve", "élev", "high", "majeur", "major"]):
        return "HIGH"
    if any(x in s for x in ["crit", "critical", "severe", "sévère"]):
        return "CRITICAL"

    # fallback: keep as text but uppercase (better than failing)
    return s.upper()[:50]

def cast_criticality_for_db(canonical: str | None, col_type_info: str):
    """
    Adapts canonical to DB column type.
    - If INT/SMALLINT/TINYINT => returns 1..4
    - If ENUM => returns matching value if possible
    - Else returns canonical string
    """
    if not canonical:
        return None

    data_type, column_type, _maxlen = (col_type_info.split("|") + ["", "", ""])[:3]
    data_type = (data_type or "").lower()
    column_type = (column_type or "").lower()

    mapping_num = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

    if data_type in ("int", "tinyint", "smallint", "mediumint", "bigint", "decimal", "float", "double"):
        return mapping_num.get(canonical, None)

    if data_type == "enum":
        # enum('low','medium','high'...) – try to match
        # extract allowed values
        allowed = []
        import re
        for m in re.finditer(r"'([^']*)'", column_type):
            allowed.append(m.group(1).lower())
        c = canonical.lower()
        # try direct
        if c in allowed:
            return c
        # try common variants
        synonyms = {
            "low": ["low", "faible", "minor"],
            "medium": ["medium", "moyen", "moderate"],
            "high": ["high", "eleve", "élevé", "major"],
            "critical": ["critical", "critique", "severe", "sévère"],
        }
        for k, vals in synonyms.items():
            if canonical.upper() == k.upper() and any(v in allowed for v in vals):
                # pick first present
                for v in vals:
                    if v in allowed:
                        return v
        # fallback to first allowed to avoid crash (or None)
        return allowed[0] if allowed else None

    # varchar/text/etc
    return canonical
