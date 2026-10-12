import { fireEvent, render, screen, within } from "@testing-library/react";
import Card from "./Card"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

// --- Mock de react-router-dom ---
// Necesitamos simular useNavigate para probar la llamada de navegación
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal(); // Obtiene el módulo real
  return {
    ...actual, // Mantiene otras exportaciones como Link (si se usa)
    useNavigate: () => mockNavigate, // Reemplaza useNavigate con nuestro mock
  };
});
// ---------------------------------

describe("Testing Card Component (Lista Productos Destacados)", () => {
  // --- Mocks y Datos de Prueba ---
  const mockProductos = [
    {
      id: "KB001",
      nombre: "Teclado Wooting 60HE",
      imagen: "img/Wooting60HE.png", // -> Badge "Top"
      descripcion: "Descripción Wooting por defecto",
      categoria: "Teclados",
    },
    {
      id: "AC002",
      nombre: "Auriculares HyperX Cloud II",
      imagen: "img/AuricularesHyperXCloudII.png", // -> Badge "Nuevo"
      descripcion: "Descripción Auriculares por defecto",
      categoria: "Accesorios",
    },
    {
      id: "JM001",
      nombre: "Catan",
      imagen: "img/catanJuegoMesa.png", // -> Badge "Juegos de Mesa" (fallback)
      descripcion: "Descripción Catan por defecto",
      categoria: "Juegos de Mesa",
    },
    {
      id: "MS001",
      nombre: "Mouse Logitech",
      imagen: "img/MouseLogitech.png", // -> Badge "Más vendido"
      descripcion: "Descripción Mouse por defecto",
      categoria: "Mouse",
    }
  ];

  // Mock para el mapeo de imágenes (simulando importación)
  const mockImagenesMap = {
    "Wooting60HE.png": "/mock/img/Wooting60HE.png",
    "AuricularesHyperXCloudII.png": "/mock/img/AuricularesHyperXCloudII.png",
    "catanJuegoMesa.png": "/mock/img/catanJuegoMesa.png",
    "MouseLogitech.png": "/mock/img/MouseLogitech.png",
  };

  // Mock para descripciones personalizadas
  const mockDescripciones = {
    KB001: "Descripción personalizada para Wooting",
    // AC002 usará la descripción por defecto de mockProductos
    // JM001 usará la descripción por defecto de mockProductos
  };

  // Limpiar mocks antes de cada prueba
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Caso de Prueba 1: Renderizado General y Número Correcto de Cards ---
  it("CP-CardFeature1: Renderiza el título de la sección y el número correcto de cards", () => {
    render(
      <Card
        productosDestacados={mockProductos}
        imagenesMap={mockImagenesMap}
        descripciones={mockDescripciones}
      />
    );

    // Verifica el título de la sección
    expect(screen.getByRole('heading', { name: /Productos Destacados/i })).toBeInTheDocument();

    // Verifica que se rendericen 4 cards (una por cada producto en mockProductos)
    const botonesVerProducto = screen.getAllByRole('button', { name: /Ver producto/i });
    expect(botonesVerProducto).toHaveLength(mockProductos.length); // Deberían ser 4
  });

  // --- Caso de Prueba 2: Renderizado de Contenido Específico (Nombre, Imagen, Descripción, Badge) ---
  it("CP-CardFeature2: Renderiza correctamente nombre, imagen, descripción y badge de una card específica", () => {
    render(
      <Card
        productosDestacados={mockProductos}
        imagenesMap={mockImagenesMap}
        descripciones={mockDescripciones}
      />
    );

    // Seleccionamos la primera card (Wooting) para verificar su contenido
    const firstCard = screen.getByText("Teclado Wooting 60HE").closest('.card');
    expect(firstCard).toBeInTheDocument(); // Asegura que encontramos la card

    // Dentro de esa card, verificamos los elementos
    const withinCard = within(firstCard); // Limita la búsqueda a esta card

    // Imagen (src y alt)
    const img = withinCard.getByRole('img');
    expect(img).toHaveAttribute('src', mockImagenesMap['Wooting60HE.png']);
    expect(img).toHaveAttribute('alt', 'Teclado Wooting 60HE');

    // Nombre (ya lo usamos para encontrar la card)
    expect(withinCard.getByText('Teclado Wooting 60HE')).toBeInTheDocument();

    // Descripción (debe usar la personalizada de mockDescripciones)
    expect(withinCard.getByText('Descripción personalizada para Wooting')).toBeInTheDocument();

    // Badge (debe ser "Top" para Wooting)
    expect(withinCard.getByText('Top')).toBeInTheDocument();
  });

   // --- Caso de Prueba 3: Lógica Condicional del Badge ---
   it("CP-CardFeature3: Muestra el badge correcto ('Nuevo', 'Más vendido', Categoría) según la imagen", () => {
    render(
      <Card
        productosDestacados={mockProductos}
        imagenesMap={mockImagenesMap}
        descripciones={mockDescripciones}
      />
    );

    // Verifica badge "Nuevo" para Auriculares
    const auricularesCard = screen.getByText("Auriculares HyperX Cloud II").closest('.card');
    expect(within(auricularesCard).getByText('Nuevo')).toBeInTheDocument();

    // Verifica badge "Más vendido" para Mouse
    const mouseCard = screen.getByText("Mouse Logitech").closest('.card');
    expect(within(mouseCard).getByText('Más vendido')).toBeInTheDocument();

    // Verifica badge de categoría para Catan (fallback)
    const catanCard = screen.getByText("Catan").closest('.card');
    expect(within(catanCard).getByText('Juegos de Mesa')).toBeInTheDocument();
  });

  // --- Caso de Prueba 4: Uso de Descripción (Personalizada vs. Default) ---
  it("CP-CardFeature4: Usa la descripción personalizada si existe, si no, usa la del producto", () => {
    render(
      <Card
        productosDestacados={mockProductos}
        imagenesMap={mockImagenesMap}
        descripciones={mockDescripciones}
      />
    );

    // Card Wooting (Usa descripción personalizada)
    const wootingCard = screen.getByText("Teclado Wooting 60HE").closest('.card');
    expect(within(wootingCard).getByText('Descripción personalizada para Wooting')).toBeInTheDocument();

    // Card Auriculares (Usa descripción por defecto del producto)
    const auricularesCard = screen.getByText("Auriculares HyperX Cloud II").closest('.card');
    expect(within(auricularesCard).getByText('Descripción Auriculares por defecto')).toBeInTheDocument();
  });

  // --- Caso de Prueba 5: Evento de Navegación ---
  it("CP-CardFeature5: Llama a navigate con la ruta correcta al hacer clic en 'Ver producto'", () => {
    render(
      <Card
        productosDestacados={mockProductos}
        imagenesMap={mockImagenesMap}
        descripciones={mockDescripciones}
      />
    );

    // Buscamos el botón de la tercera card (Catan)
    const catanCard = screen.getByText("Catan").closest('.card');
    const botonVer = within(catanCard).getByRole('button', { name: /Ver producto/i });

    // Simulamos el clic
    fireEvent.click(botonVer);

    // Verificamos que el mock de navigate fue llamado con la ruta correcta
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(`/detalles/${mockProductos[2].id}`); // ID de Catan
  });

   // --- Caso de Prueba 6: Renderizado sin Productos ---
   it("CP-CardFeature6: Renderiza solo el título si no se pasan productos", () => {
    render(<Card productosDestacados={[]} imagenesMap={{}} descripciones={{}} />);

    // Verifica el título de la sección
    expect(screen.getByRole('heading', { name: /Productos Destacados/i })).toBeInTheDocument();

    // Verifica que NO hay botones "Ver producto"
    expect(screen.queryByRole('button', { name: /Ver producto/i })).not.toBeInTheDocument();
  });
});