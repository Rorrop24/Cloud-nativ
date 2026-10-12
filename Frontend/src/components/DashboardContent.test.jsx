import { fireEvent, render, screen, within } from "@testing-library/react";
import DashboardContent from "./DashboardContent"; // Ajusta la ruta si es necesario
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom"; // Necesario para testear <Link>


vi.mock('../data/productos.json', () => ({ 
  default: {
    productos: [
      { id: "P1", categoria: "CatA", nombre: "Producto 1", precio: 10000, stock: 8, stockCritico: 5, rating: 4 },
      { id: "P2", categoria: "CatB", nombre: "Producto 2", precio: 25000, stock: 3, stockCritico: 5, rating: 5 }, // Crítico
      { id: "P3", categoria: "CatA", nombre: "Producto 3", precio: 5000, stock: 15, stockCritico: 10, rating: 3 },
    ]
  }
}));
vi.mock('../data/usuarios.json', () => ({ 
  default: [ // Asumimos que usuarios.json es un array
    { id: "U1", nombre: "User A" },
    { id: "U2", nombre: "User B" },
  ]
}));
// ----------------------------
// ... (resto del test sin cambios) ...
vi.mock('../data/productos.json', () => ({ default: mockProductosD }));
vi.mock('../data/usuarios.json', () => ({ default: mockUsuariosD }));
// ----------------------------

// --- Mock de Componentes Hijos ---
// Mockeamos StockNotification para aislar el test
vi.mock('./SidebarAdmin', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual, // Mantenemos otros exports si existen
        StockNotification: vi.fn(({ products }) => (
            <div data-testid="stock-notification-mock">
                Productos Críticos: {products.length}
            </div>
        )),
    };
});

// Mockeamos Footer (si existe y es relevante)
// vi.mock('./Footer', () => ({ default: () => <div data-testid="footer-mock">Footer</div> }));
// --------------------------------

