# Phase 2 — Réparation du compte admin en bcrypt natif

*Aucune action exécutée par moi contre la base `new-claude`. Ce document donne la procédure ; vous l'exécutez.*

## Contexte

Le compte `nickandroklauss@gmail.com` a actuellement, sur la base `new-claude`, un hash au format `scrypt:<sel>:<dérivé>` (injecté hier via un script de la lignée `main`). Le code réellement déployé (`qitbxl`) ne connaît que deux formats dans `verifyPassword` (`server/_core/passwordUtils.ts`) :

```ts
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  return password === hash; // legacy plaintext
};
```

Un hash `scrypt:...` tombe dans la branche "legacy plaintext" — une connexion ne devrait normalement matcher que si le mot de passe saisi est littéralement égal à la chaîne `scrypt:...`, ce qui explique pourquoi ce n'est pas une situation stable à laisser en l'état (voir `DIAGNOSTIC-topologie-branches.md`, §C, pour les hypothèses sur le login qui "marche quand même").

**Objectif de cette phase : remplacer ce hash par un vrai hash bcrypt, généré et vérifié localement, pour que `verifyPassword` prenne le chemin `bcrypt.compare` normal — plus d'ambiguïté.**

## Étape 1 — Générer le hash localement (le mot de passe ne transite par aucun chat)

Dans votre clone local du dépôt `Backend---QARA`, sur une branche qui a `bcryptjs` en dépendance (`main`, `qitbxl`, ou celle-ci) :

```bash
pnpm install   # si pas déjà fait, pour disposer de bcryptjs
npx tsx scripts/generate-bcrypt-admin-hash.ts
```

Le script (`scripts/generate-bcrypt-admin-hash.ts`, ajouté dans ce commit) :
- prompt le mot de passe en saisie masquée (aucun argv, aucune variable d'env, aucun log) ;
- rejette toute saisie de moins de 8 caractères ;
- hache avec `bcryptjs`, **12 rounds**, exactement le paramètre `BCRYPT_ROUNDS` utilisé par `server/_core/passwordUtils.ts` sur `qitbxl` ;
- affiche uniquement le hash résultant (jamais le mot de passe).

Testé localement (bout en bout, y compris la validation croisée `bcrypt.compare`) : le hash produit matche bien `isBcryptHash()` et se vérifie correctement avec le mot de passe d'origine. Exemple de sortie réelle obtenue en test (mot de passe de test, sans rapport avec le vôtre) :

```
$2b$12$RZroP0MZqigbYMvfEVykZurgOAQw2KmEEoa82HB2./NvkgWjbkOrC
```

Copiez le hash que **votre** exécution du script affiche (il sera différent à chaque fois, même avec le même mot de passe, à cause du sel aléatoire — c'est normal et attendu pour bcrypt).

## Étape 2 — UPDATE sur la base new-claude

Colonnes confirmées par lecture du schéma (`drizzle/schema.ts` sur `qitbxl`) : `users.email` (`varchar(255) NOT NULL`), `users.passwordHash` (`varchar(255)`), `users.updatedAt` (auto-mise à jour, pas besoin de la fixer manuellement).

```sql
UPDATE users
SET passwordHash = '<COLLEZ_ICI_LE_HASH_DU_SCRIPT>'
WHERE email = 'nickandroklauss@gmail.com';
```

## Étape 3 — Vérification (lecture seule)

```sql
SELECT id, email, LEFT(passwordHash, 7) AS hash_prefix, updatedAt
FROM users
WHERE email = 'nickandroklauss@gmail.com';
```

Attendu : `hash_prefix` = `$2b$12$`, `updatedAt` mis à jour à l'instant de l'`UPDATE`.

## Étape 4 — Confirmation du comportement de login après correction

Une fois le hash remplacé :
- `verifyPassword` prendra systématiquement la branche `isBcryptHash(hash) === true` → `bcrypt.compare(password, hash)`. Fini l'ambiguïté de la comparaison plaintext.
- Aucun effet de bord de migration transparente ne se déclenchera (ce mécanisme, dans `systemRouter.ts`, ne s'active que si le hash stocké n'est PAS déjà un hash bcrypt — ici il le sera dès la première tentative de connexion suivant l'`UPDATE`).
- Votre login sera donc "propre" : un compte bcrypt natif, identique dans sa mécanique à tout compte créé normalement via `register` sur `qitbxl`.

## Ce que je n'ai pas fait

- Je n'ai exécuté aucune requête contre `new-claude`.
- Je n'ai pas touché à la ligne `users` de ce compte.
- Le script ne se connecte à aucune base — il ne fait que hacher un mot de passe fourni localement par vous.
