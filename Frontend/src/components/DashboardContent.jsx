import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getProductos, getUsuarios } from "../utils/apihelper";

export default function DashboardContent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError(""); setData(null);
    try {
      const [productos, usuarios] = await Promise.all([getProductos(), getUsuarios()]);
      setData({ productos, usuarios });
    } catch { setError("No pudimos cargar las metricas. Verifica la conexion y tus permisos."); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const critical = data?.productos.filter((p) => Number(p.stock) <= (p.stockCritico || 5)) || [];
  return <>
    <div className="admin-page-heading"><div><span className="eyebrow">ADMINISTRACION</span><h1>Resumen</h1><p>Catalogo, inventario y usuarios.</p></div><button className="icon-button" title="Actualizar" aria-label="Actualizar metricas" onClick={load}><i className="bi bi-arrow-clockwise" /></button></div>
    {error && <div className="admin-alert" role="alert">{error}<button className="text-link" onClick={load}>Reintentar</button></div>}
    {!data && !error && <p className="admin-loading" role="status">Cargando metricas...</p>}
    <div className="admin-metrics">
      {[["Productos", data?.productos.length, "En el catalogo"], ["Inventario", data?.productos.reduce((sum, p) => sum + Number(p.stock || 0), 0), "Unidades disponibles"], ["Usuarios", data?.usuarios.length, "Cuentas registradas"]].map(([name, value, detail]) =>
        <div className="admin-metric" key={name}><span>{name}</span><strong>{value == null ? "--" : value.toLocaleString("es-CL")}</strong><small>{detail}</small></div>)}
    </div>
    <section className="admin-section"><div className="admin-page-heading"><h2>Stock bajo</h2><Link className="text-link" to="/productosadmin">Ver productos<i className="bi bi-arrow-right" /></Link></div>
      <div className="table-scroll"><table className="admin-table"><thead><tr><th>Producto</th><th>Categoria</th><th>Disponibles</th><th>Estado</th></tr></thead>
        <tbody>{critical.map((p) => <tr key={p.id}><td>{p.nombre}</td><td>{p.categoria?.nombre || "--"}</td><td>{p.stock}</td><td><span className="status-pill warning">{p.stock > 0 ? "Stock bajo" : "Agotado"}</span></td></tr>)}
          {!critical.length && <tr><td colSpan="4">{data ? "Sin productos con stock bajo." : "Metricas no disponibles."}</td></tr>}</tbody></table></div>
    </section>
    <section className="admin-section"><h2>Mensajeria</h2><Link className="btn btn-accent" to="/mensajeria"><i className="bi bi-diagram-3" />Abrir mensajeria</Link></section>
  </>;
}
