// src/components/FormularioUsuarioNV.test.jsx

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FormularioUsuarioNV from "./FormularioUsuarioNV"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

// --- Mock de datos JSON (CORREGIDO) ---

// 1. Define los datos para que EL TEST los use (scope local)
const mockUsuariosData = {
  usuarios: [
    { id: "U001", nombre: "Admin", apellido: "Sistema", email: "admin@test.com", /* otros datos */ },
  ]
};
const mockRegionesData = [
  { region: 'Metropolitana', comunas: ['Santiago', 'Providencia'] },
  { region: 'Valparaíso', comunas: ['Viña del Mar', 'Quilpué'] }
];

// 2. Mockea los módulos. Estas funciones se "elevan" (hoist)
// Deben contener sus propios datos (copia de los de arriba) para que EL COMPONENTE los use
vi.mock('../data/usuarios.json', () => ({ 
  default: { // El componente usa usuariosD.usuarios, así que el mock debe tener 'default' y 'usuarios'
    usuarios: [
      { id: "U001", nombre: "Admin", apellido: "Sistema", email: "admin@test.com" },
    ]
  } 
}));
vi.mock('../data/regiones.json', () => ( 
    // El componente usa Array.isArray(regionesD), así que el mock debe devolver el array directamente
    [ 
        { region: 'Metropolitana', comunas: ['Santiago', 'Providencia'] },
        { region: 'Valparaíso', comunas: ['Viña del Mar', 'Quilpué'] }
    ] 
));
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

