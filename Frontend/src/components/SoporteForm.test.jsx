import { render, screen, fireEvent } from "@testing-library/react";
import SoporteForm from "./SoporteForm";
import { vi, beforeEach, describe, expect, test } from "vitest";

describe("Testing SoporteForm Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks()
  });

  const usuarioMock = { email: "test@correo.com" };

  test("CP-Soporte1: Renderiza correctamente el formulario de soporte", () => {
    render(<SoporteForm usuario={usuarioMock} />);
    expect(screen.getByText("Enviar solicitud de soporte")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de Mensaje")).toBeInTheDocument();
    expect(screen.getByLabelText("Asunto")).toBeInTheDocument();
    expect(screen.getByLabelText("Mensaje")).toBeInTheDocument();
  });

  test("CP-Soporte2: Muestra advertencia si el usuario no ha iniciado sesión", () => {
    render(<SoporteForm usuario={null} />);
    fireEvent.change(screen.getByLabelText("Asunto"), {
      target: { value: "Error al iniciar" },
    });
    fireEvent.change(screen.getByLabelText("Mensaje"), {
      target: { value: "No puedo acceder" },
    });
    fireEvent.click(screen.getByText("Enviar mensaje"));

    expect(
      screen.getByText("⚠️ Debes iniciar sesión para enviar soporte.")
    ).toBeInTheDocument();
  });

  test("CP-Soporte3: Envía un mensaje y lo guarda en localStorage", () => {
    render(<SoporteForm usuario={usuarioMock} />);

    fireEvent.change(screen.getByLabelText("Asunto"), {
      target: { value: "Problema con producto" },
    });
    fireEvent.change(screen.getByLabelText("Mensaje"), {
      target: { value: "El producto no carga correctamente" },
    });
    fireEvent.click(screen.getByText("Enviar mensaje"));

    const guardado = JSON.parse(localStorage.getItem("mensajesSoporte"));
    expect(guardado[usuarioMock.email]).toHaveLength(1);
    expect(guardado[usuarioMock.email][0]).toMatchObject({
      tipo: "soporte",
      asunto: "Problema con producto",
      mensaje: "El producto no carga correctamente",
    });

    expect(
      screen.getByText("✅ ¡Tu mensaje ha sido enviado con éxito!")
    ).toBeInTheDocument();
  });

  test("CP-Soporte4: Limpia los campos después del envío exitoso", () => {
    render(<SoporteForm usuario={usuarioMock} />);

    const asuntoInput = screen.getByLabelText("Asunto");
    const mensajeInput = screen.getByLabelText("Mensaje");

    fireEvent.change(asuntoInput, { target: { value: "Asunto temporal" } });
    fireEvent.change(mensajeInput, { target: { value: "Mensaje temporal" } });

    fireEvent.click(screen.getByText("Enviar mensaje"));

    expect(asuntoInput.value).toBe("");
    expect(mensajeInput.value).toBe("");
  });

  test("CP-Soporte5: Llama a onActualizar tras enviar mensaje", () => {
    const mockActualizar = vi.fn();
    render(<SoporteForm usuario={usuarioMock} onActualizar={mockActualizar} />);

    fireEvent.change(screen.getByLabelText("Asunto"), {
      target: { value: "Consulta" },
    });
    fireEvent.change(screen.getByLabelText("Mensaje"), {
      target: { value: "¿Cuándo se repondrá el producto?" },
    });

    fireEvent.click(screen.getByText("Enviar mensaje"));
    expect(mockActualizar).toHaveBeenCalledTimes(1);
  });

  test("CP-Soporte6: Permite cambiar el tipo de mensaje", () => {
    render(<SoporteForm usuario={usuarioMock} />);
    const select = screen.getByLabelText("Tipo de Mensaje");

    fireEvent.change(select, { target: { value: "consulta" } });
    expect(select.value).toBe("consulta");
  });
});
