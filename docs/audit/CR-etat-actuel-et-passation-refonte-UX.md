# Compte-rendu — état actuel de QARA et passation pour l'amélioration UX/design

*Document rédigé pour être compris sans connaissance préalable du projet.
Date : 2026-07-07.*

---

## 1. Le projet, en une minute

**QARA** est une plateforme web qui aide les entreprises du secteur des
dispositifs médicaux à se préparer aux audits de conformité réglementaire
(règlement européen MDR/IVDR, normes ISO 13485/9001/14971, réglementation
américaine FDA, programme international MDSAP). Une entreprise cliente
répond à une série de questions d'audit organisées par thème métier, et
obtient un score de conformité, un plan d'actions correctives, et un
rapport d'audit exportable.

Le contenu du produit (473 questions d'audit, vérifiées une à une sur les
textes réglementaires officiels) et toute la logique métier (calcul du
score, gestion du plan d'actions, génération du rapport) sont **déjà
construits et fonctionnels**. Ce document fait le point après la
validation du déploiement, et transmet à qui va travailler sur
l'expérience utilisateur les constats faits en testant l'application en
conditions réelles.

---

## 2. Bonne nouvelle : le parcours complet fonctionne, de bout en bout

Un environnement de test (copie isolée de l'application, séparée du site
utilisé par les vrais clients) vient d'être mis en place et validé par un
test réel, mené par la main :

1. Création d'un compte, choix du rôle ("fabricant"), des référentiels et
   des processus métier concernés.
2. Démarrage d'un audit MDR — les questions du processus choisi
   s'affichent correctement (62 questions pour l'audit testé).
3. Réponses enregistrées (59 questions répondues sur 62).
4. Tableau de bord de résultats généré automatiquement : score de
   conformité (76 %), répartition conforme/partiel/non-conforme/N-A,
   tableau des principaux écarts avec leur criticité.
5. **Rapport d'audit exporté avec succès** (document `.doc` généré,
   contenant la synthèse et les écarts).

C'est la première fois, sur cet environnement de test, que le parcours
entier — de la création de compte jusqu'au rapport final — a été vérifié
avec des données réelles. C'est un jalon important : la mécanique du
produit fonctionne.

*(Deux bugs techniques ont dû être corrigés avant d'en arriver là — un
problème de configuration serveur, et un problème de classement des 473
questions par thème métier. Le détail complet, pour qui voudrait
l'historique technique, est dans `docs/audit/PROGRESS-deploiement.md`.)*

---

## 3. Un bug concret à corriger : bouton "Liste audits" cassé

En testant la navigation depuis le tableau de bord d'un audit, le bouton
**"Liste audits"** (qui doit ramener à la liste de tous les audits de
l'utilisateur) affiche une page **"404 — Page Not Found"**.

**Cause identifiée avec certitude** : ce bouton essaie d'aller à l'adresse
`/mdr`, qui n'existe pas dans l'application — l'adresse qui contient
vraiment la liste des audits s'appelle `/audits`. C'est une simple erreur
d'adresse dans le code du bouton (fichier
`client/src/pages/MDRAuditReview.tsx`), pas un problème plus profond.
Facile et rapide à corriger.

Il est probable que d'autres boutons/liens de navigation du même type (vu
le nombre de pages de l'application, voir §4) pointent aussi vers de
mauvaises adresses — à vérifier systématiquement en même temps.

---

## 4. Le vrai sujet : l'expérience utilisateur n'est pas encore au niveau visé

Le retour, en testant l'application avec de vraies données, est clair :
**ce n'est pas ludique, pas facile à utiliser, et ça ne fait pas
« premium »**. L'interface et la communication (les textes, les messages,
le ton) ont besoin d'être redynamisés dans leur ensemble.

