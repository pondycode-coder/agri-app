import { describe, it, expect, beforeEach } from "vitest";
import { dbStore } from "@/services/store";

beforeEach(() => {
  dbStore.resetToDefaults();
});

describe("LocalDatabaseStore - Tasks & Wages", () => {
  it("creates a task with the provided wage_amount and preserves task-level wages", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_id: "wrk-1",
      title: "Désherbage",
      status: "pending",
      wage_amount: 4200,
    });

    expect(task.wage_amount).toBe(4200);
    expect(task.wage_paid).toBe(false);
    expect(task.worker_id).toBe("wrk-1");
  });

  it("creates a Salaires Ouvriers expense when a task is marked paid", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_id: "wrk-1",
      title: "Récolte cacao",
      wage_amount: 3500,
      status: "completed",
      wage_paid: true,
    });

    const expenses = dbStore.getFinancials().filter((f) => f.task_id === task.id);
    expect(expenses).toHaveLength(1);
    expect(expenses[0].type).toBe("expense");
    expect(expenses[0].amount).toBe(3500);
    expect(expenses[0].category).toBe("Salaires Ouvriers");
    expect(expenses[0].worker_id).toBe("wrk-1");
  });

  it("removes the linked expense when a paid task is unmarked", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_id: "wrk-1",
      title: "Récolte cacao",
      wage_amount: 3500,
      status: "completed",
      wage_paid: true,
    });

    expect(dbStore.getFinancials().filter((f) => f.task_id === task.id)).toHaveLength(1);

    dbStore.saveTask({ ...task, wage_paid: false });

    expect(dbStore.getFinancials().filter((f) => f.task_id === task.id)).toHaveLength(0);
  });

  it("updates the linked expense amount when wage_amount changes", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_id: "wrk-1",
      title: "Récolte cacao",
      wage_amount: 3500,
      status: "completed",
      wage_paid: true,
    });

    dbStore.saveTask({ ...task, wage_amount: 4000 });

    const expense = dbStore.getFinancials().find((f) => f.task_id === task.id)!;
    expect(expense.amount).toBe(4000);
  });

  it("does not create an expense for cancelled paid tasks", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_id: "wrk-1",
      title: "Tâche annulée",
      wage_amount: 3500,
      status: "cancelled",
      wage_paid: true,
    });

    expect(dbStore.getFinancials().filter((f) => f.task_id === task.id)).toHaveLength(0);
  });

  it("deletes the linked expense when the task is deleted", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_id: "wrk-1",
      title: "Récolte cacao",
      wage_amount: 3500,
      status: "completed",
      wage_paid: true,
    });

    expect(dbStore.getFinancials().filter((f) => f.task_id === task.id)).toHaveLength(1);

    dbStore.deleteTask(task.id);

    expect(dbStore.getTasks().some((t) => t.id === task.id)).toBe(false);
    expect(dbStore.getFinancials().filter((f) => f.task_id === task.id)).toHaveLength(0);
  });

  it("sums per-worker wages into the task total and the linked expense", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_ids: ["wrk-1", "wrk-2"],
      title: "Récolte cacao",
      status: "completed",
      wage_paid: true,
      worker_wages: { "wrk-1": 2000, "wrk-2": 1500 },
    });

    expect(task.wage_amount).toBe(3500);
    expect(task.worker_wages).toEqual({ "wrk-1": 2000, "wrk-2": 1500 });
    const expense = dbStore.getFinancials().find((f) => f.task_id === task.id)!;
    expect(expense.amount).toBe(3500);
  });

  it("prunes worker_wages for workers removed from the task", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_ids: ["wrk-1", "wrk-2"],
      title: "Désherbage",
      status: "completed",
      wage_paid: true,
      worker_wages: { "wrk-1": 2000, "wrk-2": 1500 },
    });

    const updated = dbStore.saveTask({
      ...task,
      worker_ids: ["wrk-1"],
      worker_wages: { "wrk-1": 2000, "wrk-2": 1500 },
    });

    expect(updated.worker_wages).toEqual({ "wrk-1": 2000 });
    expect(updated.wage_amount).toBe(2000);
    const expense = dbStore.getFinancials().find((f) => f.task_id === task.id)!;
    expect(expense.amount).toBe(2000);
  });

  it("records an Avance Salaire expense and nets the salary by the advance", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_ids: ["wrk-1", "wrk-2"],
      title: "Récolte cacao",
      status: "completed",
      wage_paid: true,
      worker_wages: { "wrk-1": 2000, "wrk-2": 1500 },
      worker_advances: { "wrk-1": 1000 },
    });

    expect(task.wage_amount).toBe(3500);
    expect(task.advance_amount).toBe(1000);

    const advance = dbStore.getFinancials().find((f) => f.task_id === task.id && f.category === "Avance Salaire");
    const salary = dbStore.getFinancials().find((f) => f.task_id === task.id && f.category === "Salaires Ouvriers");

    expect(advance).toBeDefined();
    expect(advance!.amount).toBe(1000);
    expect(salary).toBeDefined();
    expect(salary!.amount).toBe(2500); // 3500 - 1000
  });

  it("removes the advance expense when the advance is zeroed out", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_ids: ["wrk-1"],
      title: "Désherbage",
      status: "completed",
      wage_paid: true,
      worker_wages: { "wrk-1": 2000 },
      worker_advances: { "wrk-1": 500 },
    });

    expect(dbStore.getFinancials().filter((f) => f.task_id === task.id && f.category === "Avance Salaire")).toHaveLength(1);

    const updated = dbStore.saveTask({
      ...task,
      worker_advances: { "wrk-1": 0 },
      worker_wages: { "wrk-1": 2000 },
    });

    expect(updated.advance_amount).toBe(0);
    expect(dbStore.getFinancials().filter((f) => f.task_id === task.id && f.category === "Avance Salaire")).toHaveLength(0);
    const salary = dbStore.getFinancials().find((f) => f.task_id === task.id && f.category === "Salaires Ouvriers")!;
    expect(salary.amount).toBe(2000);
  });

  it("prunes worker_advances for workers removed from the task", () => {
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_ids: ["wrk-1", "wrk-2"],
      title: "Désherbage",
      status: "completed",
      wage_paid: true,
      worker_wages: { "wrk-1": 2000, "wrk-2": 1500 },
      worker_advances: { "wrk-1": 500, "wrk-2": 300 },
    });

    const updated = dbStore.saveTask({
      ...task,
      worker_ids: ["wrk-1"],
      worker_wages: { "wrk-1": 2000 },
      worker_advances: { "wrk-1": 500, "wrk-2": 300 },
    });

    expect(updated.worker_advances).toEqual({ "wrk-1": 500 });
    expect(updated.advance_amount).toBe(500);
  });
});

