function EventoCard({ titulo, fecha, lugar, coordenadas, onClick, imagen }) {
  return (
    <div className="col-md-4">
      <div className="card h-100 evento-card" onClick={() => onClick(coordenadas)}>
        {imagen && <img src={imagen} alt={titulo} className="card-img-top" />}
        <div className="card-body">
          <h5 className="card-title">{titulo}</h5>
          <p className="card-text text-secondary mb-1">
            <i className="bi bi-calendar-event me-1"></i> {fecha}
          </p>
          <p className="card-text text-secondary">
            <i className="bi bi-geo-alt me-1"></i> {lugar}
          </p>
        </div>
      </div>
    </div>
  );
}

export default EventoCard;