// src/pages/Reportes.jsx

import React, { useState, useEffect } from 'react';
import SidebarAdmin from "../components/SidebarAdmin"; 
import Footer from "../components/Footer"; 
import productosD from "../data/productos.json"; 
import usuariosD from "../data/usuarios.json"; 

// --- Claves de LocalStorage ---
const LOCAL_STORAGE_KEY_PRODUCTS = 'productos_maestro';
const LOCAL_STORAGE_KEY_USERS = 'usuarios_maestro';
const LOCAL_STORAGE_KEY_SUPPORT = 'mensajesSoporte';

// --- Configuración ---
const STOCK_CRITICO_DEFAULT = 5; 

// --- Funciones para obtener datos ---
const getAllProducts = () => {
    try {
        const storedData = localStorage.getItem(LOCAL_STORAGE_KEY_PRODUCTS);
        let products = storedData ? JSON.parse(storedData) : [];
        if (!products || products.length === 0) products = productosD.productos || [];
        if (!Array.isArray(products)) return [];
        return products;
    } catch (error) { console.error("Error loading products:", error); return productosD.productos || []; }
};

const getAllUsers = () => {
    try {
        const storedData = localStorage.getItem(LOCAL_STORAGE_KEY_USERS);
        let users = storedData ? JSON.parse(storedData) : [];
        if (!users || users.length === 0) users = Array.isArray(usuariosD) ? usuariosD : usuariosD.usuarios || [];
        if (!Array.isArray(users)) return [];
         // Asegurar IDs para usuarios iniciales si no los tienen
        return users.map((u, index) => ({ ...u, id: u.id || `U${(index + 1).toString().padStart(3, '0')}` }));
    } catch (error) { console.error("Error loading users:", error); return Array.isArray(usuariosD) ? usuariosD : usuariosD.usuarios || []; }
};

// --- FUNCIÓN PARA LEER MENSAJES DE SOPORTE ---
const getSupportMessages = () => {
    try {
        const messagesData = localStorage.getItem(LOCAL_STORAGE_KEY_SUPPORT);
        const messagesByEmail = messagesData ? JSON.parse(messagesData) : {};
        
        // Convertir el objeto {email: [msgs]} a un array plano [msg] añadiendo el email
        let allMessages = [];
        Object.keys(messagesByEmail).forEach(email => {
            messagesByEmail[email].forEach(msg => {
                allMessages.push({ ...msg, email }); // Añadir email al objeto mensaje
            });
        });
        
        // Ordenar por fecha (más reciente primero) - asumiendo formato parseable
        allMessages.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); 
        
        return allMessages;
    } catch (error) {
        console.error("Error reading support messages:", error);
        return [];
    }
};


