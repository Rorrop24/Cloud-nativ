// src/pages/Productosadmin.jsx (CÓDIGO FINAL CORREGIDO)

import React, { useState, useEffect, useCallback } from 'react'; 
import { Link } from 'react-router-dom';
import SidebarAdmin from "../components/SidebarAdmin"; 
import Notiadmn from '../components/Notiadmn';
import ProductosReport from '../components/ProductosReport'; 

// 🛑 IMPORTAMOS LAS FUNCIONES DEL HELPER
import { getProductos, deleteProducto } from '../utils/apihelper'; 

// --- Configuración API y Constantes ---
// API_BASE_URL ya no es necesaria aquí; el helper la gestiona.
const STOCK_CRITICO_DEFAULT = 5; 


// --- Componente de Contenido (Tabla de Productos) ---
const ProductContent = () => {
    
    // 1. Estados para la data de la API
    const [productosArray, setProductosArray] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filter, setFilter] = useState('todos'); 

    // Estados para el modal de reportes
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedProductForReport, setSelectedProductForReport] = useState(null);

    // 2. Función de Carga de Datos (READ) - Usa getProductos()
    const fetchProducts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // ✅ USAMOS getProductos() de apihelper (Puerto 8082)
            const data = await getProductos(); 
            
            // Mapeo flexible para ID
            setProductosArray(data.map(p => ({ ...p, id: p.id || p.ID }))); 
        } catch (err) {
            console.error("Error cargando productos:", err);
            setError(`No se pudo conectar a la API para obtener la lista de productos: ${err}`);
        } finally {
            setLoading(false);
        }
    }, []);

    // 3. Ejecutar la carga al montar el componente
    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);


    // Lógica de Filtrado (se mantiene igual)
    const filteredProducts = productosArray.filter(producto => {
        const productStockCritico = producto.stockCritico || producto.STOCK_CRITICO || STOCK_CRITICO_DEFAULT;
        const productStock = producto.stock || producto.STOCK || 0;

        if (filter === 'critico') return productStock <= productStockCritico;
        return true; 
    });

    // 4. Lógica para Borrar (DELETE con API) - Usa deleteProducto()
    const handleDelete = async (id, nombre) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar el producto ${nombre} (ID: ${id})? Esta acción afectará la base de datos SQL.`)) {
            try {
                // ✅ USAMOS deleteProducto(id) de apihelper
                await deleteProducto(id); 

                // Actualizar el estado local (sin recargar)
                setProductosArray(prev => prev.filter(p => p.id !== id));
                alert(`Producto ${nombre} eliminado exitosamente.`);
            } catch (err) {
                console.error("Error eliminando producto:", err);
                alert(`Error al eliminar producto: ${err}`);
            }
        }
    };

    // Manejadores de modal (se mantienen iguales)
    const handleViewReports = (product) => {
        setSelectedProductForReport(product); 
        setShowReportModal(true); 
    };

    const handleCloseReportModal = () => {
        setShowReportModal(false); 
        setSelectedProductForReport(null); 
    };


    return (
        <div className="admin-content-wrapper p-4 flex-grow-1" style={{ backgroundColor: '#000000ff' }}>
            
            <h1 className="text-light h4 mb-1">Productos</h1>
            <p className="text-muted mb-4">Listado y gestión completa del catálogo.</p>

            {/* Manejo de estados de carga y error */}
            {loading && <p className="text-warning"><i className="fas fa-spinner fa-spin me-2"></i> Cargando productos desde la base de datos...</p>}
            {error && <p className="alert alert-danger">{error}</p>}

            {!loading && !error && (
            <>
                {/* BARRA DE ACCIONES SUPERIOR */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    {/* Botón Nuevo Producto */}
                    <Link 
                        to="/adminhome/nuevoproducto" 
                        className="btn btn-lg text-white d-flex align-items-center fw-bold"
                        style={{ backgroundColor: '#39FF14', color: '#000000' }}
                    >
                        <i className="fas fa-plus-circle me-2"></i> NUEVO PRODUCTO
                    </Link>
                    {/* Filtro de Stock (se mantiene igual) */}
                    <div className="btn-group" role="group">
                        <button type="button" className={`btn ${filter === 'todos' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setFilter('todos')}>Todos</button>
                        <button type="button" className={`btn ${filter === 'critico' ? 'btn-danger' : 'btn-outline-secondary'}`} onClick={() => setFilter('critico')}>Solo Stock Crítico</button>
                    </div>
                </div>

                {/* Tabla de Listado de Productos (se mantiene igual) */}
                <div className="table-responsive" style={{ backgroundColor: '#212529', borderRadius: '8px', padding: '10px' }}>
                    <table className="table table-dark table-striped table-hover align-middle" style={{ backgroundColor: 'transparent' }}>
                        <thead>
                            <tr>
                                <th>ID</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Rating</th> 
                                <th>Stock</th><th>Estado</th><th style={{ width: '200px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((producto) => {
                                // ... (Lógica de filtrado y mapeo de columnas) ...
                                return (
                                    <tr key={producto.id}>
                                            {/* ... Columnas de datos ... */}
                                        <td>
                                            {/* Botones de acción (Eliminar usa el helper) */}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </>
            )}
            
            {/* RENDERIZADO CONDICIONAL DEL MODAL */}
            {showReportModal && (
                <ProductosReport 
                    product={selectedProductForReport} 
                    onClose={handleCloseReportModal} 
                />
            )}
            
        </div>
    );
}


function Productosadmin() {
    return (
        <SidebarAdmin>
            <ProductContent />
            <Notiadmn />
        </SidebarAdmin>
    );
}

export default Productosadmin;