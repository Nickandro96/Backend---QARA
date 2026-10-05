# Procédure d’incident QARA

Version : 1.0  
Date : 5 octobre 2026  
Décideur : Nick Ngankep / N3-Conseil / Q-Ops Services

## 1. Niveaux de priorité

### P0 — Service indisponible ou perte de données

- Délai de prise en charge : 30 minutes
- Délai de résolution cible : 4 heures
- Notification client : dans les 30 minutes
- Mises à jour : toutes les heures jusqu’à résolution
- Post-mortem : dans les 48 heures

### P1 — Fonctionnalité critique dégradée

Exemples : PDF défaillant, CAPA non enregistrée, questionnaire bloqué.

- Délai de prise en charge : 2 heures ouvrées
- Délai de résolution cible : 24 heures

### P2 — Fonctionnalité secondaire dégradée

Exemples : affichage incorrect, lenteur, anomalie non bloquante.

- Délai de prise en charge : 1 jour ouvré
- Délai de résolution cible : 72 heures

## 2. Contacts

- Responsable principal : Nick Ngankep
- Canal client : e-mail uniquement, `infos@n3-conseil.com`
- Disponibilité : du lundi au vendredi, de 9 h à 18 h, heure de Paris, hors jours fériés
- Suppléant : aucun suppléant désigné
- Adresse technique de réception des alertes : `nickandroklauss@gmail.com`

En dehors des horaires annoncés, les demandes reçues à `infos@n3-conseil.com` sont prises en charge à la prochaine ouverture, sauf détection automatique d’un incident P0.

## 3. Détection

Sources d’alerte :

- e-mail UptimeRobot signalant le backend ou le frontend indisponible ;
- signalement client envoyé à `infos@n3-conseil.com` ;
- vérification manuelle quotidienne pendant la phase de go commercial contrôlé.

En cas d’alerte UptimeRobot :

1. Vérifier `https://backend-qara-new-claude.up.railway.app/healthz`.
   - HTTP 200 et `database: connected` : service sain ou fausse alerte possible.
   - HTTP 503 ou délai dépassé : incident confirmé.
2. Vérifier Railway → Backend---QARA → Logs.
3. Vérifier Railway → MySQL-vr64 → Metrics.
4. Vérifier Vercel → Deployments.

## 4. Checklist de résolution P0

### Diagnostic — objectif 10 minutes

- [ ] Vérifier `/healthz`.
- [ ] Lire les logs Railway des 30 dernières minutes.
- [ ] Vérifier l’état MySQL dans Railway → MySQL-vr64.
- [ ] Vérifier Cloudflare R2 si les rapports sont affectés.
- [ ] Vérifier Stripe Dashboard si la facturation ou les abonnements sont affectés.

### Actions correctives

- [ ] Service indisponible : redémarrer le dernier déploiement Railway sain depuis Backend---QARA → Deployments.
- [ ] Base corrompue : restaurer depuis la dernière sauvegarde validée. Mesures de référence : RTO 2,22 minutes ; RPO 10,06 minutes.
- [ ] Incident Stripe : vérifier Stripe Dashboard → Webhooks → événements récents.
- [ ] Incident frontend : vérifier le dernier déploiement Vercel réussi et effectuer un retour arrière si nécessaire.

### Notification client — dans les 30 minutes

Objet : `[QARA] Incident en cours — [description courte]`

> Bonjour [Prénom],  
> Nous avons identifié un incident affectant [service] depuis [heure].  
> Impact : [description].  
> Action en cours : [description].  
> Résolution estimée : [heure].  
> Une mise à jour sera communiquée toutes les heures jusqu’à résolution.  
> L’équipe QARA — infos@n3-conseil.com

### Clôture

- [ ] Vérifier que `/healthz` répond HTTP 200 avec `database: connected`.
- [ ] Tester le parcours critique : audit → clôture → rapport → téléchargement.
- [ ] Tester l’accès à l’analytique et aux actions CAPA concernées.
- [ ] Notifier les clients de la résolution.
- [ ] Rédiger le post-mortem dans les 48 heures pour tout P0.

## 5. Critères d’arrêt commercial

Suspendre immédiatement l’onboarding si l’un des cas suivants est constaté :

- [ ] fuite ou mélange de données entre organisations ;
- [ ] échec répété de génération d’un rapport sur un parcours terminé ;
- [ ] paiement encaissé sans activation correcte du plan ;
- [ ] sauvegarde invalide ou restauration impossible ;
- [ ] incident P0 sans solution de contournement documentée.

## 6. Moniteurs de surveillance

UptimeRobot — intervalle cible de cinq minutes :

- QARA Backend Production : `https://backend-qara-new-claude.up.railway.app/healthz`
- QARA Frontend Production : `https://frontend-qara.vercel.app`
- Alertes techniques : `nickandroklauss@gmail.com`
- Support client : `infos@n3-conseil.com`
- Dernier test d’alerte confirmé : 5 octobre 2026 à 19:10:34, heure affichée par UptimeRobot.
- Objet reçu : `frontend-qara.vercel.app is up.`

## 7. Journal minimal d’incident

Pour chaque P0 ou P1, consigner au minimum :

- date et heure de détection ;
- source de l’alerte ;
- services et clients affectés ;
- chronologie des diagnostics et actions ;
- décision de redémarrage, restauration ou retour arrière ;
- heure de rétablissement ;
- preuve du test de clôture ;
- cause racine et actions préventives.

## 8. Approbation

La procédure devient publiée après validation par Nick Ngankep. L’absence de suppléant est un risque opérationnel accepté pour la phase de go commercial contrôlé ; elle devra être réévaluée avant une diffusion commerciale large.

Validation : **Nick Ngankep — approuvé**  
Date : **5 octobre 2026**
