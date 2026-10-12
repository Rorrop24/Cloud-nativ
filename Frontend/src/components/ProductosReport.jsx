// src/components/ProductosReport.jsx

import React from 'react';

// Componente para el modal de reportes de producto (Renombrado)
function ProductosReport({ product, onClose }) {
    if (!product) {
        return null; // No muestra nada si no hay producto seleccionado
    }

    // Datos simulados (inventados) para el reporte
    const simulatedData = {
        ventasUltimoMes: Math.floor(Math.random() * 50) + 10, 
        ingresosUltimoMes: (Math.random() * 500000 + 100000), 
        devolucionesUltimoMes: Math.floor(Math.random() * 5),
    };

    return (
        // Fondo oscuro semitransparente que cubre toda la pantalla
        <div 
            className="modal fade show d-block" 
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
            onClick={onClose} // Cierra si haces clic fuera del contenido
        >
            <div className="modal-dialog modal-lg modal-dialog-centered">
                {/* Contenido de la ventana */}
                <div 
                    className="modal-content bg-dark text-white border-secondary"
                    onClick={(e) => e.stopPropagation()} // Evita que se cierre al hacer clic dentro
                >
                    
                    {/* Encabezado */}
                    <div className="modal-header border-bottom-secondary">
                        <h5 className="modal-title">
                            <i className="fas fa-chart-line me-2"></i> Reporte: {product.nombre} (ID: {product.id})
                        </h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    {/* Cuerpo con la información */}
                    <div className="modal-body">
                        <p className="text-muted">Resumen del rendimiento del producto.</p>
                        
                        {/* Info Básica */}
                        <div className="mb-3">
                            <p><strong>Categoría:</strong> {product.categoria}</p>
                            <p><strong>Precio:</strong> ${(product.precio || 0).toLocaleString('es-CL')}</p>
                            <p><strong>Stock Actual:</strong> {product.stock} (Crítico: {product.stockCritico || 5})</p>
                            <p><strong>Rating:</strong> {product.rating?.toFixed(1) || 'N/A'} <i className="fas fa-star text-warning"></i></p>
                        </div>
                        
                        {/* Info Simulada */}
                        <h6 className="text-warning mt-4">Rendimiento (Último Mes - Simulado)</h6>
                        <p><i className="fas fa-money-bill-wave me-2 text-primary"></i> Ventas: {simulatedData.ventasUltimoMes} unidades</p>
                        <p><i className="fas fa-dollar-sign me-2 text-success"></i> Ingresos: ${simulatedData.ingresosUltimoMes.toLocaleString('es-CL')}</p>
                        <p><i className="fas fa-undo-alt me-2 text-danger"></i> Devoluciones: {simulatedData.devolucionesUltimoMes}</p>
                    </div>

                    {/* Pie con botón de cierre */}
                    <div className="modal-footer border-top-secondary">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cerrar
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default ProductosReport; // Exportación actualizada