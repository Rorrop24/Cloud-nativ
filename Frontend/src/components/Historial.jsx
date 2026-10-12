import React from 'react';
import historialD from '../data/historial.json'; // Asumo esta ruta
import { Link } from 'react-router-dom';

const GREEN_NEON = '#39FF14';

// Componente para el modal/rectángulo semitransparente (Anteriormente PurchaseHistoryModal)
function Historial({ userId, userName, onClose }) {
    
    // 1. Cargar y filtrar el historial de compras para el usuario específico
    const userHistory = historialD.filter(order => order.userId === userId);

    // 2. Calcular el total acumulado de todas las órdenes
    const grandTotal = userHistory.reduce((acc, order) => acc + order.totalOrden, 0);

    // Renderizado condicional si no hay historial
    if (!userId) return null;

    return (
        // Fondo semi-transparente y fijo (Overlay)
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)', // Negro semi-transparente
                zIndex: 1060,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}
            onClick={onClose} // Cierra el modal al hacer clic en el fondo
        >
            {/* Contenedor del Historial (El "Rectángulo" principal) */}
            <div 
                style={{
                    backgroundColor: 'rgba(33, 37, 41, 0.95)', // Gris oscuro semi-transparente
                    color: 'white',
                    padding: '30px',
                    borderRadius: '10px',
                    width: '90%',
                    maxWidth: '600px',
                    boxShadow: '0 0 20px rgba(57, 255, 20, 0.7)', // Ligero brillo verde
                    position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()} // Evita que el clic en el modal cierre el overlay
            >
                <h3 className="mb-2" style={{ color: GREEN_NEON }}>
                    Historial de Compras
                </h3>
                <p className="text-muted mb-4">Usuario: {userName} (ID: {userId})</p>

                {userHistory.length === 0 ? (
                    <p className="text-center text-secondary">Este usuario no tiene compras registradas.</p>
                ) : (
                    <>
                        {userHistory.map((order, index) => (
                            <div key={order.idTransaccion} className="mb-3">
                                <h5 className="mb-2" style={{ borderBottom: `1px solid ${GREEN_NEON}`, paddingBottom: '5px' }}>
                                    Orden #{order.idTransaccion} - {order.fechaCompra}
                                </h5>

                                {/* Listado de Productos de la Orden */}
                                {order.productosComprados.map((item, itemIndex) => (
                                    <div 
                                        key={itemIndex} 
                                        className="d-flex justify-content-between py-1"
                                        style={{ borderBottom: '1px dotted rgba(255, 255, 255, 0.1)' }}
                                    >
                                        <span className="text-light">
                                            ({item.cantidad}x) {item.nombreProducto} 
                                        </span>
                                        <span className="text-white fw-bold">
                                            ${(item.subtotal).toLocaleString('es-CL')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}

                        {/* Separador Horizontal Neon y Total */}
                        <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: `2px solid ${GREEN_NEON}` }}>
                            <div className="d-flex justify-content-between fw-bold fs-5">
                                <span style={{ color: GREEN_NEON }}>TOTAL ACUMULADO:</span>
                                <span className="text-white">${grandTotal.toLocaleString('es-CL')}</span>
                            </div>
                        </div>
                    </>
                )}

                {/* Botón de cierre (para mejor UX) */}
                <button 
                    onClick={onClose} 
                    className="btn btn-sm btn-outline-light mt-4 w-100"
                    style={{ borderColor: GREEN_NEON, color: GREEN_NEON }}
                >
                    Cerrar
                </button>
            </div>
        </div>
    );
}

export default Historial;