Ce constat n'est pas une surprise — il confirme un diagnostic déjà posé
avant ce test :
- **51 pages** dans l'application, avec des doublons non nettoyés (deux
  pages d'accueil différentes ; **trois** dossiers de tableau de bord
  distincts qui font à peu près la même chose ; plusieurs variantes
  d'écrans d'audit MDR/ISO/FDA qui ne suivent pas les mêmes règles).
- **Deux systèmes de mise en page différents qui coexistent**, ce qui
  explique en partie des incohérences visuelles et des liens cassés comme
  celui du §3.
- **Aucun composant réutilisable pour les parcours en plusieurs étapes**
  (chaque assistant/wizard réinvente sa propre mécanique).
- Le design de base (palette de couleurs, composants visuels) existe et
  est de bonne qualité — le problème n'est pas l'absence d'outils, c'est
  une **organisation par empilement successif** plutôt que par une vraie
  direction de design d'ensemble.

**Ce qui est bon et doit être conservé** : toute la logique métier
(connectée au serveur et qui fonctionne, voir §2), le système de design de
base (palette, typographie), la bibliothèque de composants visuels déjà en
place, et la traduction multilingue.

**Ce qui doit être repensé** : l'organisation des pages (supprimer les
doublons), le parcours pas-à-pas de l'utilisateur, l'identité visuelle
pour donner une vraie impression de qualité professionnelle, et
**particulièrement l'expérience de réponse au questionnaire d'audit**
(c'est la partie la plus longue et la plus répétitive pour l'utilisateur
— actuellement, ça peut sembler fastidieux plutôt qu'engageant).

---

## 5. Il existe déjà un plan détaillé pour ce chantier

Un cahier des charges complet pour cette refonte a déjà été préparé
(`PROMPT-REFONTE-PREMIUM.md`, fourni par ailleurs). Points clés de ce plan,
pour information de qui reprend ce chantier :

- **Refonte, pas réécriture à zéro** : on garde tout ce qui fonctionne déjà
  bien (logique métier, design system de base, composants), on retravaille
  le visuel, le parcours, et surtout l'expérience du questionnaire.
- **Chantier phare : le questionnaire.** Le rendre agréable — une question
  à la fois, progression visible et motivante, aide contextuelle
  disponible sans surcharger l'écran, sauvegarde automatique, ton
  rassurant et encourageant.
- **Nettoyage structurel en parallèle** : fusionner les pages en double,
  unifier la mise en page, créer un composant générique pour les parcours
  en plusieurs étapes.
- **Niveau de qualité visé** : cohérence visuelle totale, transitions
  fluides, accessibilité, bon rendu sur ordinateur et tablette.
- **Règle de sécurité du chantier** : l'application ne doit jamais cesser
  de fonctionner pendant la refonte — on avance page par page, en gardant
  toujours une version utilisable.

---

## 6. Ce qui reste à faire, dans l'ordre recommandé

1. **Corriger le bouton "Liste audits"** (§3) et vérifier les autres liens
   de navigation similaires — rapide, sans attendre la refonte complète.
2. **Démarrer la refonte premium** en suivant le plan déjà préparé
   (§5) : définir d'abord la nouvelle direction visuelle sur quelques
   écrans de référence, les faire valider, puis propager progressivement
   à toute l'application — en commençant par le questionnaire d'audit,
   le point le plus impactant pour l'utilisateur.
3. Une fois la refonte validée : reprendre les dernières étapes du
   déploiement de test (vérification de sécurité, lien final à partager
   pour des tests plus larges).

---

## 7. En résumé

Le moteur du produit fonctionne, de bout en bout, avec de vraies données —
c'est un vrai jalon franchi. Le prochain chantier, déjà cadré et prêt à
démarrer, consiste à rendre l'expérience aussi bonne que le contenu :
plus agréable, plus simple, et d'un niveau visuel à la hauteur de
l'ambition du produit (« niveau Big Four »). Un bug de navigation mineur
(§3) est à corriger en chemin, sans lien avec ce chantier de fond.
