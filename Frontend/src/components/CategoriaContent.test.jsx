import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CategoriasContent from "./CategoriaContent";
import { describe, it, beforeEach, afterAll, expect, vi } from "vitest";
import "@testing-library/jest-dom";

// --- Datos de prueba ---
const mockDataParaTest = {
  categorias: ["Juegos de Mesa", "Accesorios"],
  productos: [
    { id: "P1", categoria: "Consolas", nombre: "Consola X" },
    { id: "P2", categoria: "Accesorios", nombre: "Mando Y" },
    { id: "P3", categoria: "Teclados", nombre: "Teclado Z" },
  ]
};

// --- Mock JSON ---
vi.mock('../data/productos.json', () => ({
  default: {
    categorias: mockDataParaTest.categorias,
    productos: mockDataParaTest.productos
  }
}));

// --- Mock localStorage ---
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    clear: vi.fn(() => { store = {}; }),
    removeItem: vi.fn((key) => { delete store[key]; })
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// --- Mock prompt, confirm y alert ---
const originalPrompt = window.prompt;
const originalConfirm = window.confirm;
window.alert = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  window.prompt = vi.fn();
  window.confirm = vi.fn(() => true);
  localStorageMock.setItem('productos_maestro', JSON.stringify(mockDataParaTest.productos));
});

afterAll(() => {
  window.prompt = originalPrompt;
  window.confirm = originalConfirm;
  window.alert.mockClear();
});

// --- Mock Footer ---
vi.mock('./Footer', () => ({ default: () => <div data-testid="footer-mock">Footer</div> }));

describe("CategoriasContent Component", () => {

  // --- Test 1: Renderizado inicial ---
  it("CP-Categoria1: Renderiza títulos, botón y tabla con categorías iniciales", async () => {
    render(<CategoriasContent />);

    expect(screen.getByRole('heading', { name: /Gestión de Categorías/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nueva Categoría/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Juegos de Mesa")).toBeInTheDocument();
      expect(screen.getByText("Accesorios")).toBeInTheDocument();
      expect(screen.getByText("Consolas")).toBeInTheDocument();
      expect(screen.getByText("Teclados")).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(5); // 1 header + 4 filas
  });

  // --- Test 3: Crear nueva categoría ---
  it("CP-Categoria3: Añade una nueva categoría a la tabla al usar 'Nueva Categoría'", async () => {
    window.prompt = vi.fn(() => "Nueva Cat Test");
    render(<CategoriasContent />);
    const botonNuevo = screen.getByRole('button', { name: /Nueva Categoría/i });

    await screen.findByText("Juegos de Mesa");
    expect(screen.queryByText("Nueva Cat Test")).not.toBeInTheDocument();

    fireEvent.click(botonNuevo);

    await waitFor(() => {
      expect(screen.getByText("Nueva Cat Test")).toBeInTheDocument();
    });
    expect(window.prompt).toHaveBeenCalledTimes(1);
  });

  // --- Test 4: Editar categoría ---
  it("CP-Categoria4: Actualiza el nombre de una categoría en la tabla al usar 'Editar'", async () => {
    window.prompt = vi.fn(() => "Accesorios Editado");
    render(<CategoriasContent />);

    const accesoriosText = await screen.findByText("Accesorios");
    const categoriaRow = accesoriosText.closest('tr');
    const botonEditar = within(categoriaRow).getByRole('button', { name: /Editar/i });

    fireEvent.click(botonEditar);

    await waitFor(() => {
      expect(screen.queryByText("Accesorios")).not.toBeInTheDocument();
      expect(screen.getByText("Accesorios Editado")).toBeInTheDocument();
    });
    expect(window.prompt).toHaveBeenCalledWith(expect.stringContaining('Editar categoría: Accesorios'), 'Accesorios');
  });

  // --- Test 5: Borrar categoría ---
  it("CP-Categoria5: Elimina una categoría de la tabla al usar 'Borrar'", async () => {
    window.confirm = vi.fn(() => true);
    render(<CategoriasContent />);

    const consolasText = await screen.findByText("Consolas");
    const categoriaRow = consolasText.closest('tr');
    const botonBorrar = within(categoriaRow).getByRole('button', { name: /Eliminar/i });

    expect(screen.getByText("Consolas")).toBeInTheDocument();
    fireEvent.click(botonBorrar);

    await waitFor(() => {
      expect(screen.queryByText("Consolas")).not.toBeInTheDocument();
    });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('eliminar la categoría "Consolas"'));
  });

});
