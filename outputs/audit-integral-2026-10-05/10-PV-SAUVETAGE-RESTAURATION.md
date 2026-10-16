# PV sauvegarde/restauration — état de preuve

## Preuve disponible

Une restauration isolée antérieure a retourné code 0, RTO 2,22 minutes et RPO mesuré 10,06 minutes. Les volumes comparés étaient identiques : users 4/4, audits 55/55, audit_responses 480/480, capa_actions 29/29, questions 485/485, regulatory_updates 691/691. La base temporaire a ensuite été supprimée et son absence vérifiée.

## Ce qui manque pour fermer le P0 exploitation

- exécution automatique quotidienne démontrée ;
- manifeste horodaté avec taille, durée et SHA-256 ;
- seuil anti-fichier vide/anormalement petit ;
- stockage chiffré hors service principal ;
- rétention 7/4/12 ou politique approuvée ;
- alerte e-mail d'échec et d'âge maximal ;
- journal de 14 exécutions valides.

**Verdict : restauration ponctuelle prouvée, industrialisation non prouvée.**
