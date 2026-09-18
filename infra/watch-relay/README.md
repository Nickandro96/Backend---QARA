# QARA Watch Relay

Relais strictement limité aux trois flux RSS publics officiels TGA.

1. `npx wrangler login`
2. `npx wrangler secret put WATCH_RELAY_TOKEN`
3. `npx wrangler deploy`
4. Ajouter dans Railway `WATCH_RELAY_BASE_URL` et `WATCH_RELAY_TOKEN`.

Le Worker refuse tout chemin non déclaré, exige un bearer token et conserve les réponses 15 minutes.
