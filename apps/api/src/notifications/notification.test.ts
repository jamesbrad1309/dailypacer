import { describe, expect, it } from "vitest";
import {
  type Candidate,
  type Existing,
  planSync,
  reasonOf,
} from "#notifications/notification.util";

const candidate = (patch: Partial<Candidate> = {}): Candidate => ({
  key: "task-due:t1:2026-10-08",
  kind: "task.dueToday",
  params: { title: "Pay rent" },
  link: "/tasks",
  fingerprint: "task.dueToday",
  ...patch,
});

const stored = (patch: Partial<Existing> = {}): Existing => ({
  id: "n1",
  key: "task-due:t1:2026-10-08",
  kind: "task.dueToday",
  params: { title: "Pay rent" },
  link: "/tasks",
  fingerprint: "task.dueToday",
  doneAt: null,
  ...patch,
});

const covered = new Set(["task.dueToday", "task.overdue", "task.inbox"]);

describe("planSync", () => {
  it("creates what's new and leaves what's unchanged alone", () => {
    expect(planSync([], [candidate()], covered)).toEqual({
      create: [candidate()],
      update: [],
      resolve: [],
    });
    expect(planSync([stored()], [candidate()], covered)).toEqual({
      create: [],
      update: [],
      resolve: [],
    });
  });

  it("re-surfaces a notification whose fingerprint changed", () => {
    const overdue = candidate({ kind: "task.overdue", fingerprint: "task.overdue" });
    const plan = planSync([stored({ doneAt: new Date() })], [overdue], covered);
    expect(plan.update).toEqual([{ id: "n1", candidate: overdue, resurface: true }]);
  });

  it("updates other changes quietly", () => {
    const renamed = candidate({ params: { title: "Pay the rent" } });
    expect(planSync([stored()], [renamed], covered).update).toEqual([
      { id: "n1", candidate: renamed, resurface: false },
    ]);
  });

  it("re-surfaces a count only when it grows", () => {
    const row = stored({ key: "tasks-inbox", kind: "task.inbox", fingerprint: "3" });
    const at = (n: number) =>
      candidate({
        key: "tasks-inbox",
        kind: "task.inbox",
        params: { count: n },
        fingerprint: String(n),
        resurface: "grew",
      });
    expect(planSync([row], [at(5)], covered).update[0].resurface).toBe(true);
    expect(planSync([row], [at(2)], covered).update[0].resurface).toBe(false);
  });

  it("resolves an open ongoing notification that's no longer true", () => {
    expect(planSync([stored()], [], covered).resolve).toEqual(["n1"]);
  });

  it("leaves done, uncovered and event notifications alone", () => {
    expect(planSync([stored({ doneAt: new Date() })], [], covered).resolve).toEqual([]);
    expect(planSync([stored()], [], new Set()).resolve).toEqual([]);
    const event = stored({ kind: "money.budget", key: "budget:c1:2026-10:near" });
    expect(planSync([event], [], covered).resolve).toEqual([]);
  });
});

describe("reasonOf", () => {
  it("is the kind's first part", () => {
    expect(reasonOf("money.cardDue")).toBe("money");
    expect(reasonOf("achievement.levelUp")).toBe("achievement");
  });
});
