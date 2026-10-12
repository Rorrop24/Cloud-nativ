import { fireEvent, render, screen } from "@testing-library/react";
import EventoCard from "./EventoCard"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

describe("Testing EventoCard Component", () => {
  // --- Mocks y Datos de Prueba ---
  const mockOnClick = vi.fn(); // Mock para la función de clic
  const mockCoordenadas = { lat: -33.456, lng: -70.678 }; // Coordenadas de ejemplo
  const mockPropsBase = {
    titulo: "Torneo de Verano",
    fecha: "2025-12-15",
    lugar: "Centro de Eventos Santiago",
    coordenadas: mockCoordenadas,
    onClick: mockOnClick,
    imagen: "/img/evento-verano.jpg", // Imagen incluida por defecto
  };

  // Limpiar mocks antes de cada prueba
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Caso de Prueba 1: Renderizado Completo con Imagen ---
  it("CP-EventoCard1: Renderiza correctamente título, fecha, lugar e imagen", () => {
    render(<EventoCard {...mockPropsBase} />);

    // Verifica textos
    expect(screen.getByText(mockPropsBase.titulo)).toBeInTheDocument();
    expect(screen.getByText(mockPropsBase.fecha)).toBeInTheDocument();
    expect(screen.getByText(mockPropsBase.lugar)).toBeInTheDocument();

    // Verifica imagen
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockPropsBase.imagen);
    expect(img).toHaveAttribute('alt', mockPropsBase.titulo);

    // Verifica iconos (buscando por clase)
    const cardBody = screen.getByText(mockPropsBase.titulo).closest('.card-body');
    expect(cardBody.querySelector('i.bi.bi-calendar-event')).toBeInTheDocument();
    expect(cardBody.querySelector('i.bi.bi-geo-alt')).toBeInTheDocument();
  });

  // --- Caso de Prueba 2: Renderizado sin Imagen (Condicional) ---
  it("CP-EventoCard2: Renderiza correctamente sin la imagen si no se proporciona la prop 'imagen'", () => {
    // Creamos props sin la imagen
    const propsSinImagen = { ...mockPropsBase, imagen: undefined };
    render(<EventoCard {...propsSinImagen} />);

    // Verifica textos (igual que antes)
    expect(screen.getByText(mockPropsBase.titulo)).toBeInTheDocument();
    expect(screen.getByText(mockPropsBase.fecha)).toBeInTheDocument();
    expect(screen.getByText(mockPropsBase.lugar)).toBeInTheDocument();

    // Verifica que la imagen NO se renderiza
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // --- Caso de Prueba 3: Evento onClick ---
  it("CP-EventoCard3: Llama a la función onClick con las coordenadas correctas al hacer clic en la tarjeta", () => {
    render(<EventoCard {...mockPropsBase} />);

    // Buscamos el div principal de la card (el que tiene el onClick)
    // Usamos el título para encontrar un elemento dentro y luego subimos al padre .card
    const cardDiv = screen.getByText(mockPropsBase.titulo).closest('.evento-card');
    expect(cardDiv).toBeInTheDocument(); // Asegura que encontramos el div correcto

    // Simulamos el clic en la tarjeta
    fireEvent.click(cardDiv);

    // Verificamos que la función mockOnClick fue llamada una vez
    expect(mockOnClick).toHaveBeenCalledTimes(1);
    // Verificamos que fue llamada con las coordenadas correctas
    expect(mockOnClick).toHaveBeenCalledWith(mockCoordenadas);
  });

   // --- Caso de Prueba 4: No falla si onClick no se pasa (Opcional) ---
   it("CP-EventoCard4: No causa error si la prop onClick no se proporciona", () => {
    // Renderizamos sin la prop onClick
    const propsSinOnClick = { ...mockPropsBase, onClick: undefined };

    // Usamos una función para capturar si render lanza un error
    const renderComponent = () => render(<EventoCard {...propsSinOnClick} />);

    // Verificamos que el renderizado no lanza errores
    expect(renderComponent).not.toThrow();

    // Verificamos que el contenido básico se renderiza
    expect(screen.getByText(mockPropsBase.titulo)).toBeInTheDocument();

    // Intentamos hacer clic (no debería hacer nada ni fallar)
    const cardDiv = screen.getByText(mockPropsBase.titulo).closest('.evento-card');
    fireEvent.click(cardDiv);
    // No podemos verificar que 'mockOnClick' no fue llamado porque no existe
  });
});