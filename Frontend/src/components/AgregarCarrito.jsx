import { useState } from "react";

export default function AgregarCarrito({ stockInicial, onAgregar, usuario, precio }) {
  const [cantidad, setCantidad] = useState(1);
  const [stock, setStock] = useState(stockInicial);

  const handleAgregar = () => {
    onAgregar(cantidad); // Llama al padre con la cantidad
    setStock(prev => prev - cantidad);
    setCantidad(1);
  };

  return (
    <div className="mb-3">
      {/* Stock disponible */}
      <p className={stock > 0 ? "text-success" : "text-danger"}>
        {stock > 0
          ? `${stock} unidad${stock !== 1 ? "es" : ""} disponible${stock !== 1 ? "s" : ""}`
          : "Agotado"}
      </p>

      {/* Precio con descuento */}
      <p className={usuario?.esDuoc ? "text-danger" : "text-success"}>
        {usuario?.esDuoc ? "¡Descuento aplicado!" : "Precio normal"} - ${ (precio ?? 0).toLocaleString() }
      </p>

      {/* Cantidad a agregar */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <label className="mb-0">Cantidad:</label>
        <input
          type="number"
          value={cantidad}
          min={1}
          max={stock}
          onChange={e => setCantidad(Math.min(Math.max(1, e.target.value), stock))}
          style={{ width: 60 }}
          className="form-control form-control-sm"
          disabled={stock === 0}
        />
      </div>

      {/* Botón agregar */}
      <button
        className="btn btn-accent w-100"
        onClick={handleAgregar}
        disabled={stock === 0}
      >
        Agregar al carrito
      </button>
    </div>
  );
}
