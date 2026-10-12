import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import Swal from "sweetalert2";
import "./App.css";
import {
  getProductos,
  getCategorias,
  agregarAlCarrito,
  obtenerCarrito,
  actualizarItemCarrito,
  eliminarItemCarrito,
  BACKEND_URL
} from "./utils/apihelper";

import Navbar from "./components/Navbar";
import CarritoSidebar from "./components/CarritoSidebar";
import BotonWsp from "./components/BotonWsp";
import Mensajeria from "./pages/Mensajeria";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Categoria from "./pages/Categoria";
import Ofertas from "./pages/Ofertas";
import Nosotros from "./pages/Nosotros";
import Blog from "./pages/Blog";
import Eventos from "./pages/Eventos";
import Soporte from "./pages/Soporte";
import Detalles from "./pages/Detalles";
import Termino from "./pages/Termino";
import Privacidad from "./pages/Privacidad";
import Checkout from "./pages/Checkout";
import Carro from "./pages/Carro";
import Boleta from "./pages/Boleta";
import Perfil from "./pages/Perfil";
import ProteccionUser from "./components/ProteccionUser";
import AdminGuard from "./auth/AdminGuard";
import HomeAdmin from "./pages/Homeadmin";
import PerfilAdmin from "./pages/Perfiladmin";
import CategoriaAdmin from "./pages/Categoria_admin";
import EditarProducto from "./pages/EditarProducto";
import EditarUser from "./pages/Editaruser";
import NuevoProducto from "./pages/NuevoProducto";
import NuevoUsuario from "./pages/NuevoUsuario";
import Productosadmin from "./pages/Productosadmin";
import Usuariosadmin from "./pages/Usuariosadmin";

// Helper robusto para extraer la información de usuario contemplando estructuras con Tenant
const obtenerUsuarioLS = () => {
  try {
    const stored = localStorage.getItem("usuario");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.usuario || parsed?.user || parsed?.data || parsed;
  } catch (e) {
    console.error("Error al parsear el usuario de localStorage:", e);
    return null;
  }
};

