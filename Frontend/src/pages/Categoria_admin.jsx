
import SidebarAdmin from "../components/SidebarAdmin"; 
// Importar el componente de contenido de la carpeta components
import CategoriasContent from "../components/CategoriaContent"; 
import Footer from "../components/Footer";


function Categoria_admin() { // <-- Función Principal
    return (
        <>
         <SidebarAdmin>
            <CategoriasContent /> 
        </SidebarAdmin>
        <Footer />
        </>
       
    );
}

export default Categoria_admin;