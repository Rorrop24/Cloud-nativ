import { fireEvent, render, screen } from "@testing-library/react";
import Carrito from "./Carrito"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

describe("Testing Carrito Component (Sidebar)", () => {
  // --- Mock y Datos de Prueba ---
  const mockSetOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Caso de Prueba 1: Sidebar cerrado ---
  it("CP-Carrito1: Renderiza el sidebar cerrado por defecto si open es false", () => {
    render(<Carrito open={false} setOpen={mockSetOpen} cantidad={0} />);

    const sidebarDiv = screen
      .getByText(/Carrito de compras/i)
      .closest(".carrito-sidebar");

    expect(sidebarDiv).toBeInTheDocument();
    expect(sidebarDiv).not.toHaveClass("open");
  });

  // --- Caso de Prueba 2: Sidebar abierto ---
  it("CP-Carrito2: Renderiza el sidebar abierto si open es true", () => {
    render(<Carrito open={true} setOpen={mockSetOpen} cantidad={0} />);

    const sidebarDiv = screen
      .getByText(/Carrito de compras/i)
      .closest(".carrito-sidebar");

    expect(sidebarDiv).toBeInTheDocument();
    expect(sidebarDiv).toHaveClass("open");
  });

  // --- Caso de Prueba 3: Carrito vacío ---
  it("CP-Carrito3: Muestra el mensaje 'Tu carrito está vacío' si cantidad es 0", () => {
    render(<Carrito open={true} setOpen={mockSetOpen} cantidad={0} />);

    expect(screen.getByText(/Tu carrito está vacío/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Tienes \d+ item\(s\) en tu carrito/i)
    ).not.toBeInTheDocument();
  });

  // --- Caso de Prueba 4: Carrito con items ---
  it("CP-Carrito4: Muestra el mensaje con la cantidad de items si cantidad > 0", () => {
    const cantidadItems = 3;
    render(<Carrito open={true} setOpen={mockSetOpen} cantidad={cantidadItems} />);

    expect(
      screen.getByText(`Tienes ${cantidadItems} item(s) en tu carrito`)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Tu carrito está vacío/i)).not.toBeInTheDocument();
  });

  // --- Caso de Prueba 5: Botón cerrar ---
  it("CP-Carrito5: Llama a setOpen(false) al hacer clic en el botón de cerrar", () => {
    const { container } = render(
      <Carrito open={true} setOpen={mockSetOpen} cantidad={2} />
    );

    // 🔍 Primero intenta encontrarlo por accesibilidad (aria-label)
    let closeButton = screen.queryByRole("button", { name: /cerrar/i });

    // Si no existe aria-label, busca por clase .btn-close
    if (!closeButton) {
      closeButton = container.querySelector(".btn-close");
    }

    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);

    expect(mockSetOpen).toHaveBeenCalledTimes(1);
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