describe("LocalDatabaseStore - CRUD", () => {
  it("creates and updates a farm", () => {
    const farm = dbStore.saveFarm({ name: "Ferme Test", location: "Douala", size_in_hectares: 5 });
    expect(dbStore.getFarms().some((f) => f.id === farm.id)).toBe(true);

    const updated = dbStore.saveFarm({ id: farm.id, name: "Ferme Test 2" });
    expect(updated.name).toBe("Ferme Test 2");
  });

  it("deletes a plot and decrements the farm plot count", () => {
    const countBefore = dbStore.getPlots("farm-2").length;
    expect(countBefore).toBeGreaterThan(0);

    dbStore.deletePlot("plot-4");

    const countAfter = dbStore.getPlots("farm-2").length;
    const farmAfter = dbStore.getFarms().find((f) => f.id === "farm-2")!;
    expect(countAfter).toBe(countBefore - 1);
    expect(farmAfter.plots).toBe(countAfter);
    expect(dbStore.getPlots().some((p) => p.id === "plot-4")).toBe(false);
  });

  it("tracks inventory total via price and quantity", () => {
    const item = dbStore.saveInventoryItem({
      farm_id: "farm-1",
      name: "Engrais",
      quantity: 10,
      unit: "sacs",
      price_per_unit: 5000,
    });
    expect(item.quantity * item.price_per_unit).toBe(50000);
  });
});