import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("Tasks page", () => {
  it("renders task table columns including wage amount and paid status", () => {
    renderTasks();
    expect(screen.getByText(/Montant Salaire \(FCFA\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Payé/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Non Payé/i).length).toBeGreaterThan(0);
  });

  it("opens the create dialog, assigns a worker, and edits the per-worker wage", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTasks();

    await user.click(screen.getByText(/Créer une Tâche/i));

    // No per-worker wage input until a worker is assigned.
    expect(screen.queryByRole('spinbutton')).toBeNull();

    // Select a worker from the assignment dropdown.
    await user.click(screen.getByText(/Sélectionner des ouvriers…/i));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Samuel Mvondo/ }));

    const wageInput = screen.getByPlaceholderText('Salaire') as HTMLInputElement;
    const advanceInput = screen.getByPlaceholderText('Avance') as HTMLInputElement;
    await user.clear(wageInput);
    await user.type(wageInput, '8000');
    await user.clear(advanceInput);
    await user.type(advanceInput, '2000');
    expect(wageInput.value).toBe('8000');
    expect(advanceInput.value).toBe('2000');
  });

});