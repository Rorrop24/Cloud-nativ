export default function ProductoDetalle({ producto }) {
  if (!producto) return <p>Producto no encontrado</p>;

  return (
    <div className="mb-4">
      <img
        src={producto.imagen}
        alt={producto.nombre}
        className="img-fluid mb-3"
        style={{ maxHeight: 400, objectFit: "contain" }}
      />
      <h2>{producto.nombre}</h2>
      <p>{producto.descripcion}</p>
    </div>
  );
}
