import React from 'react';
import { useParams } from 'react-router-dom';
import SidebarAdmin from "../components/SidebarAdmin"; 
import Footer from "../components/Footer";
import FormularioProductoEdit from "../components/FormularioProductoEdit"; // <-- Formulario de Edición

function EditarProducto() {
    
    
    const { id } = useParams(); 
    
    const EditarProductoContent = () => (
        <div className="admin-content-wrapper p-4 flex-grow-1" style={{ backgroundColor: '#000000ff' }}>
            
            <h1 className="text-light h4 mb-1">Editar Producto</h1>
            <p className="text-muted mb-4">Modificando producto: ID **{id}**</p>

            {/* Renderizar el Formulario, pasando el ID obtenido */}
            <FormularioProductoEdit productId={id} />
            
            
        </div>
    );

    return (
         <>
        <SidebarAdmin>
            <EditarProductoContent />
        </SidebarAdmin>
        <Footer />
        </>
    );
}

export default EditarProducto;