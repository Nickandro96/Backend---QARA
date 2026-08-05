-- Décision corpus validée par Klauss le 5 août 2026.
-- Référence : décisions corpus Klauss — 2026-08-05.

-- Passage à 'medium'
UPDATE questions
SET criticality = 'medium'
WHERE questionKey IN (
  'Q-FDA-SC-6736',
  'Q-FDA-SC-8311',
  'Q-FDA-SQ-4087',
  'Q-13485-PC-2169',
  'Q-IVDR-UI-8855',
  'Q-9001-PE-8987'
);

-- Passage à 'high'
UPDATE questions
SET criticality = 'high'
WHERE questionKey IN (
  'Q-13485-A-4176',
  'Q-13485-PP-6862',
  'Q-13485-DS-6140',
  'Q-13485-DS-7051',
  'Q-13485-AD-1455',
  'Q-13485-AP-7394',
  'Q-IVDR-PI-6667',
  'Q-IVDR-DUCI-5085',
  'Q-IVDR-CAI-3158',
  'Q-MDR-P-9760',
  'Q-MDR-DUC-5437',
  'Q-MDR-MC-0018',
  'Q-MDR-U-8636',
  'Q-MDR-CA-8311',
  'Q-MDSAP-DMAF-1123',
  'Q-MDSAP-M-2185',
  'Q-MDSAP-CSR-2163'
);
