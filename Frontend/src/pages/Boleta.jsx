import { useNavigate } from "react-router-dom";

function Boleta() {
  const navigate = useNavigate();
  const ultimaBoleta = JSON.parse(localStorage.getItem("ultimaBoleta") || "null");

  if (!ultimaBoleta) {
    return (
      <div className="py-5 text-center" style={{ backgroundColor: "#121212", minHeight: "100vh", color: "#fff" }}>
        <h2 className="mb-4">Boleta</h2>
        <p className="text-muted">No hay una compra reciente.</p>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Ir al inicio
        </button>
      </div>
    );
  }

  const IVA = 0.19;
  const totalConIVA = Math.round(ultimaBoleta.totalPrecio * (1 + IVA));

  return (
    <div style={{ backgroundColor: "#121212", minHeight: "100vh", padding: "50px 0", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", color: "#fff" }}>
        <div style={{ borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#1e1e1e" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <img src="/logo.png" alt="Punto Gamer" style={{ width: 100, height: 50, objectFit: "contain" }} />
              <div>
                <h3 style={{ margin: 0 }}>Punto Gamer</h3>
                <small style={{ color: "#aaa" }}>Fecha: {new Date(ultimaBoleta.fecha).toLocaleString()}</small>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <strong>ID Transacción</strong>
              <div style={{ color: "#aaa" }}>{ultimaBoleta.idTransaccionPayPal || ultimaBoleta.idTransaccion}</div>
              {ultimaBoleta.estado && (
                <div style={{ marginTop: 5, fontWeight: "bold", color: ultimaBoleta.estado === "EXITOSA" ? "#4CAF50" : "#F44336" }}>
                  {ultimaBoleta.estado}
                </div>
              )}
            </div>
          </div>

          {/* Productos */}
          <div style={{ backgroundColor: "#2a2a2a", padding: 20 }}>
            {ultimaBoleta.items.map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #444" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                  <img
                    src={item.imagen.startsWith("/") ? item.imagen : `/${item.imagen}`}
                    alt={item.nombre}
                    style={{ width: 70, height: 70, objectFit: "contain", borderRadius: 5 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.nombre}</div>
                    <div style={{ fontSize: "0.9rem", color: "#ccc" }}>
                      {item.cantidad} × ${item.precioUnitario.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 600 }}>${item.subtotal.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Resumen */}
          <div style={{ backgroundColor: "#1e1e1e", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span>Subtotal:</span>
              <strong>${ultimaBoleta.totalPrecio.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span>IVA (19%):</span>
              <strong>${Math.round(ultimaBoleta.totalPrecio * IVA).toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid #444", fontSize: "1.1rem" }}>
              <span>Total:</span>
              <strong>${totalConIVA.toLocaleString()}</strong>
            </div>
          </div>

          {/* Botón Finalizar */}
          <div style={{ padding: 20, textAlign: "center", backgroundColor: "#1e1e1e" }}>
            <button
              className="btn btn-success w-50 btn-neon-accent"
              onClick={() => navigate("/perfil", { state: { nuevaBoleta: ultimaBoleta } })}
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Boleta;
