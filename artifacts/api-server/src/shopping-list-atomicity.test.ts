import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({ mockDb: {} as any }));
vi.mock("./db", () => ({ db: mockDb }));

import { shoppingListItems, taskAssignments, taskCompletions, tasks } from "@workspace/db";
import { DatabaseStorage } from "./storage";

type MockState = {
  task: Record<string, any>;
  items: Array<Record<string, any>>;
  assignments: Array<Record<string, any>>;
  completions: Array<Record<string, any>>;
  nextCompletionId: number;
};

class QueryBuilder {
  private table: any;
  private projection: any;
  private operation: "select" | "update" | "delete" | "insert";
  private valuesToWrite: any;
  private returningRows = false;
  private locked = false;

  constructor(private state: MockState, operation: QueryBuilder["operation"], projection?: any) {
    this.operation = operation;
    this.projection = projection;
  }

  from(table: any) { this.table = table; return this; }
  where(_condition: any) { return this; }
  orderBy(_column: any) { return this; }
  limit(_count: number) { return this; }
  for(_mode: string) {
    this.locked = true;
    mockDb.events.push(this.table === tasks ? "task-lock" : "item-lock");
    return this;
  }
  set(values: any) { this.valuesToWrite = values; return this; }
  values(values: any) { this.valuesToWrite = values; return this; }
  returning() { this.returningRows = true; return this; }

  then(resolve: any, reject?: any) {
    return Promise.resolve().then(() => this.execute()).then(resolve, reject);
  }

  private execute(): any {
    if (this.operation === "select") {
      if (this.table === tasks) return [this.state.task];
      if (this.table === taskAssignments) return this.state.assignments;
      if (this.table === taskCompletions) return this.state.completions;
      if (this.table === shoppingListItems) {
        if (this.projection) return this.state.items.slice(0, 1).map(item => ({ taskId: item.taskId }));
        if (this.locked) return this.state.items.slice(0, 1);
        return [...this.state.items].sort((a, b) => a.sortOrder - b.sortOrder);
      }
      return [];
    }

    if (this.operation === "delete") {
      if (this.table === taskCompletions) {
        this.state.completions = this.state.completions.filter(row => row.status !== "pending");
      }
      return undefined;
    }

    if (this.operation === "update") {
      if (this.table === shoppingListItems) {
        this.state.items[0] = { ...this.state.items[0], ...this.valuesToWrite };
        return this.returningRows ? [this.state.items[0]] : undefined;
      }
      if (this.table === tasks) {
        this.state.task = { ...this.state.task, ...this.valuesToWrite };
      }
      return this.returningRows ? [this.state.task] : undefined;
    }

    if (this.operation === "insert" && this.table === taskCompletions) {
      const rows = (Array.isArray(this.valuesToWrite) ? this.valuesToWrite : [this.valuesToWrite])
        .map((row: any) => ({
          ...row,
          id: `completion-${this.state.nextCompletionId++}`,
          completedAt: new Date("2026-06-01T12:00:00Z"),
        }));
      this.state.completions.push(...rows);
      return this.returningRows ? rows : undefined;
    }
    return undefined;
  }
}

function createClient(state: MockState) {
  return {
    select: (projection?: any) => new QueryBuilder(state, "select", projection),
    update: (table: any) => {
      const builder = new QueryBuilder(state, "update");
      return builder.from(table);
    },
    delete: (table: any) => {
      const builder = new QueryBuilder(state, "delete");
      return builder.from(table);
    },
    insert: (table: any) => {
      const builder = new QueryBuilder(state, "insert");
      return builder.from(table);
    },
  };
}

function makeState(overrides: Partial<MockState> = {}): MockState {
  return {
    task: {
      id: "task-1",
      status: "active",
      isShoppingList: true,
      isSharedTask: true,
      sharedMemberIds: ["member-1", "member-2"],
      recurrence: "none",
      recurrenceDays: null,
      requiresApproval: true,
      points: 10,
      maxCompletions: null,
      completionCount: 0,
    },
    items: [{
      id: "item-1",
      taskId: "task-1",
      text: "Milk",
      sortOrder: 0,
      completedByMemberId: null,
      completedAt: null,
    }],
    assignments: [],
    completions: [],
    nextCompletionId: 1,
    ...overrides,
  };
}

function configureMockDb(initialState: MockState) {
  mockDb.state = initialState;
  mockDb.events = [];
  mockDb.select = (projection?: any) => new QueryBuilder(mockDb.state, "select", projection);
  mockDb.transaction = async (callback: (tx: any) => Promise<any>) => {
    const draft = structuredClone(mockDb.state) as MockState;
    const result = await callback(createClient(draft));
    mockDb.state = draft;
    return result;
  };
}

describe("shopping-list toggle transaction", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    configureMockDb(makeState());
    storage = new DatabaseStorage();
    vi.spyOn(storage as any, "hasActiveMemberCompletion").mockResolvedValue(false);
  });

  it("uses the post-toggle item state and removes pending rows when the list is unchecked", async () => {
    mockDb.state.items[0].completedByMemberId = "member-1";
    mockDb.state.items[0].completedAt = new Date("2026-06-01T11:00:00Z");
    mockDb.state.completions = [
      { id: "pending-1", taskId: "task-1", memberId: "member-1", status: "pending" },
      { id: "pending-2", taskId: "task-1", memberId: "member-2", status: "pending" },
    ];

    const result = await storage.toggleShoppingListItemAtomically("item-1", "member-2");

    expect(result.allCompleted).toBe(false);
    expect(result.item.completedByMemberId).toBeNull();
    expect(mockDb.state.completions).toEqual([]);
    expect(mockDb.events.slice(0, 2)).toEqual(["task-lock", "item-lock"]);
  });

  it("does not uncheck an already-finalized list when approval won the task lock", async () => {
    mockDb.state.task.status = "completed";
    mockDb.state.items[0].completedByMemberId = "member-1";
    mockDb.state.completions = [
      { id: "approved-1", taskId: "task-1", memberId: "member-1", status: "approved" },
    ];

    await expect(storage.toggleShoppingListItemAtomically("item-1", "member-2"))
      .rejects.toThrow("Task is not active");

    expect(mockDb.state.items[0].completedByMemberId).toBe("member-1");
    expect(mockDb.state.completions[0].status).toBe("approved");
  });

  it("derives allCompleted from the locked, post-toggle item rows instead of a stale pre-toggle snapshot", async () => {
    const result = await storage.toggleShoppingListItemAtomically("item-1", "member-1");

    expect(result.allCompleted).toBe(true);
    expect(mockDb.state.items[0].completedByMemberId).toBe("member-1");
    expect(mockDb.state.completions).toHaveLength(2);
    expect(mockDb.state.completions.every((row: any) => row.status === "pending")).toBe(true);
  });

  it("rolls back the item toggle when collective capacity creation fails", async () => {
    mockDb.state.task.maxCompletions = 2;
    vi.spyOn(storage as any, "calculateTaskCompletionCapacity").mockResolvedValue({
      remainingSlots: 0,
      canReserve: false,
    });

    await expect(storage.toggleShoppingListItemAtomically("item-1", "member-1"))
      .rejects.toThrow("All completion slots filled");

    expect(mockDb.state.items[0].completedByMemberId).toBeNull();
    expect(mockDb.state.completions).toEqual([]);
  });
});