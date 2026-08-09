import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/context/I18nProvider";
import Tasks from "@/pages/Tasks";
import { dbStore } from "@/services/store";

type SelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  defaultValue?: string;
};

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: SelectProps) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children as React.ReactNode}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: SelectProps) => <>{children}</>,
  SelectItem: ({ value, children }: SelectProps) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "a@b.cm", name: "Admin", role: "admin" },
    signOut: vi.fn(),
    switchRole: vi.fn(),
  }),
}));

beforeEach(() => {
  dbStore.resetToDefaults();
});

function renderTasks() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <Tasks />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("Tasks page - wage flow", () => {
  it("shows wage summary cards", () => {
    renderTasks();
    expect(screen.getByText(/Salaires Payés/)).toBeInTheDocument();
    expect(screen.getByText(/Salaires Restants à Payer/)).toBeInTheDocument();
  });

  it("marks a task paid via the toggle button", () => {
    renderTasks();

    const unpaidCount = screen.queryAllByText(/Non Payé/).length;
    expect(unpaidCount).toBeGreaterThan(0);

    const unpaidButton = screen.getAllByText(/Non Payé/)[0];
    fireEvent.click(unpaidButton);

    expect(screen.queryAllByText(/Non Payé/).length).toBe(unpaidCount - 1);
  });

  it("creating a task prefills wage from the selected worker", () => {
    renderTasks();
    fireEvent.click(screen.getByText(/Nouvelle Tâche|Créer une Tâche/i));

    const selects = screen.getAllByTestId("mock-select");
    const workerSelect = selects.find((s) =>
      Array.from((s as HTMLSelectElement).options).some((o) => o.textContent?.includes("Samuel Mvondo"))
    ) as HTMLSelectElement;
    fireEvent.change(workerSelect, { target: { value: "wrk-1" } });

    const wageInput = screen.getByDisplayValue("3500") as HTMLInputElement;
    expect(wageInput).toBeInTheDocument();
  });
});