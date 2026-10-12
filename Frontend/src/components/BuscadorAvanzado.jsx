import { useState, useRef, useEffect } from "react";

export default function BuscadorAvanzado({ categorias = [], onFilter }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const contenedorRef = useRef(null);

  // Eliminar duplicados de categorías por nombre
  const categoriasUnicas = [...new Map(categorias.map(c => [c.nombre, c])).values()];

  const aplicarFiltros = () => {
    const filtros = {
      q: q.trim(),
      cat: cat.trim(),
      min: Number(min) || 0,
      max: Number(max) || Infinity,
    };
    onFilter(filtros);
  };

  const limpiarFiltros = () => {
    setQ("");
    setCat("Todas");
    setMin("");
    setMax("");
    onFilter({ q: "", cat: "Todas", min: 0, max: Infinity });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* Botón flotante */}
      <button
        className="btn btn-accent buscador-flotante"
        onClick={() => setAbierto(!abierto)}
      >
        <i className="bi bi-search"></i>
      </button>

      {/* Contenedor del buscador */}
      <div
        ref={contenedorRef}
        className={`buscador-contenido-flotante ${abierto ? "activo" : ""}`}
      >
        <h5 className="orbitron mb-3">Búsqueda avanzada</h5>
        <div className="row g-2 align-items-end">
          <div className="col-12">
            <label className="form-label">Palabra clave</label>
            <input
              className="form-control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej. PlayStation, ROG, mouse"
            />
          </div>

          <div className="col-12">
            <label className="form-label">Categoría</label>
            <select
              className="form-select"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              <option value="Todas">Todas</option>
              {categoriasUnicas
                .filter((c) => c.nombre !== "Todas")
                .map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div className="col-12">
            <label className="form-label">Rango de precio (CLP)</label>
            <div className="d-flex gap-2">
              <input
                type="number"
                className="form-control"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="Mín"
                min="0"
              />
              <input
                type="number"
                className="form-control"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="Máx"
                min="0"
              />
              <button className="btn btn-accent" onClick={aplicarFiltros}>
                <i className="bi bi-funnel"></i>
              </button>
              <button className="btn btn-outline-light" onClick={limpiarFiltros}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .buscador-flotante {
          position: fixed;
          top: 80px;
          right: 20px;
          z-index: 1050;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .buscador-contenido-flotante {
          position: fixed;
          top: 140px;
          right: 20px;
          width: 300px;
          background: #111;
          padding: 15px;
          border-radius: 10px;
          box-shadow: 0 5px 15px rgba(0,0,0,0.3);
          opacity: 0;
          transform: translateY(-20px);
          pointer-events: none;
          transition: all 0.3s ease;
          z-index: 1040;
        }

        .buscador-contenido-flotante.activo {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .buscador-contenido-flotante input,
        .buscador-contenido-flotante select,
        .buscador-contenido-flotante button {
          margin-bottom: 5px;
        }
      `}</style>
    </>
  );
}