// --- Componente de Contenido (Reportes) ---
const ReportesContent = () => {
    
    // Estados para los diferentes reportes
    const [criticalProducts, setCriticalProducts] = useState([]);
    const [popularProducts, setPopularProducts] = useState([]);
    const [financialSummary, setFinancialSummary] = useState({ ingresos: 0, ganancias: 0 });
    const [userActivity, setUserActivity] = useState({ total: 0, nuevos: 0 });
    const [supportMessages, setSupportMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Cargar y procesar todos los datos al montar
    useEffect(() => {
        // Cargar Productos
        const allProducts = getAllProducts();
        const criticos = allProducts.filter(p => {
            const stock = parseInt(p.stock, 10);
            const stockCritico = parseInt(p.stockCritico, 10) || STOCK_CRITICO_DEFAULT;
            return !isNaN(stock) && !isNaN(stockCritico) && stock <= stockCritico;
        });
        setCriticalProducts(criticos);
        
        // Simular Populares (ej: los 3 primeros)
        setPopularProducts(allProducts.slice(0, 3)); 

        // Simular Finanzas
        const totalIngresos = Math.random() * 1000000 + 500000; // Entre 500k y 1.5M
        setFinancialSummary({
            ingresos: totalIngresos,
            ganancias: totalIngresos * (Math.random() * 0.2 + 0.15) // Ganancia entre 15% y 35%
        });

        // Cargar Usuarios
        const allUsers = getAllUsers();
        setUserActivity({
            total: allUsers.length,
            nuevos: Math.floor(Math.random() * 10) // Nuevos usuarios simulados
        });

        // Cargar Mensajes de Soporte
        setSupportMessages(getSupportMessages().slice(0, 5)); // Mostrar los últimos 5

        setIsLoading(false);
    }, []); 


    return (
        <div className="admin-content-wrapper p-4 flex-grow-1" style={{ backgroundColor: '#000000ff' }}>
            
            <h1 className="text-light h4 mb-1">Reportes Generales</h1>
            <p className="text-muted mb-4">Resumen y análisis del estado del inventario, ventas y actividad.</p>

            {isLoading ? (
                <p className="text-center text-secondary">Cargando reportes...</p>
            ) : (
                <div className="row">
                    {/* Columna Izquierda (Stock, Populares, Finanzas) */}
                    <div className="col-lg-8">
                        {/* 1. Reporte de Stock Crítico */}
                        <div className="mb-4">
                            <h3 className="text-warning mb-3"><i className="fas fa-exclamation-triangle me-2"></i> Reporte de Stock Crítico</h3>
                            <div className="table-responsive" style={{ backgroundColor: '#212529', borderRadius: '8px', padding: '10px' }}>
                                <table className="table table-dark table-sm table-striped table-hover align-middle">
                                    <thead>
                                        <tr><th>ID</th><th>Nombre</th><th>Stock Actual</th><th>Umbral</th></tr>
                                    </thead>
                                    <tbody>
                                        {criticalProducts.length > 0 ? (
                                            criticalProducts.map(p => (
                                                <tr key={p.id}><th>{p.id}</th><td>{p.nombre}</td><td className="text-danger fw-bold">{p.stock}</td><td>{p.stockCritico || STOCK_CRITICO_DEFAULT}</td></tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="4" className="text-center text-success p-2"><i className="fas fa-check-circle me-1"></i> No hay productos críticos.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 2. Reporte Productos Populares (Simulado) */}
                        <div className="mb-4">
                            <h3 className="text-info mb-3"><i className="fas fa-fire me-2"></i> Productos Populares (Simulado)</h3>
                            <ul className="list-group list-group-flush" style={{ backgroundColor: '#212529', borderRadius: '8px' }}>
                                {popularProducts.map(p => (
                                    <li key={p.id} className="list-group-item bg-dark text-white d-flex justify-content-between px-3 py-2">
                                        <span>{p.nombre}</span>
                                        <span className="text-muted small">ID: {p.id}</span>
                                    </li>
                                ))}
                                {popularProducts.length === 0 && <li className="list-group-item bg-dark text-secondary text-center">No hay datos de productos.</li>}
                            </ul>
                        </div>

                        {/* 3. Resumen Financiero (Simulado) */}
                        <div className="mb-4">
                            <h3 className="text-success mb-3"><i className="fas fa-dollar-sign me-2"></i> Resumen Financiero (Simulado)</h3>
                            <div className="card bg-dark border-secondary">
                                <div className="card-body">
                                    <p><strong>Ingresos Totales (Mes):</strong> <span className="text-light fs-5">${financialSummary.ingresos.toLocaleString('es-CL')}</span></p>
                                    <p className="mb-0"><strong>Ganancias Estimadas (Mes):</strong> <span className="text-success fs-5">${financialSummary.ganancias.toLocaleString('es-CL')}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Columna Derecha (Usuarios, Soporte) */}
                    <div className="col-lg-4">
                        {/* 4. Actividad de Usuarios */}
                        <div className="mb-4">
                            <h3 className="text-primary mb-3"><i className="fas fa-users me-2"></i> Actividad de Usuarios</h3>
                            <div className="card bg-dark border-secondary">
                                <div className="card-body">
                                    <p><strong>Total Usuarios Registrados:</strong> <span className="text-light fs-5">{userActivity.total}</span></p>
                                    <p className="mb-0"><strong>Nuevos Usuarios (Hoy - Simulado):</strong> <span className="text-info fs-5">{userActivity.nuevos}</span></p>
                                </div>
                            </div>
                        </div>

                        {/* 5. Últimos Mensajes de Soporte */}
                        <div className="mb-4">
                            <h3 className="text-light mb-3">
                                <i className="fas fa-headset me-2"></i> Últimos Mensajes de Soporte
                                {supportMessages.length > 0 && <span className="badge bg-danger ms-2">{supportMessages.length} Nuevos</span>}
                            </h3>
                            <div style={{ backgroundColor: '#212529', borderRadius: '8px', padding: '15px', maxHeight: '400px', overflowY: 'auto' }}>
                                {supportMessages.length > 0 ? (
                                    supportMessages.map((msg, index) => (
                                        <div key={index} className="mb-3 border-bottom border-secondary pb-2">
                                            <p className="mb-0 small text-muted">De: {msg.email} ({msg.fecha})</p>
                                            <p className="fw-bold mb-1">{msg.asunto}</p>
                                            <p className="small mb-0 text-light">{msg.mensaje.substring(0, 100)}{msg.mensaje.length > 100 ? '...' : ''}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-secondary">No hay mensajes de soporte recientes.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            
        </div>
    );
}


function Reporte() {
    return (
        <>
        <SidebarAdmin>
            <ReportesContent />
        </SidebarAdmin>
          <Footer />
        </>
    );
}

export default Reporte;