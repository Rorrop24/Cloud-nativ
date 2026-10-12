import { render, screen } from "@testing-library/react";
import ProteccionUser from "./ProteccionUser"; // Ajusta la ruta si es necesario
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

// --- Mock de window.alert ---
const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
// ----------------------------

describe("Testing ProteccionUser Component", () => {
  // --- Datos de Prueba ---
  const mockUsuarioLogueado = { email: "test@ejemplo.com", nombre: "Usuario Test" };
  const ContenidoHijo = () => <div data-testid="contenido-hijo">Contenido Protegido</div>;

  it("CP-ProteccionUser1: Renderiza los children si el usuario está logueado", () => {
    render(
      <MemoryRouter>
        <ProteccionUser usuario={mockUsuarioLogueado}>
          <ContenidoHijo />
        </ProteccionUser>
      </MemoryRouter>
    );

    // Verifica que el contenido hijo se renderiza
    expect(screen.getByTestId("contenido-hijo")).toBeInTheDocument();
    // Verifica que la alerta NO fue llamada
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
