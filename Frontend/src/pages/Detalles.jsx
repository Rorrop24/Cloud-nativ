import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Especificacion from "../components/Especificacion";
import Resenia from "../components/Resenia";
import Footer from "../components/Footer";
import ReseniaForm from "../components/ReseniaForm";
import { apiFetch as fetch } from "../auth/apiFetch";
import { BACKEND_URL, API_PRODUCTOS } from "../utils/apihelper";

export default function Detalles({ usuario, onAgregarCarrito }) {
  const location = useLocation();
  const productoId = location.state?.productoId; // viene de navigate
  const [producto, setProducto] = useState(null);
  const [resenias, setResenias] = useState([]);
  const [stock, setStock] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productoId) return;

    const fetchProducto = async () => {
      try {
        // 1️⃣ Obtener producto
        const resProducto = await fetch(`${API_PRODUCTOS}/buscar/id/${productoId}`);
        if (!resProducto.ok) throw new Error("Producto no encontrado");
        const p = await resProducto.json();
        setProducto(p);
        setStock(p.stock);

        // 2️⃣ Obtener reseñas
        const resResenias = await fetch(`${BACKEND_URL}/v2/resenias/producto/${p.id}`);
        if (resResenias.ok) {
          const resData = await resResenias.json();
          setResenias(resData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducto();
  }, [productoId]);

  if (loading) return <p>Cargando producto...</p>;
  if (!producto) return <p>Producto no encontrado</p>;

  // Precio final
  let precioFinal = producto.precio;
  const descuento = producto.descuento || 0;
  const tieneDescuento = descuento > 0 || usuario?.esDuoc;
  if (descuento > 0) precioFinal = Math.round(precioFinal * (1 - descuento / 100));
  if (usuario?.esDuoc) precioFinal = Math.round(precioFinal * 0.8);

  // Agregar al carrito
  const handleAgregar = () => {
    if (stock <= 0) return;
    onAgregarCarrito(producto.id, 1);
    setStock(prev => Math.max(prev - 1, 0));
  };

  // Agregar reseña a la base de datos
  const handleAgregarResenia = async (resenaParcial) => {
    if (!usuario) return;

    const nuevaResena = {
      producto: { id: producto.id },
      usuario: { usuarioId: usuario.usuarioId },
      texto: resenaParcial.texto,
      calificacion: resenaParcial.calificacion
    };

    try {
      const res = await fetch(`${BACKEND_URL}/v2/resenias/crear/${producto.id}/${usuario.usuarioId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaResena)
      });
      if (!res.ok) throw new Error("Error al enviar reseña");
      const resCreada = await res.json();
      setResenias(prev => [...prev, resCreada]);
    } catch (error) {
      console.error(error);
    }
  };

  const srcImg = producto.imagen || "/img/default.png";

  return (
    <>
      <div className="container mt-4">
        <div className="row align-items-start">
          <div className="col-md-5 text-center mb-3">
            <img
              src={srcImg}
              alt={producto.nombre}
              referrerPolicy="no-referrer"
              className="img-fluid rounded"
              style={{ maxHeight: 400, objectFit: "contain" }}
            />
          </div>
          <div className="col-md-7">
            <h2 className="mb-1">{producto.nombre}</h2>
            <p className="text-secondary mb-2">{producto.categoria?.nombre || ""}</p>
            <p>{producto.descripcion}</p>

            <Especificacion detalles={producto.detalles} />

            <p className="price mb-3">
              {descuento > 0 && (
                <span className="text-secondary text-decoration-line-through me-2">
                  ${producto.precio.toLocaleString()}
                </span>
              )}
              <span className={tieneDescuento ? "text-danger" : "text-success"}>
                ${precioFinal.toLocaleString()}
              </span>
              {descuento > 0 && <span className="badge bg-success ms-2">-{descuento}%</span>}
            </p>

            <p className={stock > 0 ? "text-success" : "text-danger"}>
              {stock > 0
                ? `${stock} unidad${stock !== 1 ? "es" : ""} disponible${stock !== 1 ? "s" : ""}`
                : "Agotado"}
            </p>

            <button
              className="btn btn-accent w-100"
              onClick={handleAgregar}
              disabled={stock === 0}
            >
              Agregar al carrito
            </button>
          </div>
        </div>

        <div className="mt-5">
          <ReseniaForm usuario={usuario} onAgregarReseña={handleAgregarResenia} />
          <Resenia resenias={resenias} />
        </div>
      </div>
      <Footer />
    </>
  );
}
