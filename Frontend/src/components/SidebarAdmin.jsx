import { NavLink, Link } from "react-router-dom";
export const StockNotification = () => null;
export const Sidebar = () => <aside className="admin-sidebar">
  <Link className="store-brand" to="/homeadmin"><i className="bi bi-controller brand-symbol" /><span>PUNTO GAMER<small>ADMINISTRACION</small></span></Link>
  <nav aria-label="Administracion">
    {[["/homeadmin", "Resumen", "grid"], ["/productosadmin", "Productos", "box-seam"], ["/categoria_admin", "Categorias", "tags"], ["/usuariosadmin", "Usuarios", "people"], ["/mensajeria", "Mensajeria", "diagram-3"], ["/perfiladmin", "Mi perfil", "person"]].map(([path, label, icon]) =>
      <NavLink key={path} to={path} end><i className={`bi bi-${icon}`} />{label}</NavLink>)}
  </nav>
  <Link className="back-to-store" to="/"><i className="bi bi-arrow-left" />Volver a la tienda</Link>
</aside>;
export default function SidebarAdmin({ children }) {
  return <div className="admin-layout-container"><Sidebar /><div className="admin-main">{children}</div></div>;
}
