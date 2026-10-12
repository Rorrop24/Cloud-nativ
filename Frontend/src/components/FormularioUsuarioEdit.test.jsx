// src/components/FormularioUsuarioEdit.test.jsx

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FormularioUsuarioEdit from "./FormularioUsuarioEdit"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom"; // Para simular useParams y navigate

// --- Mock de datos JSON (CORREGIDO) ---
// 1. Define los datos para que EL TEST los use
const mockUsuariosData = {
  usuarios: [
    { id: "U001", nombre: "Admin", apellido: "Sistema", rut: "12345678K", email: "admin@levelup.cl", fecha: "1990-01-01", region: "Metropolitana", comuna: "Santiago", telefono: "912345678", password: "oldPassword", esDuoc: false, rol: "admin" },
    { id: "U002", nombre: "Usuario", apellido: "Normal", rut: "87654321K", email: "usuario@duoc.cl", fecha: "1995-10-10", region: "Valparaíso", comuna: "Viña del Mar", telefono: "987654321", password: "userPass", esDuoc: true, rol: "usuario" },
  ]
};
const mockRegionesData = [
  { region: 'Metropolitana', comunas: ['Santiago', 'Providencia'] },
  { region: 'Valparaíso', comunas: ['Viña del Mar', 'Quilpué'] }
];

// 2. Mockea los módulos. Estas funciones se "elevan" (hoist)
// Deben contener sus propios datos (copia de los de arriba) para que EL COMPONENTE los use
vi.mock('../data/usuarios.json', () => ({ 
    default: {
        usuarios: [
            { id: "U001", nombre: "Admin", apellido: "Sistema", rut: "12345678K", email: "admin@levelup.cl", fecha: "1990-01-01", region: "Metropolitana", comuna: "Santiago", telefono: "912345678", password: "oldPassword", esDuoc: false, rol: "admin" },
            { id: "U002", nombre: "Usuario", apellido: "Normal", rut: "87654321K", email: "usuario@duoc.cl", fecha: "1995-10-10", region: "Valparaíso", comuna: "Viña del Mar", telefono: "987654321", password: "userPass", esDuoc: true, rol: "usuario" },
        ]
    } 
}));
vi.mock('../data/regiones.json', () => ({ 
    default: [
        { region: 'Metropolitana', comunas: ['Santiago', 'Providencia'] },
        { region: 'Valparaíso', comunas: ['Viña del Mar', 'Quilpué'] }
    ] 
}));
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

// --- Mock de react-router-dom (useNavigate y useParams) ---
const mockNavigate = vi.fn();
const createMockUseParams = (id) => () => ({ id });
let mockUseParams = createMockUseParams("U001"); 

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(), // Usa la función mock
  };
});
// ----------------------------------------------------

// --- Mock de window.alert ---
window.alert = vi.fn();
// ----------------------------


