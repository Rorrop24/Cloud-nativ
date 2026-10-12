import { render, screen, fireEvent } from "@testing-library/react";
import AgregarCarrito from "./AgregarCarrito"; // Ajusta la ruta si es necesario
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom";

describe("Testing AgregarCarrito Component", () => {
  const mockOnAgregar = vi.fn();
  const mockUsuarioNormal = { esDuoc: false };
  const mockUsuarioDuoc = { esDuoc: true };
  const stockInicial = 10;
  const precioProducto = 5000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- CP-1: Renderizado inicial ---
  it("CP-AgregarCarrito1: Muestra stock, precio normal y cantidad inicial correctamente", () => {
    render(
      <AgregarCarrito
        stockInicial={stockInicial}
        onAgregar={mockOnAgregar}
        usuario={mockUsuarioNormal}
        precio={precioProducto}
      />
    );

    expect(screen.getByText(/10 unidades disponibles/i)).toBeInTheDocument();
    expect(screen.getByText(/Precio normal - \$5,000/i)).toBeInTheDocument();

    const cantidadInput = screen.getByRole("spinbutton");
    expect(cantidadInput).toHaveValue(1);

    const agregarButton = screen.getByRole("button", { name: /Agregar al carrito/i });
    expect(agregarButton).toBeEnabled();
  });

  // --- CP-2: Descuento Duoc ---
  it("CP-AgregarCarrito2: Muestra mensaje de descuento si el usuario es Duoc", () => {
    render(
      <AgregarCarrito
        stockInicial={stockInicial}
        onAgregar={mockOnAgregar}
        usuario={mockUsuarioDuoc}
        precio={precioProducto}
      />
    );

    expect(screen.getByText(/¡Descuento aplicado! - \$5,000/i)).toBeInTheDocument();
  });

  // --- CP-3: Llamada a onAgregar ---
  it("CP-AgregarCarrito3: Llama a onAgregar con la cantidad correcta al hacer clic", () => {
    render(
      <AgregarCarrito
        stockInicial={stockInicial}
        onAgregar={mockOnAgregar}
        usuario={mockUsuarioNormal}
        precio={precioProducto}
      />
    );

    const cantidadInput = screen.getByRole("spinbutton");
    const agregarButton = screen.getByRole("button", { name: /Agregar al carrito/i });

    fireEvent.change(cantidadInput, { target: { value: '3' } });
    expect(cantidadInput).toHaveValue(3);

    fireEvent.click(agregarButton);

    expect(mockOnAgregar).toHaveBeenCalledTimes(1);
    expect(mockOnAgregar).toHaveBeenCalledWith(3);

    expect(cantidadInput).toHaveValue(1);
    expect(screen.getByText(/7 unidades disponibles/i)).toBeInTheDocument();
  });

  // --- CP-4: Stock agotado ---
  it("CP-AgregarCarrito4: Muestra 'Agotado' y deshabilita controles si stockInicial es 0", () => {
    render(
      <AgregarCarrito
        stockInicial={0}
        onAgregar={mockOnAgregar}
        usuario={mockUsuarioNormal}
        precio={precioProducto}
      />
    );

    expect(screen.getByText(/Agotado/i)).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Agregar al carrito/i })).toBeDisabled();
  });

  // --- CP-5: Limite de cantidad ---
  it("CP-AgregarCarrito5: No permite seleccionar cantidad mayor al stock disponible", () => {
    render(
      <AgregarCarrito
        stockInicial={3}
        onAgregar={mockOnAgregar}
        usuario={mockUsuarioNormal}
        precio={precioProducto}
      />
    );

    const cantidadInput = screen.getByRole("spinbutton");
    fireEvent.change(cantidadInput, { target: { value: '5' } });
    expect(cantidadInput).toHaveValue(3);
  });

  // --- CP-6: No permitir stock negativo ---
  it("CP-AgregarCarrito6: No permite que el stock baje de 0 al hacer clic varias veces", () => {
    render(
      <AgregarCarrito
        stockInicial={2}
        onAgregar={mockOnAgregar}
        usuario={mockUsuarioNormal}
        precio={precioProducto}
      />
    );

    const cantidadInput = screen.getByRole("spinbutton");
    const agregarButton = screen.getByRole("button", { name: /Agregar al carrito/i });

    fireEvent.change(cantidadInput, { target: { value: '1' } });
    fireEvent.click(agregarButton);
    fireEvent.click(agregarButton);
    fireEvent.click(agregarButton); // Intentar pasar de 0

    expect(screen.getByText(/Agotado/i)).toBeInTheDocument();
    expect(agregarButton).toBeDisabled();
  });
});
