// src/pages/NuevoUsuario.jsx

import React from 'react';
import SidebarAdmin from "../components/SidebarAdmin"; 
import Footer from "../components/Footer";
import { Link } from 'react-router-dom';
import Notiadmn from '../components/Notiadmn';
import FormularioUsuarioNV from "../components/FormularioUsuarioNV"; 


function NuevoUsuario() {
    
    const UserContent = () => (
        // Contenido específico de la página
        <div className="admin-content-wrapper p-4 flex-grow-1" style={{ backgroundColor: '#000000ff' }}>
            
            <h1 className="text-light h4 mb-1">Registrar Nuevo Usuario</h1>
            <p className="text-muted mb-4">Ingrese los datos para crear una nueva cuenta de usuario o administrador.</p>

            {/* Botón para regresar al listado */}
            <Link to="/usuariosadmin" className="btn btn-sm btn-outline-secondary mb-4">
                <i className="fas fa-arrow-left me-2"></i> Volver a Gestión de Usuarios
            </Link>

            {/* Renderizar el Formulario importado */}
            <FormularioUsuarioNV />
            
            <Footer />
        </div>
    );

    return (
        // Usamos SidebarAdmin como Layout
        <SidebarAdmin>
            <UserContent />
            <Notiadmn />
        </SidebarAdmin>
    );
}

export default NuevoUsuario;