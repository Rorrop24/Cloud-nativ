import React from 'react';

const GREEN_NEON = '#39FF14'; // Para las divisiones

// Componente para mostrar una boleta/orden individual
function BoletaAdmin({ order, shippingCost }) {
    if (!order) return null;

    // Calcular el Gran Total (Subtotal de la orden + Envío)
    const grandTotal = (order.totalOrden || 0) + shippingCost;

    return (
        <div className="card bg-dark text-white border-secondary mb-4">
            <div className="card-header d-flex justify-content-between align-items-center" style={{ borderColor: GREEN_NEON }}>
                <span>Orden ID: <strong className="text-warning">{order.idTransaccion}</strong></span>
                <span className="text-muted small">{order.fechaCompra}</span>
            </div>
            <div className="card-body">
                
                {/* Información del Cliente (Letra Pequeña) */}
                <div className="mb-3 border-bottom border-secondary pb-2">
                    <h6 className="card-subtitle mb-1 text-muted">Cliente:</h6>
                    <p className="card-text small mb-0">
                        <strong>Nombre:</strong> {order.usuarioNombreCompleto || 'N/A'} (ID: {order.userId})
                    </p>
                    <p className="card-text small mb-0">
                        <strong>Email:</strong> {order.usuarioEmail || 'N/A'} 
                    </p>
                    <p className="card-text small">
                        <strong>Teléfono:</strong> {order.usuarioTelefono || 'N/A'}
                    </p>
                </div>

                {/* Listado de Productos Comprados */}
                <h6 className="card-subtitle mb-2 text-muted">Productos:</h6>
                <ul className="list-group list-group-flush mb-3">
                    {order.productosComprados && order.productosComprados.map((item, index) => (
                        <li 
                            key={index} 
                            className="list-group-item bg-dark text-white d-flex justify-content-between align-items-center px-0"
                            style={{ borderBottom: index === order.productosComprados.length - 1 ? 'none' : `1px dotted rgba(255, 255, 255, 0.2)` }}
                        >
                            <span>({item.cantidad}x) {item.nombreProducto}</span>
                            <span className="fw-bold">${(item.subtotal || 0).toLocaleString('es-CL')}</span>
                        </li>
                    ))}
                </ul>

                {/* Totales */}
                <div style={{ borderTop: `2px solid ${GREEN_NEON}`, paddingTop: '10px' }}>
                    <div className="d-flex justify-content-between text-muted mb-1">
                        <span>Subtotal Productos:</span>
                        <span>${(order.totalOrden || 0).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="d-flex justify-content-between text-muted mb-2">
                        <span>Costo de Envío:</span>
                        <span>${shippingCost.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="d-flex justify-content-between fw-bold fs-5 mt-2" style={{ color: GREEN_NEON }}>
                        <span>TOTAL ORDEN:</span>
                        <span className="text-white">${grandTotal.toLocaleString('es-CL')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BoletaAdmin;