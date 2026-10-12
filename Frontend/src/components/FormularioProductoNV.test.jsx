import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FormularioProductoNV from "./FormularioProductoNV"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

// --- Mock de datos JSON ---
const mockProductosD = {
  categorias: ["Juegos de Mesa", "Accesorios"],
  productos: [
    { id: "JM001", categoria: "Juegos de Mesa", nombre: "Catan", stock: 10 },
    { id: "AC001", categoria: "Accesorios", nombre: "Mando", stock: 5 },
  ]
};
vi.mock('../data/productos.json', () => ({ default: mockProductosD }));
// ----------------------------

// --- Mock de localStorage ---
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
// -----------------------------

// --- Mock de window.alert ---
window.alert = vi.fn();
// ----------------------------

describe("Testing FormularioProductoNV Component", () => {

  const localStorageKey = 'productos_maestro';

  const fillForm = () => {
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: 'Nuevo Juego' } });
    fireEvent.change(screen.getByLabelText(/Categoría/i), { target: { value: 'Juegos de Mesa' } });
    fireEvent.change(screen.getByLabelText(/Precio/i), { target: { value: '15000' } });
    fireEvent.change(screen.getByLabelText(/Stock Inicial/i), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText(/Stock Crítico/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Detalles/i), { target: { value: '{"Editorial":"Devir"}' } });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem(localStorageKey, JSON.stringify(mockProductosD.productos));
  });

  it("CP-FormProdNV1: Renderiza el formulario con valores iniciales y el ID generado", () => {
    render(<FormularioProductoNV />);

    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('');
    expect(screen.getByLabelText(/Categoría/i)).toHaveValue('Juegos de Mesa');
    expect(screen.getByLabelText(/Precio/i).value).toBe('');
    expect(screen.getByLabelText(/Stock Inicial/i).value).toBe('');
    expect(screen.getByLabelText(/Stock Crítico/i).value).toBe('5');

    expect(screen.getByText('JM002')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear Nuevo Producto/i })).toBeInTheDocument();
  });

  it("CP-FormProdNV2: Actualiza el estado formData y el ID generado al cambiar la categoría y otros campos", () => {
    render(<FormularioProductoNV />);

    const nombreInput = screen.getByLabelText(/Nombre/i);
    const categoriaSelect = screen.getByLabelText(/Categoría/i);
    const stockInput = screen.getByLabelText(/Stock Inicial/i);

    fireEvent.change(nombreInput, { target: { value: 'Nuevo Accesorio' } });
    expect(nombreInput).toHaveValue('Nuevo Accesorio');

    fireEvent.change(categoriaSelect, { target: { value: 'Accesorios' } });
    expect(categoriaSelect).toHaveValue('Accesorios');

    fireEvent.change(stockInput, { target: { value: '50' } });
    expect(stockInput).toHaveValue(50);

    expect(screen.getByText('AC002')).toBeInTheDocument();
  });

  it("CP-FormProdNV3: Guarda el nuevo producto en localStorage y limpia el formulario al enviar con datos válidos", async () => {
    render(<FormularioProductoNV />);

    fillForm();

    const submitButton = screen.getByRole('button', { name: /Crear Nuevo Producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith(localStorageKey, expect.any(String));
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[1][1]);
      expect(savedData).toHaveLength(mockProductosD.productos.length + 1);
      const nuevoProducto = savedData.find(p => p.id === 'JM002');
      expect(nuevoProducto).toBeDefined();
      expect(nuevoProducto.nombre).toBe('Nuevo Juego');
      expect(nuevoProducto.precio).toBe(15000);
      expect(nuevoProducto.stock).toBe(25);
      expect(nuevoProducto.stockCritico).toBe(10);
      expect(nuevoProducto.detalles).toEqual({ Editorial: "Devir" });

      expect(window.alert).toHaveBeenCalledWith('Producto "Nuevo Juego" (ID: JM002) creado y guardado.');

      expect(screen.getByLabelText(/Nombre/i)).toHaveValue('');
      expect(screen.getByLabelText(/Precio/i).value).toBe('');
      expect(screen.getByLabelText(/Stock Inicial/i).value).toBe('');
      expect(screen.getByLabelText(/Categoría/i)).toHaveValue('Juegos de Mesa');
      expect(screen.getByText('JM003')).toBeInTheDocument();
    });
  });

  it("CP-FormProdNV4: Muestra alerta y no guarda si el precio es inválido (cero o negativo)", async () => {
    render(<FormularioProductoNV />);
    fillForm();
    fireEvent.change(screen.getByLabelText(/Precio/i), { target: { value: '0' } });

    fireEvent.click(screen.getByRole('button', { name: /Crear Nuevo Producto/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Precio debe ser un número positivo'));
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('Nuevo Juego');
  });

  it("CP-FormProdNV5: Muestra alerta y no guarda si el JSON de detalles es inválido", async () => {
    render(<FormularioProductoNV />);
    fillForm();
    fireEvent.change(screen.getByLabelText(/Detalles/i), { target: { value: '{"Marca":"Roto"' } });

    fireEvent.click(screen.getByRole('button', { name: /Crear Nuevo Producto/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Detalles (JSON)\' no tiene un formato JSON válido'));
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('Nuevo Juego');
  });

  it("CP-FormProdNV6: Muestra alerta si el ID generado ya existe", async () => {
    const productosConDuplicado = [
      ...mockProductosD.productos,
      { id: "JM002", categoria: "Juegos de Mesa", nombre: "Otro Juego", stock: 5 }
    ];
    localStorageMock.setItem(localStorageKey, JSON.stringify(productosConDuplicado));

    render(<FormularioProductoNV />);
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: 'Juego Repetido' } });
    fireEvent.change(screen.getByLabelText(/Categoría/i), { target: { value: 'Juegos de Mesa' } });
    fireEvent.change(screen.getByLabelText(/Precio/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/Stock Inicial/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Stock Crítico/i), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /Crear Nuevo Producto/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('ID generado ("JM002") ya existe'));
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('Juego Repetido');
  });

});
