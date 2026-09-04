import assert from "node:assert/strict";
import test from "node:test";
import { appRouter } from "../routers";
import { getEffectivePlanTier, hasCapability } from "./capabilities";

const paidCapability = "canUseClassification" as const;

test("calcule les droits effectifs pour chaque plan et statut", () => {
  const cases = [
    [{ role: "user", subscriptionTier: "free", subscriptionStatus: "active" }, "free", false],
    [{ role: "user", subscriptionTier: "pro", subscriptionStatus: "active" }, "pro", true],
    [{ role: "user", subscriptionTier: "expert", subscriptionStatus: "active" }, "expert", true],
    [{ role: "user", subscriptionTier: "entreprise", subscriptionStatus: "active" }, "entreprise", true],
    [{ role: "user", subscriptionTier: "pro", subscriptionStatus: "trialing" }, "pro", true],
    [{ role: "user", subscriptionTier: "pro", subscriptionStatus: "canceled" }, "free", false],
    [{ role: "user", subscriptionTier: "expert", subscriptionStatus: "past_due" }, "free", false],
    [{ role: "user", subscriptionTier: "entreprise", subscriptionStatus: "unpaid" }, "free", false],
  ] as const;

  for (const [user, effectiveTier, allowed] of cases) {
    assert.equal(getEffectivePlanTier(user), effectiveTier);
    assert.equal(hasCapability(paidCapability, user), allowed);
  }
});

test("préserve la compatibilité des anciens abonnements", () => {
  assert.equal(getEffectivePlanTier({ subscriptionTier: "pro", subscriptionStatus: null }), "pro");
  assert.equal(getEffectivePlanTier({ subscriptionTier: "free", subscriptionStatus: "premium" }), "pro");
});

test("un admin a les capacités sans modifier son plan commercial", () => {
  const admin = { role: "admin", subscriptionTier: "free", subscriptionStatus: "canceled" };
  assert.equal(getEffectivePlanTier(admin), "free");
  assert.equal(hasCapability(paidCapability, admin), true);
});

function callerFor(user: Record<string, unknown> | null) {
  return appRouter.createCaller({
    user,
    req: { headers: {} },
    res: {},
  } as any);
}

test("auth.me n'expose jamais passwordHash", async () => {
  const result = await callerFor({ id: 1, role: "user", passwordHash: "secret", email: "qa@example.test" }).auth.me();
  assert.deepEqual(result, { id: 1, role: "user", email: "qa@example.test" });
});

test("une procédure admin refuse un utilisateur standard", async () => {
  await assert.rejects(
    callerFor({ id: 1, role: "user" }).system.listUsers(),
    (error: any) => error?.code === "UNAUTHORIZED"
  );
});

test("le backend bloque un contournement du frontend pour un compte Free", async () => {
  await assert.rejects(
    callerFor({ id: 1, role: "user", subscriptionTier: "free", subscriptionStatus: "active" })
      .classification.classify({}),
    (error: any) => error?.code === "FORBIDDEN"
  );
});
