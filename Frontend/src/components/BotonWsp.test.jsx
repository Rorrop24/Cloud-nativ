import { render, screen } from "@testing-library/react";
import BotonWsp from "./BotonWsp"; // Asegúrate que la ruta sea correcta
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";

describe("Testing BotonWsp Component", () => {

  // --- Caso de Prueba 1: Renderizado Correcto del Enlace ---
  it("CP-BotonWsp1: Debe renderizar el enlace (botón) de WhatsApp", () => {
    render(<BotonWsp />);

    // Buscamos el elemento por su rol de enlace ('link')
    const linkElement = screen.getByRole("link");
    expect(linkElement).toBeInTheDocument();
  });

  // --- Caso de Prueba 2: Verificación de Atributos del Enlace ---
  it("CP-BotonWsp2: El enlace debe tener los atributos href, target y rel correctos", () => {
    render(<BotonWsp />);

    const linkElement = screen.getByRole("link");

    // Verifica el atributo href
    expect(linkElement).toHaveAttribute("href", "https://wa.me/56912345678");
    // Verifica el atributo target
    expect(linkElement).toHaveAttribute("target", "_blank");
    // Verifica el atributo rel
    expect(linkElement).toHaveAttribute("rel", "noopener noreferrer");
  });

  // --- Caso de Prueba 3: Verificación del Ícono ---
  it("CP-BotonWsp3: Debe contener el ícono de WhatsApp (bi-whatsapp)", () => {
    const { container } = render(<BotonWsp />); // Usamos container para buscar por selector CSS

    // Buscamos el elemento <i> con la clase específica de Bootstrap Icons
    const iconElement = container.querySelector("i.bi.bi-whatsapp");
    expect(iconElement).toBeInTheDocument();
  });

  // --- Caso de Prueba 4: Verifica la presencia de estilos inline (Opcional) ---
  // Nota: Testear estilos exactos puede ser frágil, pero podemos verificar que el style exista.
   it("CP-BotonWsp4: El enlace debe tener estilos inline aplicados", () => {
    render(<BotonWsp />);
    const linkElement = screen.getByRole("link");
    expect(linkElement).toHaveAttribute('style'); // Verifica que el atributo 'style' exista
    // Podrías ser más específico, pero es menos robusto:
    // expect(linkElement).toHaveStyle('position: fixed');
    // expect(linkElement).toHaveStyle('background-color: rgb(37, 211, 102)'); // #25D366 en RGB
  });

});