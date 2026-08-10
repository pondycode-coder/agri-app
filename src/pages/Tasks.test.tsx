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

describe("Tasks page", () => {
  it("renders task table columns including wage amount and paid status", () => {
    renderTasks();
    expect(screen.getByText(/Montant Salaire \(FCFA\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Payé/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Non Payé/i).length).toBeGreaterThan(0);
  });

  it("opens the create dialog and allows editing task wage fields", () => {
    renderTasks();

    fireEvent.click(screen.getByText(/Créer une Tâche/i));
    const wageInputs = screen.getAllByRole('spinbutton');
    expect(wageInputs.length).toBeGreaterThan(0);
    const wageInput = wageInputs[0] as HTMLInputElement;
    fireEvent.change(wageInput, { target: { value: '8000' } });
    expect(wageInput.value).toBe('8000');
  });

});