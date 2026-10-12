import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Incidencia from "./Incidencia"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

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

// --- Mock de Datos ---
const mockUsuario = { email: "test@ejemplo.com", nombre: "Usuario Test" };
const mockMensajesSoporte = {
  "test@ejemplo.com": [
    { tipo: "soporte", asunto: "Problema A", mensaje: "Descripción del problema A", fecha: "2025-10-28 10:00:00" },
    { tipo: "consulta", asunto: "Duda B", mensaje: "Descripción de la duda B", fecha: "2025-10-27 15:30:00" },
  ],
  "otro@ejemplo.com": [
    { tipo: "soporte", asunto: "Otro problema", mensaje: "Detalle", fecha: "2025-10-26 09:00:00" },
  ]
};
// --------------------

describe("Testing Incidencia Component", () => {

  const localStorageKey = "mensajesSoporte";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Pre-cargar localStorage con datos mock para cada test
    localStorageMock.setItem(localStorageKey, JSON.stringify(mockMensajesSoporte));
  });

  // --- Caso de Prueba 1: No Renderiza sin Usuario ---
  it("CP-Incidencia1: No renderiza nada si no se pasa la prop 'usuario'", () => {
    const { container } = render(<Incidencia usuario={null} actualizarTrigger={0} />);
    expect(container.firstChild).toBeNull(); // Debe devolver null
  });

  // --- Caso de Prueba 2: Mensaje Cuando No Hay Incidencias ---
  it("CP-Incidencia2: Muestra mensaje 'No has enviado solicitudes...' si el usuario no tiene incidencias", () => {
    // Usamos un usuario sin mensajes en el mock
    const usuarioSinMensajes = { email: "nuevo@ejemplo.com" };
    render(<Incidencia usuario={usuarioSinMensajes} actualizarTrigger={0} />);

    expect(screen.getByText(/No has enviado solicitudes de soporte./i)).toBeInTheDocument();
    // Verifica que la lista <ul> no se renderiza
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  // --- Caso de Prueba 3: Renderizado con Incidencias ---
  it("CP-Incidencia3: Muestra correctamente la lista de incidencias del usuario", () => {
    render(<Incidencia usuario={mockUsuario} actualizarTrigger={0} />);

    // Verifica que el mensaje de "no hay solicitudes" NO está
    expect(screen.queryByText(/No has enviado solicitudes/i)).not.toBeInTheDocument();

    // Verifica que la lista <ul> existe
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute('id', 'incidenciasUsuario');

    // Verifica el contenido de las incidencias del usuario mock (test@ejemplo.com)
    expect(screen.getByText(/SOPORTE - Problema A/i)).toBeInTheDocument();
    expect(screen.getByText("Descripción del problema A")).toBeInTheDocument();
    expect(screen.getByText("2025-10-28 10:00:00")).toBeInTheDocument();

    expect(screen.getByText(/CONSULTA - Duda B/i)).toBeInTheDocument();
    expect(screen.getByText("Descripción de la duda B")).toBeInTheDocument();
    expect(screen.getByText("2025-10-27 15:30:00")).toBeInTheDocument();

    // Verifica que NO se muestran incidencias de OTRO usuario
    expect(screen.queryByText(/Otro problema/i)).not.toBeInTheDocument();

    // Verifica que hay 2 items en la lista y tienen botón Eliminar
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    expect(within(listItems[0]).getByRole('button', { name: /Eliminar/i })).toBeInTheDocument();
    expect(within(listItems[1]).getByRole('button', { name: /Eliminar/i })).toBeInTheDocument();
  });

  // --- Caso de Prueba 4: Eliminar Incidencia ---
  it("CP-Incidencia4: Elimina la incidencia correcta de la lista y actualiza localStorage al hacer clic en 'Eliminar'", async () => {
    render(<Incidencia usuario={mockUsuario} actualizarTrigger={0} />);

    // Encuentra los botones de eliminar
    const botonesEliminar = screen.getAllByRole('button', { name: /Eliminar/i });
    expect(botonesEliminar).toHaveLength(2); // Asegura que hay dos incidencias al inicio

    // Hacemos clic en eliminar la PRIMERA incidencia ("Problema A")
    fireEvent.click(botonesEliminar[0]);

    // Esperar a que el estado se actualice y la UI se re-renderice
    await waitFor(() => {
        // Verifica que la primera incidencia ya no está visible
        expect(screen.queryByText(/Problema A/i)).not.toBeInTheDocument();
        // Verifica que la segunda incidencia SÍ sigue visible
        expect(screen.getByText(/Duda B/i)).toBeInTheDocument();
        // Verifica que ahora solo hay 1 item en la lista
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    // Verifica que localStorage fue actualizado correctamente
    expect(localStorageMock.setItem).toHaveBeenCalledWith(localStorageKey, expect.any(String));
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[1][1]); // [1] por la carga inicial
    // Verifica que el array del usuario ahora solo tiene 1 elemento (la Duda B)
    expect(savedData[mockUsuario.email]).toHaveLength(1);
    expect(savedData[mockUsuario.email][0].asunto).toBe("Duda B");
    // Verifica que los mensajes del otro usuario no fueron afectados
    expect(savedData["otro@ejemplo.com"]).toHaveLength(1);
  });

  // --- Caso de Prueba 5: Actualización por Trigger ---
  it("CP-Incidencia5: Recarga las incidencias si la prop 'actualizarTrigger' cambia", () => {
    // Renderiza inicialmente
    const { rerender } = render(<Incidencia usuario={mockUsuario} actualizarTrigger={0} />);

    // Verifica estado inicial (2 incidencias)
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    // Simulamos que se añade un nuevo mensaje externamente y actualizamos localStorage
    const mensajesActualizados = {
      ...mockMensajesSoporte,
      [mockUsuario.email]: [
        ...mockMensajesSoporte[mockUsuario.email],
        { tipo: "nuevo", asunto: "Nuevo Mensaje C", mensaje: "...", fecha: "2025-10-29 12:00:00" }
      ]
    };
    localStorageMock.setItem(localStorageKey, JSON.stringify(mensajesActualizados));

    // Cambiamos el valor del trigger para forzar el useEffect
    rerender(<Incidencia usuario={mockUsuario} actualizarTrigger={1} />);

    // Esperar a que el useEffect se ejecute y actualice el estado
    // Verificamos que ahora hay 3 incidencias en la lista
     waitFor(() => {
        expect(screen.getAllByRole('listitem')).toHaveLength(3);
        expect(screen.getByText(/Nuevo Mensaje C/i)).toBeInTheDocument();
     });
  });

});