import { useNavigate } from "react-router-dom";

// Helper para resolver la URL de la imagen
const resolverImagen = (img) => {
  if (!img) return "/placeholder.png";
  if (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("data:")) {
    return img;
  }
  return img.startsWith("/") ? img : `/${img}`;
};

function CarritoSidebar({ abierto, cerrar, carrito = [], onActualizarCantidad, onEliminarItem }) {
  const navigate = useNavigate();

  // Normalizar items del carrito, agregando productoId para consistencia
  const carritoNormalizado = carrito.map((p) => ({
    id: p.id,
    productoId: p.productoId ?? p.id,
    nombre: p.nombre || p.producto?.nombre || "Desconocido",
    precio: p.precio ?? p.producto?.precio ?? 0,
    descuento: p.descuento ?? p.producto?.descuento ?? 0,
    stock: p.stock ?? p.producto?.stock ?? 0,
    cantidad: p.cantidad ?? 0,
    imagen: p.imagen || p.producto?.imagen || "/placeholder.png",
  }));

  const totalProductos = carritoNormalizado.reduce((acc, p) => acc + p.cantidad, 0);
  const totalPrecio = carritoNormalizado.reduce((acc, p) => {
    const precioFinal = p.descuento
      ? Math.round(p.precio * (1 - p.descuento / 100))
      : p.precio;
    return acc + p.cantidad * precioFinal;
  }, 0);

  if (!abierto) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="carrito-overlay"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0,0,0,0.4)",
          zIndex: 1050,
        }}
        onClick={cerrar}
      />

      {/* Sidebar */}
      <div
        className="carrito-sidebar open"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "350px",
          zIndex: 1051,
          backgroundColor: "#111",
          boxShadow: "-2px 0 5px rgba(0,0,0,0.5)",
          overflowY: "auto",
          padding: "1rem",
          transition: "transform 0.3s ease",
          transform: abierto ? "translateX(0)" : "translateX(100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5>Carrito</h5>
          <button className="btn btn-light btn-sm" onClick={cerrar}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {carritoNormalizado.length === 0 ? (
          <p>Tu carrito está vacío</p>
        ) : (
          <>
            {carritoNormalizado.map((p) => {
              const precioFinal = p.descuento
                ? Math.round(p.precio * (1 - p.descuento / 100))
                : p.precio;

              const stockMax = p.stock;

              return (
                <div key={p.productoId || p.id} className="d-flex align-items-center justify-content-between mb-3">
                  <img
                    src={resolverImagen(p.imagen)}
                    alt={p.nombre}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://placehold.co/50x50?text=IMG";
                    }}
                    style={{ width: 50, height: 50, objectFit: "contain", marginRight: 10, borderRadius: 4 }}
                  />
                  <div className="flex-grow-1">
                    <span>{p.nombre}</span>
                    <div className="d-flex align-items-center mt-1 gap-2">
                      <button
                        className="btn btn-sm btn-outline-light"
                        onClick={() => onActualizarCantidad(p.productoId, p.cantidad - 1)}
                      >
                        -
                      </button>
                      <span>{p.cantidad}</span>
                      <button
                        className="btn btn-sm btn-outline-light"
                        onClick={() => onActualizarCantidad(p.productoId, p.cantidad + 1)}
                        disabled={stockMax > 0 && p.cantidad >= stockMax}
                      >
                        +
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => onEliminarItem(p.productoId)}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <span>${(precioFinal * p.cantidad).toLocaleString()}</span>
                </div>
              );
            })}

            <hr />
            <p>Total productos: {totalProductos}</p>
            <p>Total precio: ${totalPrecio.toLocaleString()}</p>

            <button
              className="btn btn-success w-100 mt-2"
              onClick={() => {
                cerrar();
                navigate("/carro");
              }}
            >
              Ver Carrito
            </button>
          </>
        )}
      </div>
    </>
  );
}

export default CarritoSidebar;