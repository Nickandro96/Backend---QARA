# Procès-verbal de configuration du monitoring et de la gestion d’incident QARA

Date du PV : 5 octobre 2026  
Responsable : Nick Ngankep  
État : clôturé — critères du P0 monitoring satisfaits

## Compte UptimeRobot

- Adresse du compte et des alertes : `nickandroklauss@gmail.com`
- Compte créé et adresse confirmée : OUI — confirmation communiquée par le responsable

## Moniteurs

| Monitor | URL | Statut prouvé | Intervalle cible |
|---|---|---:|---:|
| QARA Backend Production | `https://backend-qara-new-claude.up.railway.app/healthz` | UP — pastille verte et contrôle toutes les 5 min confirmés | 5 min |
| QARA Frontend Production | `https://frontend-qara.vercel.app` | UP — notification de rétablissement reçue | 5 min |

Le contrôle indépendant du 5 octobre 2026 à 16:40 heure de Paris a obtenu pour le backend : `{"status":"ok","database":"connected"}`. Le frontend a également répondu HTTP 200.

## Alerte test

- E-mail reçu : OUI
- Heure affichée par UptimeRobot : 5 octobre 2026 à 19:10:34
- Objet : `frontend-qara.vercel.app is up.`
- Délai : non mesurable sur cette notification de test (`Incident started at: N/A`, `Duration: N/A`)
- Région de contrôle indiquée : North America

## Procédure d’incident

- Fichier `PROCEDURE-INCIDENT-QARA.md` créé : OUI
- Canal client : e-mail uniquement — `infos@n3-conseil.com`
- Horaires : lundi à vendredi, 9 h à 18 h, heure de Paris, hors jours fériés
- Suppléant : NON — aucun suppléant désigné
- Responsable principal : Nick Ngankep
- Procédure approuvée par Nick Ngankep le 5 octobre 2026 : OUI

## Décision P0 monitoring

- [x] FERMÉ — deux moniteurs UP, alerte confirmée et procédure approuvée.
- [ ] À COMPLÉTER.

## Preuves à ajouter

- [x] capture ou relevé du monitor backend au statut UP ;
- [x] capture ou relevé du monitor frontend au statut UP ;
- [x] confirmation que les deux intervalles sont de cinq minutes ;
- [x] objet et heure de l’e-mail d’alerte test ;
- [x] délai non mesurable documenté, car la notification de test indique `N/A` ;
- [x] signature ou validation datée de la procédure.

## Réserve opérationnelle

L’absence de suppléant constitue un risque de continuité de prise en charge. Elle ne bloque pas le go commercial contrôlé, mais empêche de considérer l’organisation d’astreinte comme industrialisée pour une diffusion large.
