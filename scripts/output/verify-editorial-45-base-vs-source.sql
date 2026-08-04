-- QARA — comparaison exhaustive base ↔ source pour les 45 reformulations
-- Lecture seule : cette requête ne modifie aucune donnée.
-- Résultat attendu : 45 lignes, total_controles = 45, total_identiques = 45,
-- total_differents = 0, total_absents = 0.

SELECT
  e.questionKey,
  CASE
    WHEN q.questionKey IS NULL THEN 'ABSENT'
    WHEN BINARY q.questionText = BINARY e.expectedText THEN 'IDENTIQUE'
    ELSE 'DIFFERENT'
  END AS statut,
  q.questionText AS texte_base,
  e.expectedText AS texte_source,
  COUNT(*) OVER () AS total_controles,
  SUM(CASE WHEN BINARY q.questionText = BINARY e.expectedText THEN 1 ELSE 0 END) OVER () AS total_identiques,
  SUM(CASE WHEN q.questionKey IS NOT NULL AND BINARY q.questionText <> BINARY e.expectedText THEN 1 ELSE 0 END) OVER () AS total_differents,
  SUM(CASE WHEN q.questionKey IS NULL THEN 1 ELSE 0 END) OVER () AS total_absents
FROM (
SELECT 'Q-MDR-S-3363' AS questionKey, 'Pour un dispositif implantable ou de classe III, montrez que le résumé de sécurité et de performances est compréhensible, validé par l''organisme notifié et publié dans Eudamed.' AS expectedText
UNION ALL SELECT 'Q-MDR-S-5062' AS questionKey, 'Qui vérifie et met à jour le résumé de sécurité et de performances ? Montrez la dernière version et son approbation.' AS expectedText
UNION ALL SELECT 'Q-MDR-SM-0792' AS questionKey, 'Montrez la dernière demande reçue d''une autorité et votre réponse. Avez-vous fourni tous les documents et échantillons demandés dans la langue acceptée ?' AS expectedText
UNION ALL SELECT 'Q-IVDR-MSMI-5641' AS questionKey, 'Avant de mettre un DIV sur le marché, quels contrôles réalisez-vous pour vérifier qu''il respecte l''IVDR et qu''il est utilisé comme prévu ? Montrez un dossier réel.' AS expectedText
UNION ALL SELECT 'Q-IVDR-PI-0993' AS questionKey, 'Pour votre dernier rapport périodique de sécurité applicable, montrez qu''il a été mis à jour, approuvé et transmis comme prévu.' AS expectedText
UNION ALL SELECT 'Q-IVDR-GIUI-6261' AS questionKey, 'Prenez un DIV commercialisé. Montrez que son étiquette et sa notice sont lisibles, conformes et approuvées avant utilisation.' AS expectedText
UNION ALL SELECT 'Q-FDA-5K-1069' AS questionKey, 'Pour un dossier 510(k) récent, pourquoi avez-vous choisi le dispositif de comparaison et quelles preuves montrent que votre dispositif est aussi sûr et efficace ?' AS expectedText
UNION ALL SELECT 'Q-FDA-N-2561' AS questionKey, 'Pour un dossier De Novo, pourquoi cette voie a-t-elle été choisie et pourquoi aucun dispositif de comparaison adapté n''existait-il ?' AS expectedText
UNION ALL SELECT 'Q-FDA-N-1933' AS questionKey, 'Qui a validé le choix de la voie De Novo ? Montrez l''analyse des risques et les preuves utilisées pour cette décision.' AS expectedText
UNION ALL SELECT 'Q-FDA-N-6492' AS questionKey, 'Pour un dossier De Novo accepté, montrez la décision de la FDA et les contrôles particuliers que vous devez maintenant respecter.' AS expectedText
UNION ALL SELECT 'Q-FDA-SQ-5662' AS questionKey, 'Prenez un fournisseur critique. Comment l''avez-vous choisi, contrôlé et suivi ? Montrez les résultats les plus récents.' AS expectedText
UNION ALL SELECT 'Q-FDA-SC-6736' AS questionKey, 'Pour un dispositif connecté récent, montrez comment la cybersécurité a été prise en compte depuis la conception jusqu''à la validation, y compris la liste des composants logiciels.' AS expectedText
UNION ALL SELECT 'Q-FDA-SC-4677' AS questionKey, 'Comment surveillez-vous et corrigez-vous les failles de cybersécurité après la mise sur le marché ? Montrez-moi un exemple réel.' AS expectedText
UNION ALL SELECT 'Q-MDSAP-PL-3453' AS questionKey, 'Montrez-moi un exemple où un problème trouvé dans un processus a conduit à contrôler plus en détail un autre processus lié.' AS expectedText
UNION ALL SELECT 'Q-14971-MR-4038' AS questionKey, 'Prenez un risque réel. Quelles mesures avez-vous envisagées, laquelle avez-vous retenue et pourquoi ? Montrez que le risque restant est acceptable.' AS expectedText
UNION ALL SELECT 'Q-14971-MR-9272' AS questionKey, 'Montrez-moi un exemple où l''analyse des risques a conduit à une décision ou à une modification du dispositif. Quelle preuve garde la trace de cette décision ?' AS expectedText
UNION ALL SELECT 'Q-14971-AOM-0896' AS questionKey, 'Pour un risque réel, avez-vous d''abord cherché à le réduire par la conception, puis par une protection, et enfin par une information de sécurité ? Montrez votre choix.' AS expectedText
UNION ALL SELECT 'Q-14971-AOM-5470' AS questionKey, 'Montrez-moi un exemple où vous avez suivi l''ordre prévu pour réduire un risque. Pourquoi avez-vous retenu cette solution ?' AS expectedText
UNION ALL SELECT 'Q-14971-AOM-2955' AS questionKey, 'Qui a choisi la mesure utilisée pour réduire le risque ? Montrez les preuves utilisées et comment son efficacité a été vérifiée.' AS expectedText
UNION ALL SELECT 'Q-14971-MŒC-8079' AS questionKey, 'Pour une mesure destinée à réduire un risque, montrez qu''elle a bien été mise en place et qu''elle réduit réellement ce risque.' AS expectedText
UNION ALL SELECT 'Q-14971-ABR-2180' AS questionKey, 'Prenez un risque qui reste trop élevé après les mesures mises en place. Montrez pourquoi il ne pouvait pas être réduit davantage et comment vous avez comparé ce risque aux bénéfices attendus du dispositif.' AS expectedText
UNION ALL SELECT 'Q-14971-ABR-5814' AS questionKey, 'Qui a décidé que les bénéfices du dispositif justifiaient le risque restant ? Montrez les données utilisées, la justification et l''approbation de cette décision.' AS expectedText
UNION ALL SELECT 'Q-14971-ABR-6111' AS questionKey, 'Sur un cas concret, montrez ce qui a été décidé lorsqu''un risque restait trop élevé et qu''aucune mesure supplémentaire n''était possible.' AS expectedText
UNION ALL SELECT 'Q-14971-RIC-1049' AS questionKey, 'Prenez une mesure mise en place pour réduire un risque. A-t-elle créé un nouveau risque ou modifié un risque déjà connu ? Montrez comment vous l''avez vérifié et traité.' AS expectedText
UNION ALL SELECT 'Q-14971-RIC-7118' AS questionKey, 'Comment vérifiez-vous que les mesures prises pour réduire un risque n''en créent pas un autre ? Montrez-moi un exemple réel.' AS expectedText
UNION ALL SELECT 'Q-14971-CM-1778' AS questionKey, 'Montrez-moi que tous les dangers identifiés ont été traités et que toutes les actions prévues ont été terminées et vérifiées.' AS expectedText
UNION ALL SELECT 'Q-14971-RRG-7446' AS questionKey, 'Avant la mise sur le marché, comment avez-vous vérifié que le risque résiduel global du dispositif était acceptable ? Montrez le résultat de cette évaluation.' AS expectedText
UNION ALL SELECT 'Q-14971-RRG-3515' AS questionKey, 'Qui a approuvé l''acceptabilité du risque résiduel global du dispositif ? Montrez les données utilisées et la décision prise.' AS expectedText
UNION ALL SELECT 'Q-14971-RGR-9160' AS questionKey, 'Pour le dernier dispositif libéré, montrez la revue des risques réalisée avant sa libération et la conclusion obtenue.' AS expectedText
UNION ALL SELECT 'Q-14971-RGR-3091' AS questionKey, 'Qui a autorisé la libération du dispositif après la revue des risques ? Montrez les preuves et l''approbation.' AS expectedText
UNION ALL SELECT 'Q-14971-RIPP-2086' AS questionKey, 'Prenez une réclamation, un retour du terrain ou une nouvelle publication. Comment avez-vous vérifié si cette information révélait un nouveau risque ou modifiait un risque connu ?' AS expectedText
UNION ALL SELECT 'Q-14971-RIPP-4764' AS questionKey, 'Montrez-moi un exemple où une information venant du terrain a conduit à modifier le dossier de risques ou le dispositif.' AS expectedText
UNION ALL SELECT 'Q-14971-APP-5733' AS questionKey, 'Prenez une information reçue après la production qui concernait la sécurité. Quelles actions avez-vous prises sur le dossier de risques et sur les dispositifs déjà sur le marché ?' AS expectedText
UNION ALL SELECT 'Q-14971-APP-7458' AS questionKey, 'Montrez-moi un exemple où une information venant du terrain a conduit à une décision sur le dispositif. Qui a décidé et pourquoi ?' AS expectedText
UNION ALL SELECT 'Q-14971-APP-9033' AS questionKey, 'Après une alerte de sécurité venant du terrain, comment avez-vous vérifié que les actions prises étaient efficaces ? Montrez-moi un cas réel.' AS expectedText
UNION ALL SELECT 'Q-14971-LRU-1486' AS questionKey, 'Prenez une erreur d''utilisation possible du dispositif. Comment l''avez-vous identifiée et comment avez-vous réduit le risque associé ?' AS expectedText
UNION ALL SELECT 'Q-14971-LRU-3545' AS questionKey, 'Comment prenez-vous en compte les mauvaises utilisations que vous pouvez raisonnablement prévoir ? Montrez-moi un exemple.' AS expectedText
UNION ALL SELECT 'Q-14971-LRL-8098' AS questionKey, 'Prenez un risque lié au logiciel ou à la sécurité des données. Montrez comment vous l''avez identifié, évalué et réduit.' AS expectedText
UNION ALL SELECT 'Q-14971-LRL-4167' AS questionKey, 'Comment vérifiez-vous que les risques liés au logiciel et à la cybersécurité sont inclus dans votre analyse des risques ? Montrez-moi un exemple.' AS expectedText
UNION ALL SELECT 'Q-9001-PI-3467' AS questionKey, 'Quelles personnes ou organisations peuvent influencer votre système qualité, et qu''attendent-elles de vous ? Montrez comment vous suivez l''évolution de leurs attentes.' AS expectedText
UNION ALL SELECT 'Q-9001-RO-2538' AS questionKey, 'Prenez un risque ou une opportunité pour votre système qualité. Qu''avez-vous décidé de faire et comment avez-vous vérifié que cela fonctionnait ?' AS expectedText
UNION ALL SELECT 'Q-9001-RO-9521' AS questionKey, 'Comment les actions liées aux risques et aux opportunités sont-elles intégrées au travail quotidien ? Montrez-moi un exemple.' AS expectedText
UNION ALL SELECT 'Q-9001-CLO-5514' AS questionKey, 'Quels changements internes ou externes peuvent affecter votre système qualité ? Montrez comment vous avez déterminé si le changement climatique est un sujet important pour votre activité.' AS expectedText
UNION ALL SELECT 'Q-9001-PS-7808' AS questionKey, 'Quels sites, activités, produits et services sont couverts par votre système qualité ? Montrez comment vous avez justifié ce qui n''est pas couvert.' AS expectedText
UNION ALL SELECT 'Q-9001-L-0975' AS questionKey, 'Comment la direction montre-t-elle qu''elle est responsable du système qualité ? Donnez un exemple de décision prise ou de ressource accordée.' AS expectedText
) AS e
LEFT JOIN questions AS q ON q.questionKey = e.questionKey
ORDER BY
  CASE
    WHEN q.questionKey IS NULL THEN 0
    WHEN BINARY q.questionText <> BINARY e.expectedText THEN 1
    ELSE 2
  END,
  e.questionKey;
