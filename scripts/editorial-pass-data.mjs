/**
 * QARA — Passe éditoriale du corpus : 45 propositions de reformulation.
 * ATTENTION : elles ne sont pas validées globalement par l'utilisateur ; seul
 * un lot ISO 14971 partiel a été examiné. Ne pas déployer ni appliquer en base.
 * Voir VALIDATION-passe-editoriale.md pour le détail de
 * l'ancrage (title/expectedEvidence/officialSource/texte réglementaire réel)
 * et la justification de chaque reformulation.
 *
 * 13 de ces 45 lignes ont un `title` lui-même tronqué silencieusement à 250
 * caractères dans la source (sans "…", donc non détecté par le diagnostic
 * initial) — marquées `titleTruncated: true` ci-dessous. Pour celles-ci,
 * la reformulation s'ancre sur le `title` disponible complété par le texte
 * réglementaire réel vérifié (21 CFR 860 Subpart D, FD&C 524B, MDR Art.
 * 32/10(14), ISO 9001 Amd.1:2024, MDSAP AU P0002) — jamais inventé.
 */
export const EDITORIAL_REFORMULATIONS = [
  // --- ISO14971 (25) ---
  { questionKey: "Q-14971-MR-4038", referentialCode: "ISO14971", text: "Prenez un risque réel. Quelles mesures avez-vous envisagées, laquelle avez-vous retenue et pourquoi ? Montrez que le risque restant est acceptable." },
  { questionKey: "Q-14971-MR-9272", referentialCode: "ISO14971", text: "Montrez-moi un exemple où l'analyse des risques a conduit à une décision ou à une modification du dispositif. Quelle preuve garde la trace de cette décision ?" },
  { questionKey: "Q-14971-AOM-0896", referentialCode: "ISO14971", text: "Pour un risque réel, avez-vous d'abord cherché à le réduire par la conception, puis par une protection, et enfin par une information de sécurité ? Montrez votre choix." },
  { questionKey: "Q-14971-AOM-5470", referentialCode: "ISO14971", text: "Montrez-moi un exemple où vous avez suivi l'ordre prévu pour réduire un risque. Pourquoi avez-vous retenu cette solution ?" },
  { questionKey: "Q-14971-AOM-2955", referentialCode: "ISO14971", text: "Qui a choisi la mesure utilisée pour réduire le risque ? Montrez les preuves utilisées et comment son efficacité a été vérifiée." },
  { questionKey: "Q-14971-MŒC-8079", referentialCode: "ISO14971", text: "Pour une mesure destinée à réduire un risque, montrez qu'elle a bien été mise en place et qu'elle réduit réellement ce risque." },
  { questionKey: "Q-14971-ABR-2180", referentialCode: "ISO14971", text: "Prenez un risque qui reste trop élevé après les mesures mises en place. Montrez pourquoi il ne pouvait pas être réduit davantage et comment vous avez comparé ce risque aux bénéfices attendus du dispositif." },
  { questionKey: "Q-14971-ABR-5814", referentialCode: "ISO14971", text: "Qui a décidé que les bénéfices du dispositif justifiaient le risque restant ? Montrez les données utilisées, la justification et l'approbation de cette décision." },
  { questionKey: "Q-14971-ABR-6111", referentialCode: "ISO14971", text: "Sur un cas concret, montrez ce qui a été décidé lorsqu'un risque restait trop élevé et qu'aucune mesure supplémentaire n'était possible." },
  { questionKey: "Q-14971-RIC-1049", referentialCode: "ISO14971", text: "Prenez une mesure mise en place pour réduire un risque. A-t-elle créé un nouveau risque ou modifié un risque déjà connu ? Montrez comment vous l'avez vérifié et traité." },
  { questionKey: "Q-14971-RIC-7118", referentialCode: "ISO14971", text: "Comment vérifiez-vous que les mesures prises pour réduire un risque n'en créent pas un autre ? Montrez-moi un exemple réel." },
  { questionKey: "Q-14971-CM-1778", referentialCode: "ISO14971", text: "Montrez-moi que tous les dangers identifiés ont été traités et que toutes les actions prévues ont été terminées et vérifiées." },
  { questionKey: "Q-14971-RRG-7446", referentialCode: "ISO14971", text: "Avant la mise sur le marché, comment avez-vous vérifié que l'ensemble des risques restant sur le dispositif était acceptable ? Montrez le résultat de cette évaluation." },
  { questionKey: "Q-14971-RRG-3515", referentialCode: "ISO14971", text: "Qui a validé que l'ensemble des risques restant sur le dispositif était acceptable ? Montrez les données utilisées et la décision prise." },
  { questionKey: "Q-14971-RGR-9160", referentialCode: "ISO14971", text: "Pour le dernier dispositif libéré, montrez la revue des risques réalisée avant sa libération et la conclusion obtenue." },
  { questionKey: "Q-14971-RGR-3091", referentialCode: "ISO14971", text: "Qui a autorisé la libération du dispositif après la revue des risques ? Montrez les preuves et l'approbation." },
  { questionKey: "Q-14971-RIPP-2086", referentialCode: "ISO14971", text: "Prenez une réclamation, un retour du terrain ou une nouvelle publication. Comment avez-vous vérifié si cette information révélait un nouveau risque ou modifiait un risque connu ?" },
  { questionKey: "Q-14971-RIPP-4764", referentialCode: "ISO14971", text: "Montrez-moi un exemple où une information venant du terrain a conduit à modifier le dossier de risques ou le dispositif." },
  { questionKey: "Q-14971-APP-5733", referentialCode: "ISO14971", text: "Prenez une information reçue après la production qui concernait la sécurité. Quelles actions avez-vous prises sur le dossier de risques et sur les dispositifs déjà sur le marché ?" },
  { questionKey: "Q-14971-APP-7458", referentialCode: "ISO14971", text: "Montrez-moi un exemple où une information venant du terrain a conduit à une décision sur le dispositif. Qui a décidé et pourquoi ?" },
  { questionKey: "Q-14971-APP-9033", referentialCode: "ISO14971", text: "Après une alerte de sécurité venant du terrain, comment avez-vous vérifié que les actions prises étaient efficaces ? Montrez-moi un cas réel." },
  { questionKey: "Q-14971-LRU-1486", referentialCode: "ISO14971", text: "Prenez une erreur d'utilisation possible du dispositif. Comment l'avez-vous identifiée et comment avez-vous réduit le risque associé ?" },
  { questionKey: "Q-14971-LRU-3545", referentialCode: "ISO14971", text: "Comment prenez-vous en compte les mauvaises utilisations que vous pouvez raisonnablement prévoir ? Montrez-moi un exemple." },
  { questionKey: "Q-14971-LRL-8098", referentialCode: "ISO14971", text: "Prenez un risque lié au logiciel ou à la sécurité des données. Montrez comment vous l'avez identifié, évalué et réduit." },
  { questionKey: "Q-14971-LRL-4167", referentialCode: "ISO14971", text: "Comment vérifiez-vous que les risques liés au logiciel et à la cybersécurité sont inclus dans votre analyse des risques ? Montrez-moi un exemple." },

  // --- ISO9001 (6) ---
  { questionKey: "Q-9001-PI-3467", referentialCode: "ISO9001", text: "Quelles personnes ou organisations peuvent influencer votre système qualité, et qu'attendent-elles de vous ? Montrez comment vous suivez l'évolution de leurs attentes." },
  { questionKey: "Q-9001-RO-2538", referentialCode: "ISO9001", text: "Prenez un risque ou une opportunité pour votre système qualité. Qu'avez-vous décidé de faire et comment avez-vous vérifié que cela fonctionnait ?" },
  { questionKey: "Q-9001-RO-9521", referentialCode: "ISO9001", text: "Comment les actions liées aux risques et aux opportunités sont-elles intégrées au travail quotidien ? Montrez-moi un exemple." },
  { questionKey: "Q-9001-CLO-5514", referentialCode: "ISO9001", titleTruncated: true, text: "Quels changements internes ou externes peuvent affecter votre système qualité ? Montrez comment vous avez déterminé si le changement climatique est un sujet important pour votre activité." },
  { questionKey: "Q-9001-PS-7808", referentialCode: "ISO9001", titleTruncated: true, text: "Quels sites, activités, produits et services sont couverts par votre système qualité ? Montrez comment vous avez justifié ce qui n'est pas couvert." },
  { questionKey: "Q-9001-L-0975", referentialCode: "ISO9001", titleTruncated: true, text: "Comment la direction montre-t-elle qu'elle est responsable du système qualité ? Donnez un exemple de décision prise ou de ressource accordée." },

  // --- IVDR (3) ---
  { questionKey: "Q-IVDR-MSMI-5641", referentialCode: "IVDR", text: "Avant de mettre un DIV sur le marché, quels contrôles réalisez-vous pour vérifier qu'il respecte l'IVDR et qu'il est utilisé comme prévu ? Montrez un dossier réel." },
  { questionKey: "Q-IVDR-PI-0993", referentialCode: "IVDR", text: "Pour votre dernier rapport périodique de sécurité applicable, montrez qu'il a été mis à jour, approuvé et transmis comme prévu." },
  { questionKey: "Q-IVDR-GIUI-6261", referentialCode: "IVDR", text: "Prenez un DIV commercialisé. Montrez que son étiquette et sa notice sont lisibles, conformes et approuvées avant utilisation." },

  // --- FDA_QMSR (7) ---
  { questionKey: "Q-FDA-5K-1069", referentialCode: "FDA_QMSR", text: "Pour un dossier 510(k) récent, pourquoi avez-vous choisi le dispositif de comparaison et quelles preuves montrent que votre dispositif est aussi sûr et efficace ?" },
  { questionKey: "Q-FDA-N-2561", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Pour un dossier De Novo, pourquoi cette voie a-t-elle été choisie et pourquoi aucun dispositif de comparaison adapté n'existait-il ?" },
  { questionKey: "Q-FDA-N-1933", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Qui a validé le choix de la voie De Novo ? Montrez l'analyse des risques et les preuves utilisées pour cette décision." },
  { questionKey: "Q-FDA-N-6492", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Pour un dossier De Novo accepté, montrez la décision de la FDA et les contrôles particuliers que vous devez maintenant respecter." },
  { questionKey: "Q-FDA-SQ-5662", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Prenez un fournisseur critique. Comment l'avez-vous choisi, contrôlé et suivi ? Montrez les résultats les plus récents." },
  { questionKey: "Q-FDA-SC-6736", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Pour un dispositif connecté récent, montrez comment la cybersécurité a été prise en compte depuis la conception jusqu'à la validation, y compris la liste des composants logiciels." },
  { questionKey: "Q-FDA-SC-4677", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Comment surveillez-vous et corrigez-vous les failles de cybersécurité après la mise sur le marché ? Montrez-moi un exemple réel." },

  // --- MDR (3) ---
  { questionKey: "Q-MDR-S-3363", referentialCode: "MDR", titleTruncated: true, text: "Pour un dispositif implantable ou de classe III, montrez que le résumé de sécurité et de performances est compréhensible, validé par l'organisme notifié et publié dans Eudamed." },
  { questionKey: "Q-MDR-S-5062", referentialCode: "MDR", titleTruncated: true, text: "Qui vérifie et met à jour le résumé de sécurité et de performances ? Montrez la dernière version et son approbation." },
  { questionKey: "Q-MDR-SM-0792", referentialCode: "MDR", titleTruncated: true, text: "Montrez la dernière demande reçue d'une autorité et votre réponse. Avez-vous fourni tous les documents et échantillons demandés dans la langue acceptée ?" },

  // --- MDSAP (1) ---
  { questionKey: "Q-MDSAP-PL-3453", referentialCode: "MDSAP", titleTruncated: true, text: "Montrez-moi un exemple où un problème trouvé dans un processus a conduit à contrôler plus en détail un autre processus lié." },
];