describe("Testing DashboardContent Component", () => {

  // Limpiar mocks antes de cada prueba
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Wrapper con MemoryRouter para que funcionen los <Link>
  const renderWithRouter = (ui, { route = '/' } = {}) => {
    window.history.pushState({}, 'Test page', route)
    return render(ui, { wrapper: MemoryRouter })
  }

  // --- Caso de Prueba 1: Renderizado Inicial y Títulos ---
  it("CP-Dashboard1: Renderiza títulos, notificación y las secciones de tarjetas", () => {
    renderWithRouter(<DashboardContent />);

    // Verifica títulos
    expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/Resumen de las actividades diarias/i)).toBeInTheDocument();

    // Verifica que el mock de StockNotification se renderizó
    expect(screen.getByTestId('stock-notification-mock')).toBeInTheDocument();

    // Verifica la presencia de al menos una tarjeta de métrica y una de feature
    expect(screen.getByText(/Compras/i)).toBeInTheDocument(); // Título de MetricCard
    expect(screen.getByText(/Visión general de todas las métricas/i)).toBeInTheDocument(); // Desc de FeatureCard
  });

  // --- Caso de Prueba 2: Cálculo y Muestra de Métricas ---
  it("CP-Dashboard2: Muestra correctamente las métricas calculadas (Productos, Inventario, Usuarios)", () => {
    renderWithRouter(<DashboardContent />);

    // Productos: Debe mostrar 3 (longitud de mockProductosD.productos)
    // El valor está dentro de un <h2>, lo buscamos así
    const productosCard = screen.getByText('PRODUCTOS').closest('.card'); // Encuentra la card de Productos
    expect(within(productosCard).getByRole('heading', { level: 2, name: '3' })).toBeInTheDocument();
    // Verifica detalle de inventario (8 + 3 + 15 = 26)
    expect(within(productosCard).getByText(/Inventario actual: 26/i)).toBeInTheDocument();

    // Usuarios: Debe mostrar 2 (longitud de mockUsuariosD)
    const usuariosCard = screen.getByText('USUARIOS').closest('.card');
    expect(within(usuariosCard).getByRole('heading', { level: 2, name: '2' })).toBeInTheDocument();
    // Verifica detalle de nuevos usuarios (hardcoded a 120)
    expect(within(usuariosCard).getByText(/Nuevos usuarios este mes: 120/i)).toBeInTheDocument();

    // Compras (hardcoded)
    const comprasCard = screen.getByText('COMPRAS').closest('.card');
    expect(within(comprasCard).getByRole('heading', { level: 2, name: '1,234' })).toBeInTheDocument();
  });

  // --- Caso de Prueba 3: Notificación de Stock Crítico ---
  it("CP-Dashboard3: Pasa el número correcto de productos críticos a StockNotification", () => {
    renderWithRouter(<DashboardContent />);

    // En nuestro mock, solo P2 tiene stock (3) <= stockCritico (5)
    // El mock de StockNotification muestra "Productos Críticos: {products.length}"
    expect(screen.getByTestId('stock-notification-mock')).toHaveTextContent('Productos Críticos: 1');
  });

  // --- Caso de Prueba 4: Renderizado de Tarjetas Feature ---
  it("CP-Dashboard4: Renderiza todas las tarjetas Feature (Top y Bottom) con sus datos", () => {
    renderWithRouter(<DashboardContent />);

    // Verifica algunas tarjetas de ejemplo
    // Top
    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/homeadmin');
    expect(screen.getByText('Órdenes').closest('a')).toHaveAttribute('href', '/ordenes'); // Ajusta según tus rutas reales
    expect(screen.getByText('Productos').closest('a')).toHaveAttribute('href', '/productosadmin');
    expect(screen.getByText('Categorías').closest('a')).toHaveAttribute('href', '/categoria_admin'); // Ajusta según tus rutas reales

    // Bottom
    expect(screen.getByText('Usuarios').closest('a')).toHaveAttribute('href', '/usuariosadmin');
    expect(screen.getByText('Reportes').closest('a')).toHaveAttribute('href', '/reporte'); // Ajusta según tus rutas reales
    expect(screen.getByText('Perfil').closest('a')).toHaveAttribute('href', '/perfiladmin');
    expect(screen.getByText('Tienda').closest('a')).toHaveAttribute('href', '/');

    // Verifica que haya 8 FeatureCards en total (4 top + 4 bottom)
    // Contamos los links que contienen un ícono (asumiendo que todas las FeatureCard lo tienen)
    const featureLinks = screen.getAllByRole('link', { name: /.+/i }); // Busca links con cualquier texto
    // Filtramos para asegurarnos que son las cards (pueden haber otros links)
    const featureCards = featureLinks.filter(link => link.querySelector('i.fas'));
    expect(featureCards).toHaveLength(8);
  });

  // --- Caso de Prueba 5: Hover en FeatureCard (Opcional pero bueno) ---
  it("CP-Dashboard5: Aplica el estilo de hover (boxShadow) en FeatureCard", () => {
    renderWithRouter(<DashboardContent />);

    // Seleccionamos una FeatureCard, por ejemplo, la de "Productos"
    const productosFeatureLink = screen.getByText('Productos').closest('a');
    const productosFeatureCardDiv = productosFeatureLink.querySelector('.card'); // El div interno

    expect(productosFeatureCardDiv).not.toHaveStyle(`box-shadow: 0 0 10px ${GREEN_LIGHT}`);

    // Simular hover
    fireEvent.mouseEnter(productosFeatureCardDiv);
    expect(productosFeatureCardDiv).toHaveStyle(`box-shadow: 0 0 10px ${GREEN_LIGHT}`);

    // Simular fin de hover
    fireEvent.mouseLeave(productosFeatureCardDiv);
    expect(productosFeatureCardDiv).not.toHaveStyle(`box-shadow: 0 0 10px ${GREEN_LIGHT}`);
  });

});