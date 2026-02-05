import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("audit.saveResponse", () => {
  it("should save audit response with response field", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.saveResponse({
      questionId: 1,
      response: "Nous avons mis en place un système de gestion documentaire conforme aux exigences MDR",
      status: "conforme",
      comment: "Validation effectuée le 24/01/2026",
    });

    expect(result).toEqual({ success: true });
  });

  it("should save audit response without response field", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.saveResponse({
      questionId: 2,
      status: "nok",
      comment: "À améliorer",
    });

    expect(result).toEqual({ success: true });
  });

  it("should require status field", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.audit.saveResponse({
        questionId: 1,
        response: "Test response",
        // @ts-expect-error - Testing missing status
        status: undefined,
      })
    ).rejects.toThrow();
  });
});

describe("audit.getResponse", () => {
  it("should retrieve saved response with response field", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Save a response first
    await caller.audit.saveResponse({
      questionId: 3,
      response: "Test response content",
      status: "conforme",
      comment: "Test comment",
    });

    // Retrieve it
    const response = await caller.audit.getResponse({
      questionId: 3,
    });

    expect(response).toBeDefined();
    if (response) {
      expect(response.response).toBe("Test response content");
      expect(response.status).toBe("conforme");
      expect(response.comment).toBe("Test comment");
    }
  });
});
