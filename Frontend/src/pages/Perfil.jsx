import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

export default function Perfil() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [boletas, setBoletas] = useState([]);
  const [resenias, setResenias] = useState([]);
  const [incidencias, setIncidencias] = useState([]);
  const [error, setError] = useState(null);
  const [alerta, setAlerta] = useState(null);

  useEffect(() => {
    const cargarUsuario = () => {
      const usuarioActivo =
        JSON.parse(localStorage.getItem("usuario")) ||
        JSON.parse(localStorage.getItem("usuarioActual"));
      if (!usuarioActivo) {
        setError("No hay una sesión activa. Inicia sesión para ver tu perfil.");
        return;
      }
      setUsuario(usuarioActivo);

      const todasBoletas = JSON.parse(localStorage.getItem("boletas")) || [];
      setBoletas(todasBoletas.filter(b => b.email === usuarioActivo.email));

      const todasResenias = JSON.parse(localStorage.getItem("resenias")) || [];
      const filtradas = todasResenias.filter(r => r.email === usuarioActivo.email);
      const únicas = filtradas.filter((r, index, arr) => {
        return arr.findIndex(item => item.fecha === r.fecha && item.productoId === r.productoId) === index;
      });
      setResenias(únicas);

      const todosSoportes = JSON.parse(localStorage.getItem("mensajesSoporte")) || {};
      setIncidencias(todosSoportes[usuarioActivo.email] || []);
    };

    cargarUsuario();

    // Escuchar cambios en el usuario desde otros componentes (Navbar)
    window.addEventListener("usuarioCambiado", cargarUsuario);
    return () => window.removeEventListener("usuarioCambiado", cargarUsuario);
  }, []);

  if (error) {
    return (
      <div className="text-center py-5 text-white">
        <h4>{error}</h4>
        <button className="btn btn-primary mt-3" onClick={() => navigate("/auth")}>
          Ir a iniciar sesión
        </button>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="text-center py-5 text-white">
        <h4>Cargando perfil...</h4>
      </div>
    );
  }

  return (
    <>
      <div className="container py-5" style={{ color: "#fff" }}>
        {/* Datos del usuario */}
        <div className="card shadow-lg border-0 p-4 mb-4" style={{ backgroundColor: "#1e1e1e", borderRadius: "16px" }}>
          <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3" style={{ borderColor: "#333" }}>
            <div>
              <h3 className="fw-bold mb-1">Bienvenido, {usuario.nombre} {usuario.apellido}</h3>
              <small className="text-muted" style={{ color: "#aaa" }}>{usuario.email}</small>
            </div>
            <button
              className="btn btn-outline-danger"
              onClick={() => {
                setAlerta({ tipo: "success", mensaje: "Sesión cerrada correctamente." });
                setTimeout(() => {
                  localStorage.removeItem("usuario");
                  localStorage.removeItem("carrito");
                  setUsuario(null);

                  // Disparar evento global para notificar al Navbar
                  window.dispatchEvent(new Event("usuarioCambiado"));

                  navigate("/");
                }, 1200);
              }}
            >
              Cerrar sesión
            </button>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3"><strong>RUT:</strong> <br />{usuario.rut}</div>
            <div className="col-md-6 mb-3"><strong>Teléfono:</strong> <br />{usuario.telefono}</div>
            <div className="col-md-6 mb-3"><strong>Región:</strong> <br />{usuario.region}</div>
            <div className="col-md-6 mb-3"><strong>Comuna:</strong> <br />{usuario.comuna}</div>
            <div className="col-md-6 mb-3"><strong>Fecha de nacimiento:</strong> <br />{usuario.fecha}</div>
            <div className="col-md-6 mb-3"><strong>Correo Duoc:</strong> <br />{usuario.esDuoc ? "Sí" : "No"}</div>
          </div>
        </div>

        {/* Boletas */}
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ backgroundColor: "#2c2c2c", borderRadius: "16px" }}>
          <h4 className="mb-3">🧾 Mis boletas</h4>
          {boletas.length === 0 ? (
            <p className="text-muted">No tienes compras registradas.</p>
          ) : (
            <div className="list-group">
              {boletas.map((b, i) => (
                <div key={i} className="list-group-item d-flex justify-content-between align-items-center" style={{ backgroundColor: "#1e1e1e", color: "#fff", borderColor: "#333" }}>
                  <div>
                    <strong>#{b.idTransaccionPayPal}</strong> — {new Date(b.fecha).toLocaleDateString()} <br />
                    <small>{b.items?.length || 0} productos</small>
                  </div>
                  <div className="d-flex gap-2">
                    <strong>${b.totalPrecio?.toLocaleString()}</strong>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        localStorage.setItem("ultimaBoleta", JSON.stringify(b));
                        navigate("/boleta");
                      }}
                    >
                      Ver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reseñas */}
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ backgroundColor: "#2c2c2c", borderRadius: "16px" }}>
          <h4 className="mb-3">⭐ Mis reseñas</h4>
          {resenias.length === 0 ? (
            <p className="text-muted">Aún no has dejado reseñas.</p>
          ) : (
            <div className="list-group">
              {resenias.map((r, i) => (
                <div
                  key={i}
                  className="list-group-item d-flex justify-content-between align-items-start"
                  style={{ backgroundColor: "#1e1e1e", color: "#fff", borderColor: "#333" }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <img
                      src={r.imagen}
                      alt={r.producto}
                      style={{ width: 60, height: 60, objectFit: "contain", borderRadius: 6 }}
                    />
                    <div>
                      <strong>{r.producto}</strong>
                      <p className="mb-1">{r.texto}</p>
                      <small className="text-secondary">Puntaje: {r.rating}/5</small>
                    </div>
                  </div>

                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      const copia = [...resenias];
                      copia.splice(i, 1);
                      setResenias(copia);

                      const todas = JSON.parse(localStorage.getItem("resenias")) || [];
                      const filtradas = todas.filter(item => !(item.email === r.email && item.fecha === r.fecha && item.productoId === r.productoId));
                      localStorage.setItem("resenias", JSON.stringify(filtradas));
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incidencias */}
        <div className="card shadow-sm border-0 p-4" style={{ backgroundColor: "#2c2c2c", borderRadius: "16px" }}>
          <h4 className="mb-3">🛠️ Mis incidencias</h4>
          {incidencias.length === 0 ? (
            <p className="text-muted">No has enviado incidencias.</p>
          ) : (
            <ul className="list-group">
              {incidencias.map((i, index) => (
                <li key={index} className="list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-start">
                  <div>
                    <strong>{i.tipo.toUpperCase()} - {i.asunto}</strong> – <span className="text-secondary">{i.fecha}</span>
                    <br />
                    {i.mensaje}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Alerta de sesión cerrada */}
      {alerta && (
        <div
          className={`alert alert-${alerta.tipo} position-fixed top-0 end-0 m-3`}
          style={{ zIndex: 9999 }}
          role="alert"
        >
          {alerta.mensaje}
        </div>
      )}

      <Footer />
    </>
  );
}