function Layout() {
  const location = useLocation();
  const [carritoOpen, setCarritoOpen] = useState(false);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  // Estado de usuario tolerante a Tenant
  const [usuario, setUsuario] = useState(() => obtenerUsuarioLS());

  // Escuchar cambios de usuario en localStorage
  useEffect(() => {
    const handleUsuarioCambiado = () => {
      setUsuario(obtenerUsuarioLS());
    };
    window.addEventListener("usuarioCambiado", handleUsuarioCambiado);
    return () => window.removeEventListener("usuarioCambiado", handleUsuarioCambiado);
  }, []);

  const fetchData = useCallback(async () => {
      setLoading(true);
      setCatalogError("");
      try {
        const [productosAPI, categoriasAPI] = await Promise.all([getProductos(), getCategorias()]);
        if (!Array.isArray(productosAPI)) throw new Error("Respuesta de catalogo invalida");
        setProductos(productosAPI);

        const cats = Array.isArray(categoriasAPI)
          ? [{ id: 0, nombre: "Todas" }, ...categoriasAPI.map((c) => ({ id: c.id, nombre: c.nombre }))]
          : [{ id: 0, nombre: "Todas" }];
        setCategorias(cats);
      } catch (error) {
        console.error("Error cargando productos o categorías:", error);
        setProductos([]);
        setCategorias([{ id: 0, nombre: "Todas" }]);
        setCatalogError("No pudimos conectar con la tienda. Vuelve a intentarlo en unos momentos.");
      } finally {
        setLoading(false);
      }
    }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const normalizarCarrito = (items = [], productosAPI = []) => {
  return items.map((item) => {
    const rawId = String(item.productoId ?? item.id ?? "");
    
    // Búsqueda tolerante a mayúsculas/minúsculas y tipos
    const prod =
      item.producto ||
      productosAPI.find(
        (p) => String(p.id).trim().toLowerCase() === rawId.trim().toLowerCase()
      ) ||
      {};

    // Extraer la ruta cruda de la imagen
    let imgPath = item.imagen || prod.imagen || "";

    // Si viene solo el nombre del archivo (ej: "KB001.jpg"), anteponer la ruta del backend si aplica
    if (imgPath && !imgPath.startsWith("http") && !imgPath.startsWith("data:") && !imgPath.startsWith("/")) {
      imgPath = `${BACKEND_URL}/v2/imagenes/${imgPath}`;
    }

    return {
      ...item,
      productoId: rawId || prod.id,
      producto: prod,
      nombre: item.nombre || prod.nombre || "Producto sin nombre",
      precio: Number(item.precio ?? prod.precio ?? 0),
      descuento: Number(item.descuento ?? prod.descuento ?? 0),
      stock: Number(item.stock ?? prod.stock ?? 0),
      cantidad: Number(item.cantidad ?? 1),
      imagen: imgPath || "/placeholder.png",
    };
  });
};
  // Cargar carrito del usuario
  useEffect(() => {
    const usuarioActivo = usuario || obtenerUsuarioLS();
    const idUsuario = usuarioActivo?.usuarioId || usuarioActivo?.id || usuarioActivo?.userId;

    if (idUsuario) {
      const fetchCarrito = async () => {
        try {
          const carritoData = await obtenerCarrito(idUsuario);
          const productosAPI = await getProductos();

          const items = Array.isArray(carritoData)
            ? carritoData
            : Array.isArray(carritoData?.items)
            ? carritoData.items
            : [];

          setCarrito(normalizarCarrito(items, productosAPI));
        } catch (err) {
          console.error("Error al obtener carrito:", err);
          setCarrito([]);
        }
      };
      fetchCarrito();
    } else {
      setCarrito([]);
    }
  }, [usuario]);

  const handleAgregarCarrito = async (producto) => {
      const usuarioActivo = usuario || obtenerUsuarioLS();

      if (!usuarioActivo) {
        await Swal.fire({ icon: "info", title: "Inicia sesion", text: "Accede a tu cuenta para agregar productos al carrito." });
        return false;
      }

      if (producto.stock <= 0) {
        return false;
      }

      const targetUserId = usuarioActivo.usuarioId || usuarioActivo.id || usuarioActivo.userId;
      if (!targetUserId) {
        await Swal.fire({ icon: "warning", title: "Cuenta pendiente", text: "Vuelve a iniciar sesion para sincronizar tu cuenta." });
        return false;
      }
      const targetProductoId = producto.id || producto.productoId;

      try {
        const carritoActualizado = await agregarAlCarrito(targetUserId, { ...producto, id: targetProductoId }, 1);
        const items = carritoActualizado.items || [];
        setCarrito(normalizarCarrito(items, productos));

        // NOTA: Se eliminó el setProductos((prev) => prev.map(...)) de aquí

        return true;
      } catch (error) {
        console.error("Error agregando al carrito:", error);
        await Swal.fire({ icon: "error", title: "No pudimos agregar el producto", text: "Vuelve a intentarlo." });
        return false;
      }
    };

  // Actualizar cantidad en el carrito
const actualizarCantidadCarrito = async (productoId, nuevaCantidad) => {
    try {
      if (nuevaCantidad < 1) {
        return eliminarItemDelCarrito(productoId);
      }

      const usuarioActivo = usuario || obtenerUsuarioLS();
      const targetUserId = usuarioActivo?.usuarioId || usuarioActivo?.id || usuarioActivo?.userId || 1;
      
      const carritoActualizado = await actualizarItemCarrito(targetUserId, productoId, nuevaCantidad);
      setCarrito(normalizarCarrito(carritoActualizado.items || [], productos));

      // NOTA: Se eliminó el setProductos de aquí
    } catch (error) {
      console.error("Error al actualizar cantidad:", error);
    }
  };

  // Eliminar producto del carrito
const eliminarItemDelCarrito = async (productoId) => {
    try {
      const usuarioActivo = usuario || obtenerUsuarioLS();
      const targetUserId = usuarioActivo?.usuarioId || usuarioActivo?.id || usuarioActivo?.userId || 1;
      
      const carritoActualizado = await eliminarItemCarrito(targetUserId, productoId);
      setCarrito(normalizarCarrito(carritoActualizado.items || [], productos));

      // NOTA: Se eliminó el setProductos de aquí
    } catch (error) {
      console.error("Error al eliminar item:", error);
    }
  };

  // Filtrado de productos
  const catalogProps = { productos, categorias, usuario, onAgregarCarrito: handleAgregarCarrito, loading, error: catalogError, onRetry: fetchData };

  const hideNavbarRoutes = ["/checkout", "/boleta"];
  const adminPaths = ["/homeadmin", "/mensajeria", "/perfiladmin", "/categoria_admin", "/editarproducto", "/editaruser", "/nuevoproducto", "/nuevousuario", "/productosadmin", "/usuariosadmin"];
  const shouldShowNavbar = !hideNavbarRoutes.includes(location.pathname) && !adminPaths.some((path) => location.pathname.startsWith(path));
  const shouldShowBotonWsp = shouldShowNavbar;

  return (
    <>
      {shouldShowNavbar && (
        <>
          <Navbar
            cantidad={carrito.reduce((acc, item) => acc + item.cantidad, 0)}
            abrirCarrito={() => setCarritoOpen(true)}
            usuario={usuario}
          />

        </>
      )}

      <CarritoSidebar
        abierto={carritoOpen}
        cerrar={() => setCarritoOpen(false)}
        carrito={carrito}
        onActualizarCantidad={actualizarCantidadCarrito}
        onEliminarItem={eliminarItemDelCarrito}
      />

      <Routes>
        <Route element={<AdminGuard />}>
        <Route path="/homeadmin" element={<HomeAdmin usuario={usuario} />} />
        <Route path="/mensajeria" element={<Mensajeria />} />
        <Route path="/perfiladmin" element={<PerfilAdmin />} />
        <Route path="/categoria_admin" element={<CategoriaAdmin />} />
        <Route path="/editarproducto" element={<EditarProducto />} />
        <Route path="/editaruser" element={<EditarUser />} />
        <Route path="/nuevoproducto" element={<NuevoProducto />} />
        <Route path="/nuevousuario" element={<NuevoUsuario />} />
        <Route path="/productosadmin" element={<Productosadmin />} />
        <Route path="/usuariosadmin" element={<Usuariosadmin />} />
        </Route>

        <Route path="/" element={<Home {...catalogProps} />} />
        <Route path="/categoria" element={<Categoria {...catalogProps} />} />
        <Route path="/ofertas" element={<Ofertas {...catalogProps} />} />

        <Route path="/auth" element={<Auth onUsuarioChange={setUsuario} />} />
        <Route path="/nosotros" element={<Nosotros />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/eventos" element={<Eventos />} />
        <Route path="/soporte" element={<Soporte usuario={usuario} />} />
        <Route path="/detalles" element={<Detalles usuario={usuario} onAgregarCarrito={handleAgregarCarrito} />} />
        <Route path="/carro" element={<Carro carrito={carrito} onActualizarCantidad={actualizarCantidadCarrito} onEliminarItem={eliminarItemDelCarrito} />} />
        <Route
          path="/checkout"
          element={
            <ProteccionUser usuario={usuario}>
              <Checkout carrito={carrito} onActualizarCantidad={actualizarCantidadCarrito} onCompraExitosa={() => setCarrito([])} />
            </ProteccionUser>
          }
        />
        <Route path="/boleta" element={<Boleta />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/termino" element={<Termino />} />
        <Route path="/privacidad" element={<Privacidad />} />
      </Routes>

      {shouldShowBotonWsp && <BotonWsp />}
    </>
  );
}

export default Layout;
