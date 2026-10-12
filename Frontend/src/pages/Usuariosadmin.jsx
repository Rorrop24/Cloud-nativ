// src/pages/Usuariosadmin.jsx (CÓDIGO CON LAYOUT COMPLETO)

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
// Importamos los componentes del layout
import SidebarAdmin from "../components/SidebarAdmin"; 
import Footer from '../components/Footer';
import Notiadmn from '../components/Notiadmn';

import TablaUsuarios from "../components/TablaUsuarios"; // <-- IMPORTACIÓN CLAVE

// --- Configuración de Estilos ---
const GREEN_LIGHT = '#39FF14'; 
const hoverStyle = { transition: 'box-shadow 0.3s ease-in-out' };


const UserContent = () => {
    
    const [isNewButtonHovered, setIsNewButtonHovered] = useState(false); 

    return (
        // Nota: Quitamos el estilo de fondo aquí, ya que SidebarAdmin o Homeadmin lo aplicarán al contenedor de contenido.
        <div className="admin-content-wrapper p-4 flex-grow-1">
            
            {/* BARRA DE ACCIONES SUPERIOR (Nuevo Usuario) */}
            <div className="d-flex justify-content-start mb-4">
                
                {/* Botón Nuevo Usuario (Ruta corregida para el layout anidado) */}
                <Link 
                    // 🛑 Usamos la ruta completa si es ruta global, o la anidada si es sub-ruta.
                    // Asumimos que la creación de un usuario es una sub-ruta del admin.
                    to="/homeadmin/nuevousuario" 
                    className="btn btn-lg text-white d-flex align-items-center fw-bold"
                    style={{
                        backgroundColor: '#28a745', 
                        border: 'none',
                        ...hoverStyle,
                        boxShadow: isNewButtonHovered ? `0 0 15px ${GREEN_LIGHT}, 0 0 5px ${GREEN_LIGHT}` : 'none'
                    }}
                    onMouseEnter={() => setIsNewButtonHovered(true)}
                    onMouseLeave={() => setIsNewButtonHovered(false)}
                >
                    <i className="fas fa-user-plus me-2"></i> 
                    NUEVO USUARIO
                </Link>
            </div>
            
            {/* Renderiza el componente de la tabla, que ya está migrado a la API */}
            <TablaUsuarios />
        </div>
    );
}


function Usuariosadmin() {
    // 🛑 ESTRUCTURA CORREGIDA: Renderizamos el layout completo para asegurar que el Sidebar y Footer aparezcan
    return (
        <>
            <SidebarAdmin>
                <UserContent />
                <Notiadmn />
            </SidebarAdmin>
            <Footer />
        </>
    );
}

export default Usuariosadmin;