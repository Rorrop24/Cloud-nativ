import { useState } from "react";

function ReseniaForm({ usuario, onAgregarReseña }) {
  const [texto, setTexto] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'error'|'ok', texto: '...' }

  const mostrarMensaje = (tipo, texto, ms = 3500) => {
    setMensaje({ tipo, texto });
    if (ms) setTimeout(() => setMensaje(null), ms);
  };

  const enviarResena = () => {
    if (!usuario || !usuario.email) {
      mostrarMensaje("error", "Debes iniciar sesión para enviar una reseña.");
      return;
    }
    if (!texto.trim()) {
      mostrarMensaje("error", "Escribe algo antes de enviar tu reseña.");
      return;
    }

    // Solo enviamos datos básicos; Detalles.jsx completa producto, imagen y fecha
    const resenaParcial = {
      nombre: usuario.nombre || usuario.email || "Anónimo",
      email: usuario.email,
      texto: texto.trim(),
      rating,
    };

    if (typeof onAgregarReseña === "function") onAgregarReseña(resenaParcial);

    setTexto("");
    setRating(5);
    setHover(0);
    mostrarMensaje("ok", "Reseña enviada correctamente.");
  };

  return (
    <div className="card bg-dark p-3 rounded mb-4" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
      <h5 className="orbitron mb-3">Escribe tu reseña</h5>

      <input
        className="form-control mb-2"
        value={usuario?.nombre || ""}
        disabled
        placeholder={usuario ? "" : "Debes iniciar sesión"}
      />

      <textarea
        className="form-control mb-2"
        rows="3"
        placeholder={usuario ? "Escribe tu reseña" : "Inicia sesión para escribir una reseña"}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      <div className="mb-2 d-flex align-items-center gap-2">
        <label className="text-secondary mb-0">Puntaje:</label>
        <div style={{ fontSize: 20 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              role="button"
              style={{
                cursor: usuario ? "pointer" : "not-allowed",
                color: n <= (hover || rating) ? "#FFD700" : "#555",
                marginRight: 4,
                fontSize: 22,
                transition: "transform .08s"
              }}
              onMouseEnter={() => usuario && setHover(n)}
              onMouseLeave={() => usuario && setHover(0)}
              onClick={() => usuario && setRating(n)}
            >
              ★
            </span>
          ))}
        </div>
      </div>

      <button
        className="btn btn-accent w-100"
        onClick={enviarResena}
        disabled={!usuario || !usuario.email}
        style={{ opacity: (!usuario || !usuario.email) ? 0.6 : 1 }}
      >
        Enviar reseña
      </button>

      {mensaje && (
        <div
          className="mt-2 p-2 rounded text-center"
          style={{
            backgroundColor: mensaje.tipo === "ok" ? "#2f8e4a" : "#9b2b2b",
            color: "#fff",
            fontWeight: 600
          }}
        >
          {mensaje.tipo === "ok" ? "✅ " : "⚠️ "}
          {mensaje.texto}
        </div>
      )}
    </div>
  );
}

export default ReseniaForm;
