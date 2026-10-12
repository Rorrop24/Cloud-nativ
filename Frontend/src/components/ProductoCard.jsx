import { Link } from "react-router-dom";
const money = (value) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);

export default function ProductoCard({ producto, usuario, onAgregarCarrito }) {
  const { id, nombre, categoria, stock = 0, imagen, descuento = 0 } = producto;
  const precio = Number(producto.precio) || 0;
  const final = Math.round(precio * (1 - Number(descuento) / 100) * (usuario?.esDuoc ? 0.8 : 1));
  return <article className="product-card">
    <Link to="/detalles" state={{ productoId: id }} className="product-image" aria-label={`Ver ${nombre}`}>
      {imagen ? <img src={imagen} alt={nombre} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /> : <i className="bi bi-box-seam" aria-hidden="true" />}
      {descuento > 0 && <span className="discount-label">-{descuento}%</span>}
    </Link>
    <div className="product-body">
      <span className="product-category">{categoria?.nombre || "Gaming"}</span>
      <Link to="/detalles" state={{ productoId: id }} className="product-name">{nombre}</Link>
      <div className="product-price">{money(final)}{final < precio && <del>{money(precio)}</del>}</div>
      <div className={`product-stock ${stock > 0 ? "" : "out-of-stock"}`}><i className={stock > 0 ? "bi bi-check-circle" : "bi bi-dash-circle"} />{stock > 0 ? "Disponible" : "Agotado"}</div>
      <button className="btn btn-accent w-100" disabled={stock <= 0} onClick={() => onAgregarCarrito(producto)}><i className="bi bi-bag-plus" />{stock > 0 ? "Agregar al carrito" : "Sin stock"}</button>
    </div>
  </article>;
}
