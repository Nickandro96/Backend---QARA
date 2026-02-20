/* Set stable display order for the 15 canonical processes */
UPDATE processus SET displayOrder = 1  WHERE slug = 'governance_strategy';
UPDATE processus SET displayOrder = 2  WHERE slug = 'regulatory_affairs';
UPDATE processus SET displayOrder = 3  WHERE slug = 'qms';
UPDATE processus SET displayOrder = 4  WHERE slug = 'risk_management';
UPDATE processus SET displayOrder = 5  WHERE slug = 'design_development';
UPDATE processus SET displayOrder = 6  WHERE slug = 'purchasing_suppliers';
UPDATE processus SET displayOrder = 7  WHERE slug = 'production_subcontract';
UPDATE processus SET displayOrder = 8  WHERE slug = 'traceability_udi';
UPDATE processus SET displayOrder = 9  WHERE slug = 'pms_pmcf';
UPDATE processus SET displayOrder = 10 WHERE slug = 'vigilance_incidents';
UPDATE processus SET displayOrder = 11 WHERE slug = 'distribution_logistics';
UPDATE processus SET displayOrder = 12 WHERE slug = 'importation';
UPDATE processus SET displayOrder = 13 WHERE slug = 'technical_documentation';
UPDATE processus SET displayOrder = 14 WHERE slug = 'audits_compliance';
UPDATE processus SET displayOrder = 15 WHERE slug = 'it_data_cybersecurity';