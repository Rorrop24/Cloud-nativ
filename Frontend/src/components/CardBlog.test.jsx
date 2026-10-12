import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CardBlog from "./CardBlog"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

// --- Mock Global de window.bootstrap.Modal ---
// Simulamos la clase Modal de Bootstrap y sus métodos
const mockModalInstance = {
  show: vi.fn(),
  hide: vi.fn(), // Añadimos hide por si acaso
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
window.bootstrap = {
  // @ts-ignore // Ignoramos error de tipo si usas TS
  Modal: vi.fn(() => mockModalInstance),
};
// ---------------------------------------------

// --- Mock Global de APIs del Navegador ---
// Guardamos las implementaciones originales para restaurarlas si es necesario


// Mock para navigator.share
navigator.share = vi.fn(() => Promise.resolve()); // Simula éxito

// Mock para navigator.clipboard
// @ts-ignore
navigator.clipboard = {
  writeText: vi.fn(() => Promise.resolve()), // Simula éxito al copiar
};
// ----------------------------------------


describe("Testing CardBlog Component", () => {
  // --- Mocks y Datos de Prueba ---
  const mockProps = {
    titulo: "Título del Blog Post",
    categoria: "Noticias",
    imagenSrc: "/img/blog-image.jpg",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Ejemplo
    descripcion: "Esta es una descripción corta del blog post o video.",
  };

  // Limpiar mocks antes de cada prueba
  beforeEach(() => {
    vi.clearAllMocks();
    // Reseteamos el estado interno del mock de Modal si es necesario
    mockModalInstance.addEventListener.mockClear();
    mockModalInstance.removeEventListener.mockClear();
  });

  // --- Caso de Prueba 1: Renderizado Inicial de la Card ---
  it("CP-CardBlog1: Renderiza la tarjeta con título, categoría, imagen y descripción", () => {
    render(<CardBlog {...mockProps} />);

    // Verifica elementos visibles en la card
    expect(screen.getByText(mockProps.titulo)).toBeInTheDocument();
    expect(screen.getByText(mockProps.categoria)).toBeInTheDocument(); // El badge
    expect(screen.getByText(mockProps.descripcion)).toBeInTheDocument();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', mockProps.imagenSrc);
    expect(img).toHaveAttribute('alt', mockProps.titulo);
    expect(screen.getByRole('button', { name: /Ver/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compartir/i })).toBeInTheDocument();
  });

  // --- Caso de Prueba 2: Abrir Modal de Video ---
  it("CP-CardBlog2: Abre el modal de video al hacer clic en 'Ver'", () => {
    render(<CardBlog {...mockProps} />);
    const botonVer = screen.getByRole('button', { name: /Ver/i });

    fireEvent.click(botonVer);

    // Verifica que se instanció el Modal de Bootstrap
    expect(window.bootstrap.Modal).toHaveBeenCalledTimes(1);
    // Verifica que se llamó al método show() del modal
    expect(mockModalInstance.show).toHaveBeenCalledTimes(1);

    // Verifica (indirectamente) que el contenido del modal de video está presente
    // Buscamos el iframe por su título
    expect(screen.getByTitle(mockProps.titulo)).toBeInTheDocument();
    expect(screen.getByTitle(mockProps.titulo)).toHaveAttribute('src', mockProps.videoUrl);
  });

  // --- Caso de Prueba 3: Compartir usando navigator.share (si existe) ---
  it("CP-CardBlog3: Llama a navigator.share con los datos correctos al hacer clic en 'Compartir'", async () => {
    // Aseguramos que navigator.share esté definido para esta prueba
    navigator.share = vi.fn(() => Promise.resolve());

    render(<CardBlog {...mockProps} />);
    const botonCompartir = screen.getByRole('button', { name: /Compartir/i });

    fireEvent.click(botonCompartir);

    // Espera a que la promesa (si la hubiera) se resuelva
    await waitFor(() => {
        expect(navigator.share).toHaveBeenCalledTimes(1);
        expect(navigator.share).toHaveBeenCalledWith({
          titulo: mockProps.titulo,
          texto: expect.stringContaining(mockProps.titulo), // Verifica que el texto contenga el título
          url: mockProps.videoUrl,
        });
    });

    // Verifica que NO se intentó abrir el modal de Bootstrap
    expect(window.bootstrap.Modal).not.toHaveBeenCalled();
  });

  // --- Caso de Prueba 4: Compartir usando Modal (si navigator.share no existe) ---
  it("CP-CardBlog4: Abre el modal de compartir si navigator.share no está disponible", () => {
    // Simulamos que navigator.share no existe
    // @ts-ignore
    navigator.share = undefined;

    render(<CardBlog {...mockProps} />);
    const botonCompartir = screen.getByRole('button', { name: /Compartir/i });

    fireEvent.click(botonCompartir);

    // Verifica que NO se llamó a navigator.share
    // expect(navigator.share).not.toHaveBeenCalled(); // No se puede verificar si es undefined

    // Verifica que se intentó abrir el modal de Bootstrap
    expect(window.bootstrap.Modal).toHaveBeenCalledTimes(1);
    expect(mockModalInstance.show).toHaveBeenCalledTimes(1);

    // Verifica que los enlaces del modal se actualizaron (ejemplo con WhatsApp)
    // Usamos querySelector porque los refs no son accesibles directamente
    const linkWhatsapp = screen.getByRole('link', { name: /WhatsApp/i });
    expect(linkWhatsapp).toHaveAttribute('href', expect.stringContaining('https://wa.me/'));
    expect(linkWhatsapp).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(mockProps.titulo)));
  });

   // --- Caso de Prueba 5: Copiar Enlace en Modal de Compartir ---
   it("CP-CardBlog5: Llama a clipboard.writeText y actualiza botón al copiar enlace", async () => {
    // Simulamos que navigator.share no existe para forzar el modal
    // @ts-ignore
    navigator.share = undefined;
    // Aseguramos que clipboard esté definido
    // @ts-ignore
    navigator.clipboard = { writeText: vi.fn(() => Promise.resolve()) };

    render(<CardBlog {...mockProps} />);
    const botonCompartir = screen.getByRole('button', { name: /Compartir/i });

    // Abrir modal de compartir
    fireEvent.click(botonCompartir);
    expect(window.bootstrap.Modal).toHaveBeenCalledTimes(1); // Asegura que el modal se intenta abrir

    // Buscar el botón Copiar enlace (puede que no sea visible hasta que el modal esté 'abierto', pero lo intentamos)
    // Usamos queryByRole porque puede no estar visible inmediatamente si hay animaciones
    const botonCopiar = screen.getByRole('button', { name: /Copiar enlace/i });
    expect(botonCopiar).toBeInTheDocument(); // Asegura que el botón existe

    // Simular clic en copiar
    fireEvent.click(botonCopiar);

    // Esperar a que las promesas se resuelvan
    await waitFor(() => {
        // Verifica que se llamó a writeText
        expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(mockProps.videoUrl));

        // Verifica que el texto del botón cambió a "Copiado"
        expect(botonCopiar).toHaveTextContent(/Copiado/i);
    });

    // Esperar a que el texto vuelva a la normalidad después del timeout (1500ms)
    // Usamos fake timers para controlar el setTimeout
    vi.useFakeTimers();
    vi.advanceTimersByTime(1600); // Avanza el tiempo más allá de 1500ms

    await waitFor(() => {
        // Verifica que el texto del botón volvió a "Copiar enlace"
        expect(botonCopiar).toHaveTextContent(/Copiar enlace/i);
    });
    vi.useRealTimers(); // Restaurar timers reales
  });

  // --- Caso de Prueba 6: useEffect para limpiar video ---
  it("CP-CardBlog6: Añade y elimina listener para 'hidden.bs.modal' en el modal de video", () => {
    const { unmount } = render(<CardBlog {...mockProps} />);

    // Verifica que addEventListener fue llamado al montar (para el modal de video)
    expect(mockModalInstance.addEventListener).toHaveBeenCalledWith('hidden.bs.modal', expect.any(Function));

    // Simula desmontar el componente
    unmount();

    // Verifica que removeEventListener fue llamado al desmontar
    expect(mockModalInstance.removeEventListener).toHaveBeenCalledWith('hidden.bs.modal', expect.any(Function));
  });

});