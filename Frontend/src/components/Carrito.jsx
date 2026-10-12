function Carrito({ open, setOpen, cantidad }) {
  return (
    <>
      <div className={`carrito-sidebar ${open ? "open" : ""}`}>
        <div className="carrito-header d-flex justify-content-between align-items-center p-3 border-bottom border-secondary-subtle">
          <h5>Carrito de compras</h5>
          <button className="btn btn-close btn-close-white" onClick={() => setOpen(false)}></button>
        </div>
        <div className="carrito-body p-3">
          {cantidad === 0 ? (
            <p className="text-secondary">Tu carrito está vacío</p>
          ) : (
            <p className="text-light">Tienes {cantidad} item(s) en tu carrito</p>
          )}
        </div>
      </div>
    </>
  );
}

export default Carrito;
