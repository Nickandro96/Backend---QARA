
import os
import mysql.connector

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "audit_user"),
        password=os.getenv("DB_PASSWORD", "audit_password"),
        database=os.getenv("DB_NAME", "audit_db")
    )

def seed_referentials_and_processes():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Insert default referentials if they don\\'t exist
        referentials_to_insert = [
            ("MDR", "MDR 2017/745", "Règlement (UE) 2017/745 relatif aux dispositifs médicaux", "2017/745"),
            ("ISO_13485", "ISO 13485:2016", "Dispositifs médicaux - Systèmes de management de la qualité", "2016"),
            ("ISO_9001", "ISO 9001:2015", "Systèmes de management de la qualité - Exigences", "2015"),
        ]
        for code, name, description, version in referentials_to_insert:
            cursor.execute("INSERT IGNORE INTO referentials (code, name, description, version) VALUES (%s, %s, %s, %s)", (code, name, description, version))
        conn.commit()
        print(f"Inserted/Updated {cursor.rowcount} referentials.")

        # Insert default processes if they don\\'t exist
        processes_to_insert = [
            ("Gouvernance & stratégie réglementaire", "Gestion de la conformité réglementaire et de la stratégie d\\'entreprise", 1, "settings"),
            ("Affaires réglementaires (RA)", "Activités liées à l\\'enregistrement et à la mise sur le marché des produits", 2, "file-text"),
            ("Système de management qualité (QMS)", "Maîtrise du SMQ", 3, "award"),
            ("Achats & fournisseurs", "Gestion des fournisseurs et des matières premières", 4, "shopping-cart"),
            ("Distribution & logistique", "Gestion de la chaîne d\\'approvisionnement et distribution", 5, "truck"),
            ("Production & sous-traitance", "Fabrication et contrôle des produits", 6, "factory"),
            ("Non-conformités & CAPA", "Gestion des non-conformités et actions correctives/préventives", 7, "alert-triangle"),
            ("Conception & développement", "Conception et développement des dispositifs médicaux", 8, "tool"),
            ("PMS", "Surveillance après commercialisation", 9, "activity"),
            ("Vigilance & incidents", "Gestion des incidents et des actions correctives de sécurité", 10, "bell"),
            ("Documentation technique", "Gestion de la documentation produit", 11, "file"),
            ("Gestion des risques (ISO 14971)", "Analyse des risques selon ISO 14971", 12, "shield"),
            ("IT", "Gestion des systèmes d\\'information", 13, "monitor"),
            ("Importation", "Processus d\\'importation des produits", 14, "package"),
            ("PMCF", "Suivi clinique après commercialisation", 15, "activity"),
            ("Traçabilité & UDI", "Gestion de la traçabilité et de l\\'UDI", 16, "tag"),
            ("cybersécurité (si applicable)", "Gestion de la cybersécurité", 17, "lock"),
            ("données", "Gestion des données", 18, "database"),
        ]
        
        # Add existing processes to avoid duplicates and update if necessary
        existing_processes = {}
        cursor.execute("SELECT name, displayOrder FROM processes")
        for name, display_order in cursor.fetchall():
            existing_processes[name] = display_order

        for name, description, display_order, icon in processes_to_insert:
            if name not in existing_processes:
                cursor.execute("INSERT INTO processes (name, description, displayOrder, icon) VALUES (%s, %s, %s, %s)", (name, description, display_order, icon))
            elif existing_processes[name] != display_order: # Update display order if changed
                cursor.execute("UPDATE processes SET description=%s, displayOrder=%s, icon=%s WHERE name=%s", (description, display_order, icon, name))
        conn.commit()
        print(f"Inserted/Updated processes.")

    except mysql.connector.Error as err:
        print(f"Error: {err}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    seed_referentials_and_processes()
