// src/components/ReseniaForm.test.jsx

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReseniaForm from "./ReseniaForm"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

describe("Testing ReseniaForm Component", () => {
  // --- Mocks y Datos de Prueba ---
  const mockOnAgregarReseña = vi.fn();
  const mockUsuarioLogueado = { nombre: "Juan Test", email: "juan@test.com" };
  const mockUsuarioSinNombre = { email: "anon@test.com" };

  // Limpiar mocks antes de cada prueba
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Asegurar timers reales por defecto
  });

  // --- Caso de Prueba 1: Renderizado Inicial (Usuario Logueado) ---
  it("CP-ReseniaForm1: Renderiza formulario habilitado con datos de usuario y rating por defecto", () => {
    render(<ReseniaForm usuario={mockUsuarioLogueado} onAgregarReseña={mockOnAgregarReseña} />);

    const inputNombre = screen.getByDisplayValue(mockUsuarioLogueado.nombre || mockUsuarioLogueado.email);
    expect(inputNombre).toBeInTheDocument();
    expect(inputNombre).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/Escribe tu reseña/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea).toBeEnabled();

    const estrellas = screen.getAllByRole("button", { name: /★/ });
    expect(estrellas).toHaveLength(5);
    estrellas.forEach((estrella, i) => {
      expect(estrella).toHaveStyle(`color: ${i < 5 ? "#FFD700" : "#555"}`);
    });

    const btnEnviar = screen.getByRole("button", { name: /Enviar reseña/i });
    expect(btnEnviar).toBeEnabled();
  });

  // --- Caso de Prueba 2: Renderizado Inicial (Usuario NO Logueado) ---
  it("CP-ReseniaForm2: Renderiza formulario deshabilitado si no hay usuario", () => {
    render(<ReseniaForm usuario={null} onAgregarReseña={mockOnAgregarReseña} />);

    expect(screen.getByPlaceholderText(/Debes iniciar sesión/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Debes iniciar sesión/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/Inicia sesión para escribir una reseña/i)).toBeInTheDocument();

    const btnEnviar = screen.getByRole("button", { name: /Enviar reseña/i });
    expect(btnEnviar).toBeDisabled();

    const estrellas = screen.getAllByRole("button", { name: /★/ });
    expect(estrellas[0]).toHaveStyle("cursor: not-allowed");
  });

  // --- Caso de Prueba 3: Escribir en Textarea (Estado) ---
  it("CP-ReseniaForm3: Actualiza el estado 'texto' al escribir en el textarea", () => {
    render(<ReseniaForm usuario={mockUsuarioLogueado} onAgregarReseña={mockOnAgregarReseña} />);
    const textarea = screen.getByPlaceholderText(/Escribe tu reseña/i);

    fireEvent.change(textarea, { target: { value: "¡Excelente producto!" } });
    expect(textarea).toHaveValue("¡Excelente producto!");
  });

  // --- Caso de Prueba 4: Selección de Rating (Estado y Eventos) ---
  it("CP-ReseniaForm4: Actualiza el estado 'rating' y 'hover' al interactuar con las estrellas", () => {
    render(<ReseniaForm usuario={mockUsuarioLogueado} onAgregarReseña={mockOnAgregarReseña} />);
    const estrellas = screen.getAllByRole("button", { name: /★/ });

    fireEvent.mouseEnter(estrellas[2]);
    for (let i = 0; i <= 2; i++) expect(estrellas[i]).toHaveStyle("color: #FFD700");
    for (let i = 3; i <= 4; i++) expect(estrellas[i]).toHaveStyle("color: #555");

    fireEvent.mouseLeave(estrellas[2]);
    estrellas.forEach(estrella => expect(estrella).toHaveStyle("color: #FFD700"));

    fireEvent.click(estrellas[1]);
    for (let i = 0; i <= 1; i++) expect(estrellas[i]).toHaveStyle("color: #FFD700");
    for (let i = 2; i <= 4; i++) expect(estrellas[i]).toHaveStyle("color: #555");
  });

  // --- Caso de Prueba 5: Envío Exitoso ---
  it("CP-ReseniaForm5: Llama a onAgregarReseña, limpia el formulario y muestra mensaje de éxito al enviar", async () => {
    render(<ReseniaForm usuario={mockUsuarioLogueado} onAgregarReseña={mockOnAgregarReseña} />);

    const textarea = screen.getByPlaceholderText(/Escribe tu reseña/i);
    const estrellas = screen.getAllByRole("button", { name: /★/ });
    const btn = screen.getByRole("button", { name: /Enviar reseña/i });

    fireEvent.change(textarea, { target: { value: "Buena reseña" } });
    fireEvent.click(estrellas[3]); // rating 4
    fireEvent.click(btn);

    // Espera que el mensaje de éxito aparezca
    await screen.findByText(/Reseña enviada correctamente/i);

    // Verifica que onAgregarReseña fue llamado
    expect(mockOnAgregarReseña).toHaveBeenCalledWith({
      nombre: mockUsuarioLogueado.nombre,
      email: mockUsuarioLogueado.email,
      texto: "Buena reseña",
      rating: 4
    });

    // Verifica que el formulario se limpia
    expect(textarea).toHaveValue("");
  });

  // --- Caso de Prueba 6: Fallo Envío (Texto Vacío) ---
  it("CP-ReseniaForm7: Muestra error y no llama a onAgregarReseña si el texto está vacío", async () => {
    render(<ReseniaForm usuario={mockUsuarioLogueado} onAgregarReseña={mockOnAgregarReseña} />);
    const btn = screen.getByRole("button", { name: /Enviar reseña/i });
    const textarea = screen.getByPlaceholderText(/Escribe tu reseña/i);

    expect(textarea).toHaveValue("");
    fireEvent.click(btn);

    await screen.findByText(/Escribe algo antes de enviar tu reseña/i);
    expect(mockOnAgregarReseña).not.toHaveBeenCalled();
  });

  // --- Caso de Prueba 7: Usa email como nombre si el nombre falta ---
  it("CP-ReseniaForm8: Usa el email del usuario como nombre si la propiedad 'nombre' no existe", async () => {
    render(<ReseniaForm usuario={mockUsuarioSinNombre} onAgregarReseña={mockOnAgregarReseña} />);
    const textarea = screen.getByPlaceholderText(/Escribe tu reseña/i);
    const btn = screen.getByRole("button", { name: /Enviar reseña/i });

    fireEvent.change(textarea, { target: { value: "Reseña anónima" } });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockOnAgregarReseña).toHaveBeenCalledWith(expect.objectContaining({
        nombre: mockUsuarioSinNombre.email,
        email: mockUsuarioSinNombre.email,
        texto: "Reseña anónima",
        rating: 5
      }));
    });
  });
});
