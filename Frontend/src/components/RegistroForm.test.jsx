// src/components/RegistroForm.test.jsx
import { render, screen, fireEvent } from "@testing-library/react";
import RegistroForm from "./RegistroForm"; // ruta correcta
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Testing RegistroForm Component", () => {
  let onCloseMock;
  let onUsuarioChangeMock;
  let abrirLoginMock;

  beforeEach(() => {
    onCloseMock = vi.fn();
    onUsuarioChangeMock = vi.fn();
    abrirLoginMock = vi.fn();

    render(
      <RegistroForm
        onClose={onCloseMock}
        onUsuarioChange={onUsuarioChangeMock}
        abrirLogin={abrirLoginMock}
      />
    );
  });

  it("CP-RegistroForm1: Debe renderizar el formulario con todos los campos", () => {
    const form = screen.getByTestId("CP-RegistroForm8");
    expect(form).toBeInTheDocument();

    const campos = [
      "nombre", "apellido", "rut", "email", "password", "fecha", "region", "comuna", "telefono"
    ];
    campos.forEach(campo => {
      expect(screen.getByLabelText(new RegExp(campo, "i"))).toBeInTheDocument();
    });
  });

  it("CP-RegistroForm2: Debe mostrar errores si se intenta enviar vacío", () => {
    const form = screen.getByTestId("CP-RegistroForm8");
    fireEvent.submit(form);

    expect(screen.getByText(/Debes ingresar tu nombre/i)).toBeInTheDocument();
    expect(screen.getByText(/Debes ingresar tu apellido/i)).toBeInTheDocument();
    expect(screen.getByText(/RUT inválido/i)).toBeInTheDocument();
    expect(screen.getByText(/Correo inválido/i)).toBeInTheDocument();
    expect(screen.getByText(/Debes ingresar tu fecha de nacimiento/i)).toBeInTheDocument();
    expect(screen.getByText(/Debes seleccionar una región/i)).toBeInTheDocument();
    expect(screen.getByText(/Debes seleccionar una comuna/i)).toBeInTheDocument();
    expect(screen.getByText(/El numero telefonico debe tener 9 digitos/i)).toBeInTheDocument();
    expect(screen.getByText(/La contraseña debe tener al menos 6 caracteres/i)).toBeInTheDocument();
  });

  it("CP-RegistroForm3: Debe actualizar valores al escribir en los campos", () => {
    const inputNombre = screen.getByLabelText(/nombre/i);
    fireEvent.change(inputNombre, { target: { value: "Juan" } });
    expect(inputNombre.value).toBe("Juan");

    const inputEmail = screen.getByLabelText(/correo/i);
    fireEvent.change(inputEmail, { target: { value: "juan@duoc.cl" } });
    expect(inputEmail.value).toBe("juan@duoc.cl");

    const inputTelefono = screen.getByLabelText(/teléfono/i);
    fireEvent.change(inputTelefono, { target: { value: "987654321" } });
    expect(inputTelefono.value).toBe("987654321");
  });
});
