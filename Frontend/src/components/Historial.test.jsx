// src/components/Historial.test.jsx

import { fireEvent, render, screen, within } from "@testing-library/react"; // <-- 'within' AÑADIDO
import Historial from "./Historial"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

// --- Mock de datos de historial.json (CORREGIDO) ---

// 1. Define los datos para que EL TEST los use (scope local)
const mockHistorialData = [
  {
    "idTransaccion": "T001",
    "userId": "U001", 
    "fechaCompra": "2025-09-15",
    "totalOrden": 249900,
    "productosComprados": [
      { "idProducto": "KB001", "nombreProducto": "Teclado Wooting", "cantidad": 1, "subtotal": 179990 },
      { "idProducto": "MS001", "nombreProducto": "Mouse Logitech", "cantidad": 1, "subtotal": 49990 },
    ]
  },
  {
    "idTransaccion": "T002",
    "userId": "U002", 
    "fechaCompra": "2025-10-01",
    "totalOrden": 549990,
    "productosComprados": [
      { "idProducto": "CO001", "nombreProducto": "PlayStation 5", "cantidad": 1, "subtotal": 549990 }
    ]
  },
   {
    "idTransaccion": "T003",
    "userId": "U001", 
    "fechaCompra": "2025-10-10",
    "totalOrden": 29990,
    "productosComprados": [
      { "idProducto": "JM001", "nombreProducto": "Catan", "cantidad": 1, "subtotal": 29990 }
    ]
  }
];

// 2. Mockea el módulo. Esta función se "eleva" (hoist)
// Debe contener sus propios datos (copia de los de arriba) para que EL COMPONENTE los use
vi.mock('../data/historial.json', () => ({
  default: [ // El JSON es un array, así que el mock devuelve un array
    {
      "idTransaccion": "T001", "userId": "U001", "fechaCompra": "2025-09-15", "totalOrden": 249900,
      "productosComprados": [
        { "idProducto": "KB001", "nombreProducto": "Teclado Wooting", "cantidad": 1, "subtotal": 179990 },
        { "idProducto": "MS001", "nombreProducto": "Mouse Logitech", "cantidad": 1, "subtotal": 49990 },
      ]
    },
    {
      "idTransaccion": "T002", "userId": "U002", "fechaCompra": "2025-10-01", "totalOrden": 549990,
      "productosComprados": [
        { "idProducto": "CO001", "nombreProducto": "PlayStation 5", "cantidad": 1, "subtotal": 549990 }
      ]
    },
    {
      "idTransaccion": "T003", "userId": "U001", "fechaCompra": "2025-10-10", "totalOrden": 29990,
      "productosComprados": [
        { "idProducto": "JM001", "nombreProducto": "Catan", "cantidad": 1, "subtotal": 29990 }
      ]
    }
  ]
}));
// ------------------------------------

