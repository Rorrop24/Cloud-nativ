import { render, screen } from "@testing-library/react";
import Especificacion from "./Especificacion"; // Ajusta la ruta si es necesario
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";

describe("Testing Especificacion Component", () => {
  // --- Datos de Prueba ---
  const mockDetallesValidos = {
    Marca: "Logitech",
    Sensor: "HERO 25K",
    Conexión: "USB",
  };

  const mockDetallesVacios = {};

  // --- Caso de Prueba 1: Renderizado con Datos Válidos ---
  it("CP-Especificacion1: Renderiza el título y la lista de especificaciones con datos válidos", () => {
    render(<Especificacion detalles={mockDetallesValidos} />);

    // Verifica el título
    expect(screen.getByRole('heading', { name: /Especificaciones/i })).toBeInTheDocument();

    // Verifica que la lista existe
    const list = screen.getByRole('list'); // Busca el <ul>
    expect(list).toBeInTheDocument();
    expect(list).toHaveClass('list-group');

    // Verifica que los items de la lista se rendericen correctamente
    expect(screen.getByText('Marca')).toBeInTheDocument();
    expect(screen.getByText('Logitech')).toBeInTheDocument();
    expect(screen.getByText('Sensor')).toBeInTheDocument();
    expect(screen.getByText('HERO 25K')).toBeInTheDocument();
    expect(screen.getByText('Conexión')).toBeInTheDocument();
    expect(screen.getByText('USB')).toBeInTheDocument();

    // Verifica que hay 3 items en la lista
    const listItems = screen.getAllByRole('listitem'); // Busca los <li>
    expect(listItems).toHaveLength(Object.keys(mockDetallesValidos).length); // Debe ser 3
  });

  // --- Caso de Prueba 2: Renderizado Nulo (Detalles Vacíos) ---
  it("CP-Especificacion2: No renderiza nada si el objeto 'detalles' está vacío", () => {
    // Usamos container para verificar que no se renderiza nada significativo
    const { container } = render(<Especificacion detalles={mockDetallesVacios} />);

    // Verifica que el título NO esté presente
    expect(screen.queryByRole('heading', { name: /Especificaciones/i })).not.toBeInTheDocument();
    // Verifica que la lista NO esté presente
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    // El contenedor principal del componente debería estar vacío o no existir
    // Usamos container.firstChild para ver si hay algún nodo renderizado
    expect(container.firstChild).toBeNull();
  });

  // --- Caso de Prueba 3: Renderizado Nulo (Detalles Null o Undefined) ---
  it("CP-Especificacion3: No renderiza nada si 'detalles' es null o undefined", () => {
    // Prueba con null
    const { container: containerNull } = render(<Especificacion detalles={null} />);
    expect(containerNull.firstChild).toBeNull();

    // Prueba con undefined
    const { container: containerUndefined } = render(<Especificacion detalles={undefined} />);
    expect(containerUndefined.firstChild).toBeNull();
  });

  // --- Caso de Prueba 4: Estructura del Item de Lista ---
  it("CP-Especificacion4: Cada item de la lista contiene un <strong> para la clave y un <span> para el valor", () => {
    render(<Especificacion detalles={mockDetallesValidos} />);

    const listItems = screen.getAllByRole('listitem');

    // Revisamos el primer item como ejemplo
    const firstItem = listItems[0];
    const strongElement = firstItem.querySelector('strong');
    const spanElement = firstItem.querySelector('span');

    expect(strongElement).toBeInTheDocument();
    expect(strongElement).toHaveTextContent('Marca'); // Clave del primer item
    expect(spanElement).toBeInTheDocument();
    expect(spanElement).toHaveTextContent('Logitech'); // Valor del primer item
    // Verifica clases de Bootstrap para el layout flex
    expect(firstItem).toHaveClass('d-flex justify-content-between');
  });

});