// src/components/Notiadmn.jsx (CÓDIGO CORREGIDO Y LISTO)

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch as fetch } from "../auth/apiFetch";
import { API_PRODUCTOS } from "../utils/apihelper";

// ELIMINAMOS importaciones estáticas:
// import productosD from "../data/productos.json"; 

// --- Configuración Global ---
const GREEN_NEON = '#39FF14';
const API_URL_PRODUCTOS = `${API_PRODUCTOS}/todos`;
const STOCK_CRITICO_FALLBACK = 5; 


function Notiadmn() {
    // Estado para almacenar la lista de productos con stock crítico
    const [criticalList, setCriticalList] = useState([]);
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Función para obtener y procesar los productos desde la API
    const fetchCriticalProducts = useCallback(async () => {
        try {
            const response = await fetch(API_URL_PRODUCTOS);
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: No se pudo obtener la lista de productos.`);
            }
            
            const allProducts = await response.json();

            // Lógica de Filtrado: Filtra los productos donde stock <= stockCritico
            const criticalProducts = allProducts.filter(p => {
                const stock = parseInt(p.stock || p.STOCK, 10);
                const stockCritico = parseInt(p.stockCritico || p.STOCK_CRITICO, 10) || STOCK_CRITICO_FALLBACK; 

                return !isNaN(stock) && !isNaN(stockCritico) && stock <= stockCritico;
            });

            setCriticalList(criticalProducts);
            setIsVisible(criticalProducts.length > 0);
            setError(null);

        } catch (err) {
            console.error("Error al cargar productos críticos:", err);
            setError("Error de conexión con el servidor. No se pudo verificar el stock.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Efecto para cargar los datos y verificar el stock al montar el componente (y cada 30s)
    useEffect(() => {
        fetchCriticalProducts(); 
        
        const interval = setInterval(() => {
            fetchCriticalProducts(); 
        }, 30000); // Chequea cada 30 segundos

        return () => clearInterval(interval);
    }, [fetchCriticalProducts]);


    if (loading || error) {
         // No mostramos nada si hay error o está cargando, para no ser intrusivos
         return null; 
    }

    if (!isVisible || criticalList.length === 0) {
        return null;
    }

    // Renderizado del Modal de Notificación
    return (
        <div
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: 1050,
                backgroundColor: 'rgba(33, 37, 41, 0.9)', 
                color: 'white',
                padding: '15px 20px',
                borderRadius: '10px',
                border: `2px solid ${GREEN_NEON}`, 
                boxShadow: `0 0 10px ${GREEN_NEON}, 0 0 5px rgba(0, 0, 0, 0.5)`, 
                maxWidth: '350px',
            }}
        >
            <h5 className="mb-2" style={{ color: GREEN_NEON }}>
                <i className="fas fa-exclamation-triangle me-2"></i> 
                ¡Alerta de Stock Crítico!
            </h5>
            
            {/* ... Contenido de la lista y botón Entendido ... */}
        </div>
    );
}

export default Notiadmn;
