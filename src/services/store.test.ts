import { describe, it, expect, beforeEach } from "vitest";
import { dbStore } from "@/services/store";

beforeEach(() => {
  dbStore.resetToDefaults();
});

describe("LocalDatabaseStore - Tasks & Wages", () => {
  it("computes wage_amount from the worker's daily wage on creation", () => {
    const worker = dbStore.getWorkers().find((w) => w.id === "wrk-1")!;
    const task = dbStore.saveTask({
      farm_id: "farm-1",
      worker_id: worker.id,
      title: "Désherbage",
      status: "pending",
    });

    expect(task.wage_amount).toBe(worker.daily_wage);
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