describe("Testing FormularioUsuarioEdit Component", () => {

  const userIdToEdit = 'U001'; 

  // Función helper para renderizar con Router y datos iniciales
  const renderComponent = (userId = userIdToEdit, initialLocalStorageData = mockUsuariosData.usuarios) => {
    mockUseParams = createMockUseParams(userId); // Actualiza el ID simulado
    localStorageMock.setItem('usuarios_maestro', JSON.stringify(initialLocalStorageData));
     return render(
       <MemoryRouter initialEntries={[`/usuariosadmin/editar/${userId}`]}>
            <Routes>
                <Route path="/usuariosadmin/editar/:id" element={<FormularioUsuarioEdit userId={userId} />} />
                <Route path="/usuariosadmin" element={<div>Lista de Usuarios</div>} />
            </Routes>
       </MemoryRouter>
     );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear(); 
    // Pre-carga localStorage CADA VEZ
    localStorageMock.setItem('usuarios_maestro', JSON.stringify(mockUsuariosData.usuarios));
  });

  // --- Caso de Prueba 1: Carga Inicial y Renderizado de Datos ---
  it("CP-FormEditUser1: Muestra 'Cargando...' y luego renderiza el formulario con los datos del usuario a editar", async () => {
    renderComponent(userIdToEdit);

    // Verifica estado de carga inicial
    expect(screen.getByText(/Cargando datos del usuario/i)).toBeInTheDocument();

    // Espera a que el useEffect termine y el formulario se renderice
    await waitFor(() => {
      expect(screen.queryByText(/Cargando datos del usuario/i)).not.toBeInTheDocument();
      // Verifica campos llenos con datos de U001 (Admin)
      expect(screen.getByLabelText(/Nombre/i)).toHaveValue('Admin');
      expect(screen.getByLabelText(/Apellido/i)).toHaveValue('Sistema');
      expect(screen.getByLabelText(/RUT/i)).toHaveValue('12345678K');
      expect(screen.getByLabelText(/Email/i)).toHaveValue('admin@levelup.cl');
      expect(screen.getByLabelText(/Fecha de Nacimiento/i)).toHaveValue('1990-01-01');
      expect(screen.getByLabelText(/Región/i)).toHaveValue('Metropolitana');
      expect(screen.getByLabelText(/Comuna/i)).toHaveValue('Santiago');
      expect(screen.getByLabelText(/Teléfono/i)).toHaveValue('912345678');
      expect(screen.getByLabelText(/Rol/i)).toHaveValue('admin');
      expect(screen.getByLabelText(/Nueva Contraseña/i)).toHaveValue('');
      expect(screen.getByText('U001')).toBeInTheDocument();
    });
  });

  // --- Caso de Prueba 2: No encuentra el Usuario ---
   it("CP-FormEditUser2: Muestra alerta y navega si el ID del usuario no se encuentra", async () => {
     renderComponent("ID_INEXISTENTE"); // Intenta editar un ID que no existe

    // Espera a que termine la carga y se ejecute la lógica de no encontrado
    await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith("Usuario no encontrado.");
        expect(mockNavigate).toHaveBeenCalledWith('/usuariosadmin');
    });
  });

  // --- Caso de Prueba 3: Cambios en Inputs (Estado) y Comunas Dinámicas ---
  it("CP-FormEditUser3: Actualiza estado formData y comunas al cambiar región y otros campos", async () => {
    renderComponent(userIdToEdit); // Carga usuario U001
    await waitFor(() => expect(screen.queryByText(/Cargando/i)).not.toBeInTheDocument()); 

    const nombreInput = screen.getByLabelText(/Nombre/i);
    const regionSelect = screen.getByLabelText(/Región/i);
    const comunaSelect = screen.getByLabelText(/Comuna/i);

    fireEvent.change(nombreInput, { target: { value: 'Admin Editado' } });
    expect(nombreInput).toHaveValue('Admin Editado');

    // Comprobar estado inicial de comunas (Metropolitana)
    expect(comunaSelect).toContainHTML('<option value="Santiago">Santiago</option>');

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

  // --- Caso de Prueba 4: Envío Exitoso (Actualización) ---
  it("CP-FormEditUser4: Guarda los cambios en localStorage y navega al enviar con datos válidos", async () => {
    renderComponent(userIdToEdit); // Editar U001
    await waitFor(() => expect(screen.queryByText(/Cargando/i)).not.toBeInTheDocument());

    // Modificar campos
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: 'Admin Actualizado' } });
    fireEvent.change(screen.getByLabelText(/Teléfono/i), { target: { value: '999999999' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin.editado@duoc.cl' } });
    fireEvent.change(screen.getByLabelText(/Nueva Contraseña/i), { target: { value: 'newPassword123' } });

    // Enviar formulario
    const guardarButton = screen.getByRole('button', { name: /Guardar Cambios/i });
    fireEvent.click(guardarButton);

    // Esperar a que se procese el submit
    await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY_USERS, expect.any(String));
        const savedData = JSON.parse(localStorageMock.setItem.mock.calls[1][1]);
        const updatedUser = savedData.find(u => u.id === userIdToEdit);

        // Verifica campos actualizados
        expect(updatedUser.nombre).toBe('Admin Actualizado');
        expect(updatedUser.telefono).toBe('999999999');
        expect(updatedUser.email).toBe('admin.editado@duoc.cl');
        expect(updatedUser.esDuoc).toBe(true); 
        expect(updatedUser.password).toBe('newPassword123'); 

        expect(window.alert).toHaveBeenCalledWith(`Usuario Admin Actualizado (${userIdToEdit}) actualizado correctamente.`);
        expect(mockNavigate).toHaveBeenCalledWith('/usuariosadmin');
    });
  });

   // --- Caso de Prueba 5: Fallo de Validación (Edad Inválida) ---
   it("CP-FormEditUser5: Muestra alerta y no guarda si la fecha de nacimiento es inválida (menor de 18)", async () => {
    renderComponent(userIdToEdit);
    await waitFor(() => expect(screen.queryByText(/Cargando/i)).not.toBeInTheDocument());

    const fechaMenor = new Date();
    fechaMenor.setFullYear(fechaMenor.getFullYear() - 17);
    fireEvent.change(screen.getByLabelText(/Fecha de Nacimiento/i), { target: { value: fechaMenor.toISOString().split('T')[0] } });

    const guardarButton = screen.getByRole('button', { name: /Guardar Cambios/i });
    fireEvent.click(guardarButton);

    await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('mayor de 18 años'));
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

   // --- Caso de Prueba 6: Botón Cancelar ---
   it("CP-FormEditUser6: Navega a la lista de usuarios al hacer clic en Cancelar", async () => {
    renderComponent(userIdToEdit);
    await waitFor(() => expect(screen.queryByText(/Cargando/i)).not.toBeInTheDocument());

   const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith('/usuariosadmin');
  });

});