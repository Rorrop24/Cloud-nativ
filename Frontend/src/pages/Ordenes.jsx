// src/pages/Ordenes.jsx

import React, { useState, useEffect } from 'react';
import SidebarAdmin from "../components/SidebarAdmin"; 
import Footer from "../components/Footer"; 
import BoletaAdmin from "../components/BoletaAdmin";

// Importar las funciones del API Helper
import { getUsuarios, getAllBoletas } from "../apihelper"; 

// --- Configuración Global ---
const SHIPPING_COST = 3000; // Costo de envío fijo
// Eliminamos la lógica de localStorage/JSONs locales de usuarios/historial

// --- Componente de Contenido (Listado de Órdenes) ---
const OrdenesContent = () => {
    
    // Estado para guardar las órdenes (boletas) combinadas con datos de usuario
    const [ordersWithUserData, setOrdersWithUserData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Cargar y combinar datos al montar el componente
    useEffect(() => {
        const fetchOrdersAndUsers = async () => {
            setIsLoading(true);
            setError(null); // Resetear cualquier error anterior

            try {
                // 1. Obtener todos los usuarios y boletas (órdenes) de la API
                const allUsers = await getUsuarios();
                const allOrders = await getAllBoletas(); 

                // 2. Combinar datos: buscar usuario para cada orden
                const combinedData = allOrders.map(order => {
                    // Busca el usuario que coincide con el 'usuarioId' de la boleta
                    // Nota: Asume que el campo es 'usuarioId' o similar, ajusta si el backend usa otro nombre (ej: 'userId')
                    const user = allUsers.find(u => u.id === order.usuarioId); 
                    
                    // Retorna la orden original + datos del usuario
                    return {
                        ...order,
                        usuarioNombreCompleto: user ? `${user.nombre} ${user.apellido}` : 'Usuario Desconocido',
                        usuarioEmail: user ? user.email : 'N/A',
                        usuarioTelefono: user ? user.telefono : 'N/A',
                        // Asegúrate de que el backend provea un idTransaccion o similar para la 'key'
                        idTransaccion: order.id || order.idBoleta || order.idTransaccion, 
                    };
                });

                setOrdersWithUserData(combinedData);
            } catch (err) {
                console.error("Error al cargar datos de órdenes:", err);
                setError("Hubo un error al cargar las órdenes.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrdersAndUsers();
    }, []);


    return (
        <div className="admin-content-wrapper p-4 flex-grow-1" style={{ backgroundColor: '#000000ff' }}>
            
            <h1 className="text-light h4 mb-1">Gestión de Órdenes 🛒</h1>
            <p className="text-muted mb-4">Listado de todas las órdenes de compra realizadas.</p>

            {/* Mostrar mensaje de carga, error o si no hay órdenes */}
            {isLoading ? (
                <p className="text-center text-secondary">Cargando órdenes...</p>
            ) : error ? (
                <p className="text-center text-danger">⚠️ {error}</p>
            ) : ordersWithUserData.length === 0 ? (
                <p className="text-center text-secondary">No hay órdenes registradas.</p>
            ) : (
                // Mapear y renderizar cada boleta
                ordersWithUserData.map((order) => (
                    <BoletaAdmin 
                        // Utilizamos el campo 'idTransaccion' que hemos asegurado en el map
                        key={order.idTransaccion} 
                        order={order} 
                        shippingCost={SHIPPING_COST} 
                    />
                ))
            )}
            
            
        </div>
    );
}


function Ordenes() {
    return (
        <>
           <SidebarAdmin>
             <OrdenesContent />
           </SidebarAdmin>
           <Footer />
        </>
    );
}

export default Ordenes;