describe("Testing FormularioUsuarioNV Component", () => {

  const localStorageKey = 'usuarios_maestro';

  // Función helper para llenar campos válidos
  const fillValidForm = async () => {
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/Apellido/i), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText(/RUT/i), { target: { value: '11223344K' } }); 
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@gmail.com' } });
    const fechaValida = new Date();
    fechaValida.setFullYear(fechaValida.getFullYear() - 20); 
    fireEvent.change(screen.getByLabelText(/Fecha de Nacimiento/i), { target: { value: fechaValida.toISOString().split('T')[0] } });
    fireEvent.change(screen.getByLabelText(/Región/i), { target: { value: 'Metropolitana' } });
    await waitFor(() => expect(screen.getByLabelText(/Comuna/i)).toHaveValue('Santiago'));
    fireEvent.change(screen.getByLabelText(/Comuna/i), { target: { value: 'Santiago' } });
    fireEvent.change(screen.getByLabelText(/Teléfono/i), { target: { value: '912345678' } }); 
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'password123' } }); 
    fireEvent.change(screen.getByLabelText(/Rol/i), { target: { value: 'usuario' } });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Pre-carga localStorage con datos iniciales (usando la variable del test)
    localStorageMock.setItem(localStorageKey, JSON.stringify(mockUsuariosData.usuarios || []));
  });

  // --- Caso de Prueba 1: Renderizado Inicial ---
  it("CP-FormUserNV1: Renderiza formulario con valores por defecto y ID generado", () => {
    render(<FormularioUsuarioNV />);

    // Verifica campos vacíos o con default
    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('');
    expect(screen.getByLabelText(/Región/i)).toHaveValue('Metropolitana'); // Default region
    expect(screen.getByLabelText(/Comuna/i)).toHaveValue('Santiago'); // Default comuna
    expect(screen.getByLabelText(/Rol/i)).toHaveValue('admin'); // Primer rol en la lista

    // Verifica ID generado (U + conteo + 1) -> U002 porque ya existe U001
    expect(screen.getByText('U002')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar Nuevo Usuario/i })).toBeInTheDocument();
  });

  // --- Caso de Prueba 2: Cambios en Inputs y Comunas Dinámicas ---
  it("CP-FormUserNV2: Actualiza estado formData y comunas al cambiar campos", async () => {
    render(<FormularioUsuarioNV />);

    const regionSelect = screen.getByLabelText(/Región/i);
    const comunaSelect = screen.getByLabelText(/Comuna/i);
    const emailInput = screen.getByLabelText(/Email/i);

    // Cambiar email a Duoc (verifica texto informativo)
    fireEvent.change(emailInput, { target: { value: 'jane@duoc.cl' } });
    expect(emailInput).toHaveValue('jane@duoc.cl');
    expect(screen.getByText(/Detectado \(Sí\)/i)).toBeInTheDocument();

    // Cambiar región a Valparaíso
    fireEvent.change(regionSelect, { target: { value: 'Valparaíso' } });
    expect(regionSelect).toHaveValue('Valparaíso');

    // Esperar a que las comunas se actualicen
    await waitFor(() => {
        expect(comunaSelect).toContainHTML('<option value="Viña del Mar">Viña del Mar</option>');
        expect(comunaSelect).not.toContainHTML('<option value="Santiago">Santiago</option>');
        expect(comunaSelect).toHaveValue('Viña del Mar'); 
    });
  });

  // --- Caso de Prueba 3: Envío Exitoso ---
  it("CP-FormUserNV3: Guarda el nuevo usuario en localStorage y limpia el formulario", async () => {
    render(<FormularioUsuarioNV />);
    await fillValidForm(); 
    const submitButton = screen.getByRole('button', { name: /Registrar Nuevo Usuario/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(localStorageKey, expect.any(String));
        const savedData = JSON.parse(localStorageMock.setItem.mock.calls[1][1]); 

        expect(savedData).toHaveLength(mockUsuariosData.usuarios.length + 1); 
        const nuevoUsuarioGuardado = savedData.find(u => u.id === 'U002');
        expect(nuevoUsuarioGuardado).toBeDefined();
        expect(nuevoUsuarioGuardado.nombre).toBe('Test');
        expect(nuevoUsuarioGuardado.rut).toBe('11223344K'); 
        expect(nuevoUsuarioGuardado.email).toBe('test@gmail.com');
        expect(nuevoUsuarioGuardado.esDuoc).toBe(false); 
        expect(nuevoUsuarioGuardado.rol).toBe('usuario');

        expect(window.alert).toHaveBeenCalledWith('Usuario Test creado con ID U002.');

        expect(screen.getByLabelText(/Nombre/i)).toHaveValue('');
        expect(screen.getByLabelText(/RUT/i)).toHaveValue('');
        expect(screen.getByText('U003')).toBeInTheDocument();
    });
  });

  // --- Caso de Prueba 4: Fallo de Validación (Edad) ---
  it("CP-FormUserNV4: Muestra alerta y no guarda si el usuario es menor de 18", async () => {
    render(<FormularioUsuarioNV />);
    await fillValidForm(); 

    const fechaMenor = new Date();
    fechaMenor.setFullYear(fechaMenor.getFullYear() - 17);
    fireEvent.change(screen.getByLabelText(/Fecha de Nacimiento/i), { target: { value: fechaMenor.toISOString().split('T')[0] } });

    const submitButton = screen.getByRole('button', { name: /Registrar Nuevo Usuario/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('mayor de 18 años'));
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('Test');
  });

  // --- Caso de Prueba 5: Fallo de Validación (Email Dominio Inválido) ---
   it("CP-FormUserNV5: Muestra alerta si el dominio del email no es permitido", async () => {
    render(<FormularioUsuarioNV />);
    await fillValidForm();

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@otrodominio.com' } });
    const submitButton = screen.getByRole('button', { name: /Registrar Nuevo Usuario/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('dominio del correo debe ser uno de'));
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });
  });

  // --- Caso de Prueba 6: Fallo de Validación (Teléfono Corto) ---
  it("CP-FormUserNV6: Muestra alerta si el teléfono tiene menos de 9 dígitos", async () => {
    render(<FormularioUsuarioNV />);
    await fillValidForm();

    fireEvent.change(screen.getByLabelText(/Teléfono/i), { target: { value: '123456' } });
    const submitButton = screen.getByRole('button', { name: /Registrar Nuevo Usuario/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Teléfono debe tener al menos 9 dígitos'));
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });
  });

   // --- Caso de Prueba 7: Fallo de Envío (Email Duplicado) ---
   it("CP-FormUserNV7: Muestra alerta si el email ya está registrado", async () => {
    render(<FormularioUsuarioNV />);
    await fillValidForm(); 

    // Poner email duplicado (del mock U001)
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@test.com' } });

    const submitButton = screen.getByRole('button', { name: /Registrar Nuevo Usuario/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('ya está registrado'));
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(1); // Solo inicialización
    });
  });

});