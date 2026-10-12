function Resenia({ resenias }) {
  const promedioRating = resenias.length
    ? Math.round(resenias.reduce((a, r) => a + r.rating, 0) / resenias.length)
    : 0;

  return (
    <div className="p-4 rounded" style={{ background: "#1a1a1a" }}>
      <h5 className="orbitron mb-3">Reseñas de otros usuarios</h5>
      <div className="d-flex align-items-center mb-3">
        <div className="text-warning me-2">{"★".repeat(promedioRating)}</div>
        <small className="text-secondary">({resenias.length} reseña{resenias.length > 1 ? "s" : ""})</small>
      </div>
      <div className="list-group mb-3">
        {resenias.length === 0 ? (
          <p className="text-secondary">No hay reseñas todavía.</p>
        ) : (
          resenias.map((r, i) => (
            <div key={i} className="list-group-item bg-dark text-light mb-2 rounded">
              <strong>{r.nombre}</strong>{" "}
              <small className="text-secondary">{new Date(r.fecha).toLocaleString("es-CL")}</small>{" "}
              <span className="text-warning">{"★".repeat(r.rating)}</span>
              <p>{r.texto}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Resenia;
