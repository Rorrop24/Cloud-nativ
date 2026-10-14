import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loginRedirect } = vi.hoisted(() => ({ loginRedirect: vi.fn() }));
vi.mock("@azure/msal-react", () => ({ useMsal: () => ({ instance: { loginRedirect } }) }));
vi.mock("../components/Footer", () => ({ default: () => null }));
import Auth from "./Auth";
import { loginRequest } from "../authConfig";

describe("Azure sign-in page", () => {
  beforeEach(() => { loginRedirect.mockReset(); });

  it("starts MSAL with the configured API scope", async () => {
    loginRedirect.mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><Auth /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Continuar con Microsoft/i }));
    expect(loginRedirect).toHaveBeenCalledWith(loginRequest);
    expect(screen.getByRole("button", { name: /Conectando/i })).toBeDisabled();
  });

  it("shows the error and allows retry when Azure fails", async () => {
    loginRedirect.mockRejectedValue(new Error("Azure unavailable"));
    render(<MemoryRouter><Auth /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Continuar con Microsoft/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No pudimos iniciar sesion"));
    expect(screen.getByRole("button", { name: /Continuar con Microsoft/i })).toBeEnabled();
  });
});
