
import { useParams } from 'react-router-dom';
import SidebarAdmin from "../components/SidebarAdmin"; 
import Footer from "../components/Footer";
import FormularioUsuarioEdit from "../components/FormularioUsuarioEdit"; // <-- Formulario de Edición

function EditarUser() {
    
    // Obtener el ID del usuario desde la URL (ej: /usuariosadmin/editar/U001)
    const { id } = useParams(); 
    
    const EditarUserContent = () => (
        <div className="admin-content-wrapper p-4 flex-grow-1" style={{ backgroundColor: '#000000ff' }}>
            
            <h1 className="text-light h4 mb-1">Editar Usuario</h1>
            <p className="text-muted mb-4">Modificando perfil del usuario: ID **{id}**</p>

            {/* Renderizar el Formulario, pasando el ID obtenido */}
            <FormularioUsuarioEdit userId={id} />
            
            
        </div>
    );

    return (
       <>
        <SidebarAdmin>
            <EditarUserContent />
        </SidebarAdmin>
        <Footer />
       </>
       
    );
}

export default EditarUser;