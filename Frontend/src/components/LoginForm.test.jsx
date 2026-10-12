// src/components/LoginForm.test.jsx

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginForm from "./LoginForm"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import CryptoJS from "crypto-js";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// --- Mocks de Librerías Externas ---
vi.mock('crypto-js', () => ({
  default: {
    AES: {
      encrypt: vi.fn((data, secret) => `encrypted(${data},${secret})`),
      decrypt: vi.fn((encryptedData, secret) => {
        const match = encryptedData.match(/^encrypted\((.+),(.+)\)$/);
        if (match && match[2] === secret) {
            return { toString: () => match[1] };
        }
        throw new Error("Decryption failed");
      }),
    },
    enc: {
      Utf8: { 
        stringify: (wordArray) => wordArray.toString(), 
        parse: (str) => ({ toString: () => str }) 
      }
    }
  }
}));

vi.mock('../data/usuarios.json', () => ({ 
  default: [
    { nombre: "Admin", apellido: "Sistema", rut: "12345678K", email: "admin@test.com", password: "adminPassword", rol: "admin" },
    { nombre: "User", apellido: "Test", rut: "87654321K", email: "user@test.com", password: "userPassword", rol: "usuario" },
  ] 
}));

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

// --- Mock de react-router-dom (useNavigate) ---
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// --- Datos globales de prueba ---
const mockOnClose = vi.fn();
const mockOnUsuarioChange = vi.fn();
const claveSecreta = "miClaveFijaParaAES"; 
const mockUsuariosData = [
  { nombre: "Admin", apellido: "Sistema", rut: "12345678K", email: "admin@test.com", password: "adminPassword", rol: "admin" },
  { nombre: "User", apellido: "Test", rut: "87654321K", email: "user@test.com", password: "userPassword", rol: "usuario" },
];

// --- Helper para renderizar con Router ---
const renderComponent = () => {
   return render(
     <MemoryRouter>
          <LoginForm onClose={mockOnClose} onUsuarioChange={mockOnUsuarioChange} />
          <Routes>
              <Route path="/" element={<div>Página de Inicio</div>} />
          </Routes>
     </MemoryRouter>
   );
};

describe("Testing LoginForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear(); 
    vi.useRealTimers(); 
  });

  // --- CP-Login1 ---
  it("CP-Login1: Renderiza inputs y botón, e inicializa localStorage si está vacío", async () => {
    expect(localStorageMock.getItem('usuarios')).toBeNull();
    renderComponent();

    expect(screen.getByPlaceholderText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();

    await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('usuarios', expect.any(String));
        expect(CryptoJS.AES.encrypt).toHaveBeenCalledTimes(mockUsuariosData.length * 2); 
        expect(CryptoJS.AES.encrypt).toHaveBeenCalledWith(mockUsuariosData[0].rut, claveSecreta);
        expect(CryptoJS.AES.encrypt).toHaveBeenCalledWith(mockUsuariosData[0].password, claveSecreta);
    });
  });

  // --- CP-Login2 ---
  it("CP-Login2: No llama a setItem si localStorage ya contiene 'usuarios'", async () => {
    localStorageMock.setItem('usuarios', JSON.stringify([{ email: 'preexistente@test.com' }]));
    renderComponent();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(CryptoJS.AES.encrypt).not.toHaveBeenCalled();
  });

  // --- CP-Login3 ---
  it("CP-Login3: Muestra errores de validación en tiempo real", async () => {
    renderComponent();
    const emailInput = screen.getByPlaceholderText(/Correo electrónico/i);
    const passwordInput = screen.getByPlaceholderText(/Contraseña/i);

    fireEvent.change(emailInput, { target: { value: 'correo-mal' } });
    expect(await screen.findByText(/Correo inválido/i)).toBeInTheDocument();
    expect(emailInput).toHaveClass('is-invalid');

    fireEvent.change(emailInput, { target: { value: 'correo@valido.com' } });
    await waitFor(() => expect(screen.queryByText(/Correo inválido/i)).not.toBeInTheDocument());
    expect(emailInput).toHaveClass('is-valid');

    fireEvent.change(passwordInput, { target: { value: '123' } });
    expect(await screen.findByText(/La contraseña debe tener al menos 6 caracteres/i)).toBeInTheDocument();
    expect(passwordInput).toHaveClass('is-invalid');

    fireEvent.change(passwordInput, { target: { value: 'passwordValida' } });
    await waitFor(() => expect(screen.queryByText(/La contraseña debe tener al menos 6 caracteres/i)).not.toBeInTheDocument());
    expect(passwordInput).toHaveClass('is-valid');
  });

  // --- CP-Login5 ---
  it("CP-Login5: Muestra alerta si el correo no está registrado", async () => {
     renderComponent(); 
     await waitFor(() => expect(localStorageMock.setItem).toHaveBeenCalled());

     fireEvent.change(screen.getByPlaceholderText(/Correo electrónico/i), { target: { value: 'noexiste@test.com' } });
     fireEvent.change(screen.getByPlaceholderText(/Contraseña/i), { target: { value: 'passwordValida' } });
     fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

     await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Este correo no está registrado/i);
     });
     expect(CryptoJS.AES.decrypt).not.toHaveBeenCalled(); 
  });

  // --- CP-Login6 ---
  it("CP-Login6: Muestra alerta si la contraseña es incorrecta", async () => {
    renderComponent(); 
    await waitFor(() => expect(localStorageMock.setItem).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/Correo electrónico/i), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Contraseña/i), { target: { value: 'incorrecta' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
        expect(CryptoJS.AES.decrypt).toHaveBeenCalledWith(`encrypted(${mockUsuariosData[0].password},${claveSecreta})`, claveSecreta);
        expect(screen.getByRole('alert')).toHaveTextContent(/Contraseña incorrecta/i);
    });
    expect(mockOnUsuarioChange).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

});
