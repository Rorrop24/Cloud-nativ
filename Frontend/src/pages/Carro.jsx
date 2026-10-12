import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

function Carro({ carrito, usuario }) {
  const navigate = useNavigate();

  const totalProductos = carrito.reduce((acc, p) => acc + p.cantidad, 0);
  const totalPrecio = carrito.reduce((acc, p) => {
    const precioFinal = p.descuento
      ? Math.round(p.precio * (1 - p.descuento / 100))
      : p.precio;
    return acc + p.cantidad * precioFinal;
  }, 0);

  return (
    <>
      <div className="container py-4">
        <h2 className="mb-4 text-center">Resumen de tu carrito</h2>

        {carrito.length === 0 ? (
          <p className="text-center text-muted">Tu carrito está vacío</p>
        ) : (
          <>
            <div className="row g-3 mb-4">
              {carrito.map((p) => {
                const precioFinal = p.descuento
                  ? Math.round(p.precio * (1 - p.descuento / 100))
                  : p.precio;

                return (
                  <div
                    key={p.id}
                    className="col-12 d-flex align-items-center border rounded p-3 shadow-sm bg-dark text-light"
                    style={{ transition: "all 0.2s", cursor: "pointer" }}
                  >
                    <img
                      src={p.imagen}
                      alt={p.nombre}
                      style={{
                        width: 80,
                        height: 80,
                        objectFit: "contain",
                        marginRight: 15,
                        borderRadius: "8px",
                        backgroundColor: "#222",
                        padding: "5px",
                      }}
                    />
                    <div className="flex-grow-1">
                      <strong className="d-block mb-1">{p.nombre}</strong>

                      {/* Precio con descuento o normal */}
                      <div className="mb-1 d-flex align-items-center gap-2">
                        {p.descuento > 0 && (
                          <>
                            <small className="text-decoration-line-through text-muted">
                              ${p.precio.toLocaleString()}
                            </small>
                            <span className="text-success fw-bold">
                              ${precioFinal.toLocaleString()}
                            </span>
                            <span className="badge bg-danger">{p.descuento}% OFF</span>
                          </>
                        )}
                        {p.descuento === 0 && (
                          <span className="fw-bold">${precioFinal.toLocaleString()}</span>
                        )}
                      </div>

                      <span className="badge bg-primary rounded-pill">x{p.cantidad}</span>
                    </div>
                    <span className="fw-bold ms-3">${(precioFinal * p.cantidad).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-top pt-3 mb-4">
              <p>Total productos: <strong>{totalProductos}</strong></p>
              <p>Total precio: <strong>${totalPrecio.toLocaleString()}</strong></p>
            </div>

            {usuario && (
              <div className="mb-4 p-3 border rounded bg-dark text-light">
                <h4>Datos personales</h4>
                <p><strong>Nombre:</strong> {usuario.nombre}</p>
                <p><strong>Email:</strong> {usuario.email}</p>
                {usuario.telefono && <p><strong>Teléfono:</strong> {usuario.telefono}</p>}
                {usuario.direccion && <p><strong>Dirección:</strong> {usuario.direccion}</p>}
              </div>
            )}

            <button
              className="btn btn-success w-100 btn-lg"
              onClick={() => navigate("/checkout")}
            >
              Continuar a Checkout
            </button>
          </>
        )}
      </div>
      <Footer />
    </>
  );
}

export default Carro;
