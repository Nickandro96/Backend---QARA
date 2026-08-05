-- Décision corpus validée par Klauss le 5 août 2026.
-- Référence : décisions corpus Klauss — 2026-08-05.

UPDATE questions
SET isActive = false
WHERE questionKey IN (
  'Q-FDA-CR-3056',
  'Q-FDA-CMC-1104',
  'Q-FDA-CMC-4738',
  'Q-13485-RD-8627',
  'Q-13485-RP-5113',
  'Q-13485-VC-1214',
  'Q-13485-VS-3424',
  'Q-14971-LRPC-4390',
  'Q-14971-PGR-3372',
  'Q-14971-RDR-1036',
  'Q-14971-CR-2327',
  'Q-14971-PGR-4002',
  'Q-14971-DGR-9056',
  'Q-14971-AR-2120',
  'Q-14971-ER-1630',
  'Q-14971-ER-0172',
  'Q-14971-RRI-8371',
  'Q-9001-CD-9497',
  'Q-9001-AI-5121',
  'Q-IVDR-GIG-5848',
  'Q-IVDR-GPCI-4556',
  'Q-IVDR-DPI-0795',
  'Q-IVDR-SFI-9649',
  'Q-IVDR-DP-4992',
  'Q-IVDR-PPI-4092',
  'Q-IVDR-VI-0498',
  'Q-IVDR-AIFI-6588',
  'Q-MDR-GG-4573',
  'Q-MDR-DP-3502',
  'Q-MDR-RP-1835',
  'Q-MDR-SFM-2992',
  'Q-MDR-IC-8284',
  'Q-MDR-PP-2250',
  'Q-MDR-VIGF-0175',
  'Q-MDR-TR-8120',
  'Q-MDR-AIF-0786',
  'Q-MDSAP-MDAE-9314',
  'Q-MDSAP-DD-6533',
  'Q-MDSAP-DD-0982',
  'Q-MDSAP-DD-7756',
  'Q-MDSAP-DD-2102',
  'Q-MDSAP-DD-1719',
  'Q-MDSAP-MAI-8057',
  'Q-MDSAP-MAI-5208',
  'Q-MDSAP-M-3867',
  'Q-MDSAP-M-1076',
  'Q-MDSAP-PSC-2032'
);

-- Vérification attendue (lecture seule) :
-- SELECT COUNT(*) FROM questions WHERE isActive = false;
-- attendu : 47 (si aucune question n'était déjà inactive avant)
