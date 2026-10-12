import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ProductoCard from "./ProductoCard";
import Footer from "./Footer";

const collections = [
  { name: "Consolas", image: "https://images.unsplash.com/photo-1486401899868-0e435ed85128?auto=format&fit=crop&w=700&q=80" },
  { name: "Teclados", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=700&q=80" },
  { name: "Audifonos", image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=700&q=80" },
];

export default function Catalogo({ productos = [], categorias = [], usuario, onAgregarCarrito, loading, error, onRetry, mode = "catalogo" }) {
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState("relevancia");
  const [available, setAvailable] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [notice, setNotice] = useState("");
  const query = params.get("q") || "";
  const category = params.get("categoria") || "Todas";
  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === "Todas") next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };
  const categoryNames = [...new Set([...categorias.map((c) => c.nombre), ...productos.map((p) => p.categoria?.nombre)].filter((name) => name && name !== "Todas"))];
  const filtered = useMemo(() => {
    const result = productos.filter((p) =>
      (mode !== "ofertas" || Number(p.descuento) > 0 || p.oferta)
      && (!query || p.nombre?.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")))
      && (category === "Todas" || p.categoria?.nombre === category)
      && (!available || p.stock > 0)
      && (!maxPrice || Number(p.precio) * (1 - Number(p.descuento || 0) / 100) <= Number(maxPrice)));
    const price = (p) => Number(p.precio) * (1 - Number(p.descuento || 0) / 100);
    if (sort === "menor") result.sort((a, b) => price(a) - price(b));
    if (sort === "mayor") result.sort((a, b) => price(b) - price(a));
    if (sort === "nombre") result.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return result;
  }, [productos, query, category, available, maxPrice, sort, mode]);

  const add = async (producto) => {
    const result = await onAgregarCarrito(producto);
    if (result) setNotice(`${producto.nombre} agregado al carrito.`);
  };
  return <>
    <main className="container catalog-page">
      <div className="catalog-heading">
        <div><span className="eyebrow">{mode === "home" ? "TIENDA ONLINE" : "PUNTO GAMER"}</span>
          <h1>{mode === "home" ? "Punto Gamer" : mode === "ofertas" ? "Ofertas" : category === "Todas" ? "Catalogo" : category}</h1>
          <p>{mode === "ofertas" ? "Productos con descuento." : "Consolas, perifericos y accesorios."}</p></div>
        {mode === "home" && <Link to="/categoria" className="text-link">Todo el catalogo<i className="bi bi-arrow-right" /></Link>}
      </div>
      {mode === "home" && <section className="collection-grid" aria-label="Colecciones">
        {collections.map((collection) => <Link key={collection.name} className="collection-item" to={`/categoria?categoria=${encodeURIComponent(collection.name)}`}>
          <img src={collection.image} alt={collection.name} />
          <span>{collection.name}<i className="bi bi-arrow-up-right" /></span>
        </Link>)}
      </section>}
      <div className="catalog-toolbar">
        <h2>{mode === "home" ? "Explora el catalogo" : "Productos"}<span>{loading || error ? "" : filtered.length}</span></h2>
        <label className="sort-control">Ordenar por<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevancia">Relevancia</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option><option value="nombre">Nombre</option></select></label>
      </div>
      <div className="catalog-layout">
        <aside className="catalog-filters" aria-label="Filtros del catalogo">
          <h3>Filtros</h3>
          <label htmlFor="catalog-query">Buscar</label><div className="filter-search"><i className="bi bi-search" /><input id="catalog-query" value={query} onChange={(event) => updateParam("q", event.target.value)} placeholder="Nombre del producto" /></div>
          <label htmlFor="catalog-category">Categoria</label><select id="catalog-category" value={category} onChange={(event) => updateParam("categoria", event.target.value)}><option>Todas</option>{[...new Set([...categoryNames, ...(category !== "Todas" ? [category] : [])])].map((name) => <option key={name}>{name}</option>)}</select>
          <label htmlFor="max-price">Precio maximo (CLP)</label><input id="max-price" type="number" min="0" step="1000" placeholder="Sin limite" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
          <label className="filter-check"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />Solo disponibles</label>
          <button className="text-link reset-filters" onClick={() => { setParams({}); setAvailable(false); setMaxPrice(""); }}><i className="bi bi-arrow-counterclockwise" />Limpiar filtros</button>
        </aside>
        <section className="catalog-results" aria-label="Productos">
          {notice && <div className="catalog-notice" role="status">{notice}<button className="icon-button" aria-label="Cerrar aviso" onClick={() => setNotice("")}><i className="bi bi-x" /></button></div>}
          {loading ? <div className="product-grid" aria-label="Cargando productos">{[1, 2, 3].map((i) => <div className="product-skeleton" key={i}><div /><span /><span /></div>)}</div>
            : error ? <div className="empty-state" role="alert"><i className="bi bi-cloud-slash" /><h3>El catalogo no esta disponible</h3><p>{error}</p><button className="btn btn-accent" onClick={onRetry}><i className="bi bi-arrow-clockwise" />Reintentar</button></div>
              : filtered.length ? <div className="product-grid">{filtered.map((p) => <ProductoCard key={p.id} producto={p} usuario={usuario} onAgregarCarrito={add} />)}</div>
                : <div className="empty-state"><i className="bi bi-search" /><h3>No encontramos productos</h3><p>Prueba con otra categoria o ajusta la busqueda.</p></div>}
        </section>
      </div>
    </main>
    <Footer />
  </>;
}