describe("Testing Historial Component (Modal)", () => {
  // --- Mocks y Datos de Prueba ---
  const mockOnClose = vi.fn();
  const userIdConHistorial = "U001";
  const userNameConHistorial = "Admin Sistema";
  const userIdSinHistorial = "U003"; // Un ID que no está en el mock
  const userNameSinHistorial = "Usuario Nuevo";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Caso de Prueba 1: No Renderiza sin userId ---
  it("CP-Historial1: No renderiza nada si no se proporciona userId", () => {
    const { container } = render(<Historial userId={null} userName="Test" onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull(); // El componente debe devolver null
  });

  // --- Caso de Prueba 2: Renderizado Básico con Historial ---
  it("CP-Historial2: Renderiza el modal con título, info de usuario y órdenes cuando hay historial", () => {
    render(<Historial userId={userIdConHistorial} userName={userNameConHistorial} onClose={mockOnClose} />);

    // Verifica Título
    expect(screen.getByRole('heading', { name: /Historial de Compras/i })).toBeInTheDocument();
    // Verifica Info Usuario
    expect(screen.getByText(`Usuario: ${userNameConHistorial} (ID: ${userIdConHistorial})`)).toBeInTheDocument();
    // Verifica que se muestren las órdenes (buscando por ID de transacción)
    expect(screen.getByText(/Orden #T001/i)).toBeInTheDocument();
    expect(screen.getByText(/Orden #T003/i)).toBeInTheDocument(); // Segunda orden del mismo usuario
    // Verifica que NO se muestre la orden del otro usuario
    expect(screen.queryByText(/Orden #T002/i)).not.toBeInTheDocument();
    // Verifica botón Cerrar
    expect(screen.getByRole('button', { name: /Cerrar/i })).toBeInTheDocument();
  });

  // --- Caso de Prueba 3: Contenido Detallado de una Orden ---
  it("CP-Historial3: Muestra correctamente los productos, cantidades y subtotales dentro de una orden", () => {
    render(<Historial userId={userIdConHistorial} userName={userNameConHistorial} onClose={mockOnClose} />);

    // Busca la primera orden (T001) y verifica su contenido
    const ordenT001 = screen.getByText(/Orden #T001/i).closest('div.mb-3'); // Encuentra el div padre de la orden
    expect(ordenT001).toBeInTheDocument();

    const withinOrden = within(ordenT001); // Limita la búsqueda a esta orden

    // Producto 1
    expect(withinOrden.getByText(/\(1x\) Teclado Wooting/i)).toBeInTheDocument();
    expect(withinOrden.getByText(`$${(179990).toLocaleString('es-CL')}`)).toBeInTheDocument();
    // Producto 2
    expect(withinOrden.getByText(/\(1x\) Mouse Logitech/i)).toBeInTheDocument();
    expect(withinOrden.getByText(`$${(49990).toLocaleString('es-CL')}`)).toBeInTheDocument();
  });

  // --- Caso de Prueba 4: Cálculo y Muestra del Total Acumulado ---
  it("CP-Historial4: Calcula y muestra correctamente el TOTAL ACUMULADO de todas las órdenes del usuario", () => {
    render(<Historial userId={userIdConHistorial} userName={userNameConHistorial} onClose={mockOnClose} />);

    // El usuario U001 tiene dos órdenes: T001 (249900) y T003 (29990)
    const totalEsperado = 249900 + 29990;

    // Busca el elemento del total acumulado
    const totalElement = screen.getByText(/TOTAL ACUMULADO:/i);
    expect(totalElement).toBeInTheDocument();

    // Busca el valor del total (puede estar en un span hermano o padre)
    const totalValueElement = totalElement.closest('div').querySelector('span:last-child');
    expect(totalValueElement).toHaveTextContent(`$${totalEsperado.toLocaleString('es-CL')}`);
  });

  // --- Caso de Prueba 5: Mensaje Cuando No Hay Historial ---
  it("CP-Historial5: Muestra el mensaje 'Este usuario no tiene compras registradas' si el historial está vacío", () => {
    render(<Historial userId={userIdSinHistorial} userName={userNameSinHistorial} onClose={mockOnClose} />);

    // Verifica mensaje de historial vacío
    expect(screen.getByText(/Este usuario no tiene compras registradas/i)).toBeInTheDocument();
    // Verifica que NO se muestren órdenes
    expect(screen.queryByText(/Orden #/i)).not.toBeInTheDocument();
    // Verifica que NO se muestre el total acumulado
    expect(screen.queryByText(/TOTAL ACUMULADO:/i)).not.toBeInTheDocument();
  });

  // --- Caso de Prueba 6: Evento Cerrar (Overlay) ---
  it("CP-Historial6: Llama a onClose cuando se hace clic en el overlay (fondo)", () => {
    render(<Historial userId={userIdConHistorial} userName={userNameConHistorial} onClose={mockOnClose} />);

    // El overlay es el div más externo con position: fixed
    const overlay = screen.getByRole('dialog').parentElement; // El div que tiene el estilo del overlay
    
    fireEvent.click(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // --- Caso de Prueba 7: Evento Cerrar (Botón) ---
  it("CP-Historial7: Llama a onClose cuando se hace clic en el botón 'Cerrar'", () => {
    render(<Historial userId={userIdConHistorial} userName={userNameConHistorial} onClose={mockOnClose} />);
    const closeButton = screen.getByRole('button', { name: /Cerrar/i });

    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // --- Caso de Prueba 8: No Cierra al Hacer Clic Dentro del Contenido ---
  it("CP-Historial8: NO llama a onClose cuando se hace clic dentro del contenido del modal", () => {
    render(<Historial userId={userIdConHistorial} userName={userNameConHistorial} onClose={mockOnClose} />);

    // Buscamos el div del contenido principal del modal
    const contentDiv = screen.getByText(/Historial de Compras/i).closest('div[style*="backgroundColor: rgba(33, 37, 41, 0.95)"]');
    expect(contentDiv).toBeInTheDocument();

    // Hacemos clic dentro de este div
    fireEvent.click(contentDiv);

    // Verificamos que onClose NO fue llamado
    expect(mockOnClose).not.toHaveBeenCalled();
  });

});