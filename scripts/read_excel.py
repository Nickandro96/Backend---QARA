import pandas as pd

excel_file_path = "/home/ubuntu/upload/MDR_questionnaire_V4_intelligente.xlsx"

try:
    df = pd.read_excel(excel_file_path)
    print("Colonnes du fichier Excel:")
    print(df.columns.tolist())
    print("\nPremières 5 lignes du fichier Excel:")
    print(df.head().to_markdown(index=False))
except Exception as e:
    print(f"Erreur lors de la lecture du fichier Excel: {e}")
