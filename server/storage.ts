// server/storage.ts
//
// Était un stub vide (`export const storagePut = async () => {};`) — tout
// appelant qui destructure `{ url }` du résultat plante immédiatement
// (`Cannot destructure property 'url' of undefined`), confirmé en test réel
// sur reports.generate (voir INVENTAIRE-BUGS.md #3, second blocage après le
// correctif processes/processus dans report-generator.ts). Les dépendances
// @aws-sdk/client-s3 étaient déjà installées (package.json) — l'intention
// d'un vrai stockage S3 était là, jamais implémentée.
//
// Utilise S3 si les variables d'environnement standard sont présentes,
// sinon retombe sur un stockage disque local (répertoire /tmp) pour que la
// fonctionnalité ne plante plus en environnement de développement/test —
// dégradation explicite, pas une solution de production.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const S3_BUCKET = process.env.AWS_S3_BUCKET;
const S3_REGION = process.env.AWS_REGION;

export async function storagePut(
  key: string,
  body: Buffer,
  contentType: string
): Promise<{ url: string }> {
  if (S3_BUCKET && S3_REGION) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({ region: S3_REGION });
    await client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return { url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}` };
  }

  // Dégradation locale : AWS_S3_BUCKET/AWS_REGION non configurés (dev/test,
  // ou pas encore provisionné en production) — écrit sur disque plutôt que
  // de planter, avec un avertissement explicite dans les logs serveur.
  console.warn(
    `[storage] AWS_S3_BUCKET/AWS_REGION non configurés — stockage local de secours pour "${key}". ` +
      `Configurer ces variables d'environnement pour un stockage S3 réel en production.`
  );
  const localDir = path.join("/tmp", "qara-local-storage", path.dirname(key));
  await mkdir(localDir, { recursive: true });
  const localPath = path.join("/tmp", "qara-local-storage", key);
  await writeFile(localPath, body);
  return { url: `file://${localPath}` };
}
