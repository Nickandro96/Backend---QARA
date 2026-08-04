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
  { questionKey: "Q-9001-PI-3467", referentialCode: "ISO9001", text: "Montrez-moi, sur un cas réel récent, comment vous déterminez et surveillez les parties intéressées pertinentes et leurs exigences — y compris, le cas échéant, des exigences liées aux changements climatiques (Amd.1:2024) — et où en est la preuve." },
  { questionKey: "Q-9001-RO-2538", referentialCode: "ISO9001", text: "Choisissons un risque ou une opportunité réel(le) affectant votre SMQ : déroulez comment il/elle a été identifié(e) lors de la planification (6.1), quelles actions ont été engagées pour le traiter, et comment leur efficacité a été évaluée." },
  { questionKey: "Q-9001-RO-9521", referentialCode: "ISO9001", text: "Montrez-moi, sur un cas réel récent, comment la planification des risques et opportunités affectant votre SMQ (6.1) débouche sur des actions proportionnées, intégrées à vos processus et dont l'efficacité est évaluée." },
  { questionKey: "Q-9001-CLO-5514", referentialCode: "ISO9001", titleTruncated: true, text: "Montrez-moi, sur un cas réel récent, comment vous déterminez et surveillez les enjeux externes et internes pertinents pour la finalité, l'orientation stratégique et les résultats attendus de votre SMQ — y compris, depuis l'Amendement 1:2024, la détermination de la pertinence des changements climatiques comme enjeu — et où en est la preuve." },
  { questionKey: "Q-9001-PS-7808", referentialCode: "ISO9001", titleTruncated: true, text: "Montrez-moi, sur un cas réel récent, comment vous avez déterminé le domaine d'application de votre SMQ (enjeux 4.1, parties intéressées 4.2, produits/services), et comment toute exigence jugée non applicable est justifiée par écrit, sans incidence sur la conformité des produits/services ni sur la satisfaction client." },
  { questionKey: "Q-9001-L-0975", referentialCode: "ISO9001", titleTruncated: true, text: "Montrez-moi, sur un cas réel récent, comment la direction démontre son leadership et son engagement envers le SMQ — responsabilité de son efficacité, intégration aux processus métiers, ressources allouées — y compris l'orientation client (5.1.2) : exigences client déterminées et satisfaites, risques et opportunités affectant la conformité traités." },

  // --- IVDR (3) ---
  { questionKey: "Q-IVDR-MSMI-5641", referentialCode: "IVDR", text: "Montrez-moi, sur un cas réel récent, comment vous garantissez qu'un DIV n'est mis sur le marché que s'il respecte l'IVDR et sa destination, et où en est la preuve." },
  { questionKey: "Q-IVDR-PI-0993", referentialCode: "IVDR", text: "Montrez-moi, sur un cas réel récent, comment le PSUR (rapport périodique de sécurité), lorsqu'applicable à votre DIV, est actualisé et transmis conformément aux exigences de l'Art. 81, et où en est la preuve." },
  { questionKey: "Q-IVDR-GIUI-6261", referentialCode: "IVDR", text: "Montrez-moi, sur un cas réel récent, comment vous garantissez que l'étiquetage et la notice d'utilisation de votre DIV sont conformes, lisibles et validés, et où en est la preuve." },

  // --- FDA_QMSR (7) ---
  { questionKey: "Q-FDA-5K-1069", referentialCode: "FDA_QMSR", text: "Montrez-moi, sur un cas réel récent de soumission 510(k), comment le choix de voie, la comparaison au predicate et la démonstration de substantial equivalence (FD&C 513(i)) ont été conduits — contenu de la soumission (§807.87) et résumé/déclaration SE (§807.92-93) — et où en est la preuve." },
  { questionKey: "Q-FDA-N-2561", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Choisissons un dossier De Novo réel (FD&C 513(f)(2), 21 CFR 860 Subpart D) pour un dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé : déroulez le contenu du dossier, sa recevabilité, les délais respectés et les effets de l'ordre de classification obtenu (contrôles spéciaux applicables, base pour de futurs 510(k))." },
  { questionKey: "Q-FDA-N-1933", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Montrez-moi comment le choix de la voie De Novo pour un dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé relie votre analyse de risques à la décision de classification et aux contrôles spéciaux qui en découlent." },
  { questionKey: "Q-FDA-N-6492", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Déroulez un dossier De Novo réel du contenu de la demande jusqu'à l'ordre de classification obtenu : quelle décision, par qui, sur quelle preuve, avec quel contrôle d'efficacité sur les contrôles spéciaux applicables ?" },
  { questionKey: "Q-FDA-SQ-5662", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Prenez un fournisseur critique : montrez-moi comment la maîtrise des achats et des fournisseurs (QMSR 21 CFR 820.10, via ISO 13485 §7.4 incorporée par référence au §820.7) est appliquée — critères d'évaluation/sélection/surveillance proportionnés au risque, informations d'achat, vérification du produit acheté, rapports de performance fournisseur — de la sélection à la surveillance des performances." },
  { questionKey: "Q-FDA-SC-6736", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Ouvrons le dernier dossier de conception concerné par les exigences de cybersécurité pour les « cyber devices » (FD&C 524B) — plan de surveillance et de correction des vulnérabilités, processus assurant la cybersécurité, nomenclature logicielle (SBOM), intégrés au design control (ISO 13485 §7.3) — : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation." },
  { questionKey: "Q-FDA-SC-4677", referentialCode: "FDA_QMSR", titleTruncated: true, text: "Montrez-moi, sur un cas réel récent, comment le plan de surveillance et de correction des vulnérabilités, le processus assurant la cybersécurité et la nomenclature logicielle (SBOM) exigés pour les « cyber devices » (FD&C 524B) sont intégrés à votre design control (ISO 13485 §7.3), et où en est la preuve." },

  // --- MDR (3) ---
  { questionKey: "Q-MDR-S-3363", referentialCode: "MDR", titleTruncated: true, text: "Montrez-moi, sur un cas réel récent, comment le résumé des caractéristiques de sécurité et des performances cliniques (SSCP) de votre dispositif implantable ou de classe III est rédigé de manière compréhensible pour l'utilisateur prévu (et le grand public le cas échéant), validé par l'organisme notifié et téléversé dans Eudamed." },
  { questionKey: "Q-MDR-S-5062", referentialCode: "MDR", titleTruncated: true, text: "Déroulez un cas concret de SSCP pour un dispositif implantable ou de classe III : contenu, validation par l'organisme notifié, téléversement dans Eudamed — quelle décision, par qui, sur quelle preuve, avec quel contrôle d'efficacité ?" },
  { questionKey: "Q-MDR-SM-0792", referentialCode: "MDR", titleTruncated: true, text: "Montrez-moi, sur un cas réel récent, comment vous avez répondu à une demande motivée d'une autorité compétente : fourniture de toute l'information et documentation démontrant la conformité (dans une langue officielle acceptée), accès donné et échantillons remis si demandés." },

  // --- MDSAP (1) ---
  { questionKey: "Q-MDSAP-PL-3453", referentialCode: "MDSAP", titleTruncated: true, text: "Montrez-moi, sur un cas réel récent, comment des informations issues d'un processus (non-conformité, réclamation, donnée de surveillance) ont orienté l'échantillonnage et la profondeur d'audit d'un processus lié, conformément à l'approche d'audit MDSAP (AU P0002) — et où en est la preuve." },
];
