import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function HistorialAdmin() {
  const navigate = useNavigate();
  const [compras, setCompras] = useState([]);

  useEffect(() => {
    // Cargar historial completo desde localStorage
    const historialLS = JSON.parse(localStorage.getItem("historialCompras") || "[]");
    setCompras(historialLS.reverse()); // más recientes primero
  }, []);

  if (compras.length === 0) {
    return (
      <div className="container py-5 text-center">
        <h2>Historial de compras</h2>
        <p className="text-muted">Aún no hay compras registradas.</p>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h2 className="mb-4">Historial de compras - Admin</h2>
      <div className="d-flex flex-column gap-3">
        {compras.map(compra => (
          <div
            key={compra.idTransaccion}
            className="card shadow-lg border-0 p-3"
            style={{ backgroundColor: "#1e1e1e", color: "#fff" }}
          >
            <div className="d-flex justify-content-between mb-2">
              <div>
                <strong>ID Transacción:</strong> {compra.idTransaccion}
              </div>
              <div className="text-end">
                <span className="text-muted" style={{ fontSize: "0.9rem" }}>
                  {new Date(compra.fechaCompra).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mb-2">
              <strong>Usuario:</strong> {compra.usuarioNombreCompleto}
            </div>

            <div className="mb-2">
              <strong>Productos:</strong>
              <ul className="list-unstyled mb-0" style={{ paddingLeft: 0 }}>
                {compra.productosComprados.map(item => (
                  <li
                    key={item.idProducto}
                    className="d-flex justify-content-between py-1"
                    style={{ borderBottom: "1px solid #333" }}
                  >
                    <span>{item.nombreProducto} × {item.cantidad}</span>
                    <span>${item.subtotal.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="d-flex justify-content-between mt-2 fw-bold">
              <span>Total:</span>
              <span>${compra.totalOrden.toLocaleString()}</span>
            </div>

            <div className="text-end mt-3">
              <button
                className="btn btn-success"
                onClick={() => {
                  localStorage.setItem("ultimaBoleta", JSON.stringify({
                    idTransaccion: compra.idTransaccion,
                    fecha: compra.fechaCompra,
                    totalPrecio: compra.totalOrden,
                    items: compra.productosComprados.map(p => ({
                      id: p.idProducto,
                      nombre: p.nombreProducto,
                      precioUnitario: p.precioUnitario,
                      cantidad: p.cantidad,
                      subtotal: p.subtotal
                    })),
                    estado: "EXITOSA"
                  }));
                  navigate("/boleta");
                }}
              >
                Ver Boleta
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HistorialAdmin;
