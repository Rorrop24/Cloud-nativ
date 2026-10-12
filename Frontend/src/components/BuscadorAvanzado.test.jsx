import { render, screen, fireEvent } from "@testing-library/react";
import BuscadorAvanzado from "./BuscadorAvanzado";
import { describe, it, beforeEach, vi, expect } from "vitest";

const categoriasPrueba = ["Consolas", "Teclados", "Mouse"];

describe("Testing BuscadorAvanzado Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("CP-Buscador1: Renderiza correctamente el botón flotante y los campos", () => {
    render(<BuscadorAvanzado categorias={categoriasPrueba} onFilter={vi.fn()} />);

    const botonFlotante = document.querySelector(".buscador-flotante");
    expect(botonFlotante).toBeInTheDocument();

    expect(screen.getByPlaceholderText("Ej. PlayStation, ROG, mouse")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Mín")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Máx")).toBeInTheDocument();
  });

  it("CP-Buscador2: Abre y cierra el panel al hacer clic en el botón flotante", () => {
    render(<BuscadorAvanzado categorias={categoriasPrueba} onFilter={vi.fn()} />);

    const botonFlotante = document.querySelector(".buscador-flotante");

    fireEvent.click(botonFlotante);
    expect(screen.getByText(/Búsqueda avanzada/i)).toBeVisible();

    fireEvent.click(botonFlotante);
    expect(screen.getByText(/Búsqueda avanzada/i)).not.toBeVisible();
  });

  it("CP-Buscador3: Permite ingresar valores en los inputs", () => {
    render(<BuscadorAvanzado categorias={categoriasPrueba} onFilter={vi.fn()} />);

    const inputPalabra = screen.getByPlaceholderText("Ej. PlayStation, ROG, mouse");
    const inputMin = screen.getByPlaceholderText("Mín");
    const inputMax = screen.getByPlaceholderText("Máx");

    fireEvent.change(inputPalabra, { target: { value: "PlayStation" } });
    fireEvent.change(inputMin, { target: { value: "50000" } });
    fireEvent.change(inputMax, { target: { value: "150000" } });

    expect(inputPalabra.value).toBe("PlayStation");
    expect(inputMin.value).toBe("50000");
    expect(inputMax.value).toBe("150000");
  });

  it("CP-Buscador4: Llama a onFilter con los valores correctos al hacer clic en Aplicar (icono funnel)", () => {
    const mockFilter = vi.fn();
    render(<BuscadorAvanzado categorias={categoriasPrueba} onFilter={mockFilter} />);

    const botonAplicar = document.querySelector(".bi-funnel").closest("button");

    fireEvent.change(screen.getByPlaceholderText("Ej. PlayStation, ROG, mouse"), { target: { value: "Mouse" } });
    fireEvent.change(screen.getByPlaceholderText("Mín"), { target: { value: "10000" } });
    fireEvent.change(screen.getByPlaceholderText("Máx"), { target: { value: "50000" } });
    fireEvent.change(screen.getByDisplayValue("Todas"), { target: { value: "Mouse" } });

    fireEvent.click(botonAplicar);

    expect(mockFilter).toHaveBeenCalledWith({
      q: "Mouse",
      cat: "Mouse",
      min: 10000,
      max: 50000,
    });
  });

  it("CP-Buscador5: Limpia campos y llama a onFilter vacío al presionar Limpiar (icono X)", () => {
    const mockFilter = vi.fn();
    render(<BuscadorAvanzado categorias={categoriasPrueba} onFilter={mockFilter} />);

    const botonLimpiar = document.querySelector(".bi-x-lg").closest("button");

    fireEvent.change(screen.getByPlaceholderText("Ej. PlayStation, ROG, mouse"), { target: { value: "Teclado" } });
    fireEvent.change(screen.getByPlaceholderText("Mín"), { target: { value: "30000" } });
    fireEvent.change(screen.getByPlaceholderText("Máx"), { target: { value: "80000" } });
    fireEvent.change(screen.getByDisplayValue("Todas"), { target: { value: "Consolas" } });

    fireEvent.click(botonLimpiar);

    expect(mockFilter).toHaveBeenCalledWith({
      q: "",
      cat: "Todas",
      min: 0,
      max: Infinity,
    });

    expect(screen.getByPlaceholderText("Ej. PlayStation, ROG, mouse").value).toBe("");
    expect(screen.getByPlaceholderText("Mín").value).toBe("");
    expect(screen.getByPlaceholderText("Máx").value).toBe("");
  });

  it("CP-Buscador6: Cierra el panel si se hace clic fuera de él", () => {
    const { container } = render(
      <>
        <div data-testid="outside">Elemento exterior</div>
        <BuscadorAvanzado categorias={categoriasPrueba} onFilter={vi.fn()} />
      </>
    );

    const botonFlotante = container.querySelector(".buscador-flotante");
    fireEvent.click(botonFlotante); // abrir
    expect(screen.getByText(/Búsqueda avanzada/i)).toBeVisible();

    const elementoExterior = screen.getByTestId("outside");
    fireEvent.mouseDown(elementoExterior); // clic fuera

    expect(screen.getByText(/Búsqueda avanzada/i)).not.toBeVisible();
  });
});
