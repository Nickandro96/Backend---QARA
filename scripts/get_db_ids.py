
import os
import mysql.connector
import json

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "audit_user"),
        password=os.getenv("DB_PASSWORD", "audit_password"),
        database=os.getenv("DB_NAME", "audit_db")
    )

def fetch_referential_and_process_ids():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Fetch referentials
        cursor.execute("SELECT id, name FROM referentials")
        referentials = cursor.fetchall()
        referential_map = {r["name"].lower(): r["id"] for r in referentials}
        print("Referentials:", json.dumps(referential_map, indent=2))

        # Fetch processes
        cursor.execute("SELECT id, name FROM processes")
        processes = cursor.fetchall()
        process_map = {p["name"].lower(): p["id"] for p in processes}
        print("Processes:", json.dumps(process_map, indent=2))

        return referential_map, process_map

    except mysql.connector.Error as err:
        print(f"Error: {err}")
        return {}, {}
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    fetch_referential_and_process_ids()
