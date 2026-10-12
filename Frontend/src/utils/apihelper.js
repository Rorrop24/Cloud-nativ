import { apiFetch as fetch } from "../auth/apiFetch";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const BACKEND_URL = API_BASE_URL;
const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL || API_BASE_URL).replace(/\/$/, "");

export { API_BASE_URL, BACKEND_URL, GATEWAY_URL };

// Endpoints
export const API_USUARIOS = `${BACKEND_URL}/v2/usuarios`;
export const API_PRODUCTOS = `${GATEWAY_URL}/v2/productos`;
export const API_CATEGORIAS = `${BACKEND_URL}/v2/categorias`;
export const API_CARRITO = `${BACKEND_URL}/v2/carrito`;
export const API_BOLETAS = `${BACKEND_URL}/v2/boletas`;
export const API_IMAGENES = `${BACKEND_URL}/v2/imagenes`;
export const API_PEDIDOS_AMQP = `${BACKEND_URL}/api/pedidos`;
export const API_RABBITMQ_ADMIN = `${(import.meta.env.VITE_RABBIT_ADMIN_URL || "").replace(/\/$/, "")}/api/rabbitmq`;

export const getHeaders = () => {
  return {
    "Content-Type": "application/json",
  };
};

// ================= BFF & ESTADO =================

export const getBffHomeData = async () => {
  const response = await fetch(`${GATEWAY_URL}/bff/home-data`, { headers: getHeaders() });
  if (!response.ok) {
    throw new Error(`Error en BFF: ${response.status}`);
  }
  return await response.json();
};

export const sendOrderEvent = async (customerName) => {
  try {
    return await enviarPedidoAMQP(
      `ORDER-${Date.now()}`,
      `Evento de orden generado para cliente: ${customerName}`
    );
  } catch (error) {
    console.error("Error al enviar evento de orden:", error);
    return false;
  }
};

export const getOrderStatus = async () => {
  try {
    const resp = await fetch(`${BACKEND_URL}/v2/categorias/todas`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    return resp.ok ? { ok: true } : { ok: false, status: resp.status };
  } catch (error) {
    return { ok: false, error };
  }
};

// ================= RABBITMQ (PRODUCTOR & ADMIN) =================

export const enviarPedidoAMQP = async (idPedido, descripcion) => {
  try {
    const resp = await fetch(`${API_PEDIDOS_AMQP}/crear`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        cliente: idPedido,
        detalle: descripcion
      })
    });
    return resp.ok ? await resp.json() : null;
  } catch (error) {
    console.warn("[AMQP] Error al emitir mensaje a RabbitMQ:", error);
    return null;
  }
};

export const crearColaDinamica = async (queueName) => {
  const resp = await fetch(`${API_RABBITMQ_ADMIN}/queues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queueName, durable: true })
  });
  return await resp.json();
};

export const obtenerInfoCola = async (queueName) => {
  const resp = await fetch(`${API_RABBITMQ_ADMIN}/queues/${encodeURIComponent(queueName)}`, { headers: getHeaders() });
  return await resp.json();
};

// ================= USUARIOS & SINCRONIZACIÓN AZURE =================

export const sincronizarUsuarioAzure = async () => {
  try {
    const resp = await fetch(`${API_USUARIOS}/sync-azure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    if (!resp.ok) throw new Error("Fallo en sincronización con Oracle DB");

    const data = await resp.json();
    localStorage.setItem("usuario", JSON.stringify(data));
    localStorage.setItem("usuarioId", data.usuarioId);
    return data;
  } catch (error) {
    console.error("Error sincronizando usuario Azure:", error);
    throw error;
  }
};

export const loginUsuario = async (email, password) => {
  const resp = await fetch(`${API_USUARIOS}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!resp.ok) throw new Error("Credenciales incorrectas");

  const data = await resp.json();
  if (data.token) localStorage.setItem("token", data.token);
  if (data.usuario) {
    localStorage.setItem("usuario", JSON.stringify(data.usuario));
    localStorage.setItem("usuarioId", data.usuario.usuarioId);
  }
  return data.usuario;
};

export const crearUsuario = async (data) => {
  const resp = await fetch(`${API_USUARIOS}/crear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error("Error al crear usuario");
  return await resp.json();
};

export const getUsuarios = async () => {
  const resp = await fetch(`${API_USUARIOS}/todos`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject("Error al obtener usuarios");
};

export const getUsuarioPorId = async (usuarioId) => {
  const resp = await fetch(`${API_USUARIOS}/buscar/id/${usuarioId}`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject("Usuario no encontrado");
};

export const updateUsuario = async (data) => {
  const resp = await fetch(`${API_USUARIOS}/actualizar`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return resp.ok ? resp.json() : Promise.reject("Error al actualizar usuario");
};

export const deleteUsuario = async (usuarioId) => {
  const resp = await fetch(`${API_USUARIOS}/eliminar/id/${usuarioId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return resp.ok ? true : Promise.reject("Error al eliminar usuario");
};

// ================= PRODUCTOS =================

export const getProductos = async () => {
  const resp = await fetch(`${API_PRODUCTOS}/todos`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject("Error al obtener productos");
};

export const getProductoPorId = async (id) => {
  const resp = await fetch(`${API_PRODUCTOS}/buscar/id/${id}`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject("Producto no encontrado");
};

export const crearProducto = async (data) => {
  const resp = await fetch(`${API_PRODUCTOS}/crear`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return resp.ok ? resp.json() : Promise.reject("Error al crear producto");
};

export const updateProducto = async (id, data) => {
  const resp = await fetch(`${API_PRODUCTOS}/actualizar/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return resp.ok ? resp.json() : Promise.reject("Error al actualizar producto");
};

export const deleteProducto = async (id) => {
  const resp = await fetch(`${API_PRODUCTOS}/eliminar/id/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return resp.ok ? true : Promise.reject("Error al eliminar producto");
};

// ================= CATEGORÍAS =================

export const getCategorias = async () => {
  const resp = await fetch(`${API_CATEGORIAS}/todas`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject("Error al obtener categorías");
};

export const getCategoriaPorId = async (id) => {
  const resp = await fetch(`${API_CATEGORIAS}/buscar/id/${id}`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject("Categoría no encontrada");
};

export const getCategoriaPorNombre = async (nombre) => {
  const resp = await fetch(`${API_CATEGORIAS}/buscar/nombre/${nombre}`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject("Categoría no encontrada");
};

export const crearCategoria = async (data) => {
  const resp = await fetch(`${API_CATEGORIAS}/crear`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return resp.ok ? resp.json() : Promise.reject("Error al crear categoría");
};

export const updateCategoria = async (id, data) => {
  const resp = await fetch(`${API_CATEGORIAS}/actualizar/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return resp.ok ? resp.json() : Promise.reject("Error al actualizar categoría");
};

export const deleteCategoria = async (id) => {
  const resp = await fetch(`${API_CATEGORIAS}/eliminar/id/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return resp.ok ? true : Promise.reject("Error al eliminar categoría");
};

// ================= IMÁGENES =================

export const getImagenes = async () => {
  const resp = await fetch(`${API_IMAGENES}/todas`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject("Error al obtener imágenes");
};

export const getImagenesPorTipo = async (tipo) => {
  const resp = await fetch(`${API_IMAGENES}/tipo/${tipo}`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject(`Error al obtener imágenes tipo ${tipo}`);
};

export const getImagenPorId = async (id) => {
  const resp = await fetch(`${API_IMAGENES}/${id}`, { headers: getHeaders() });
  return resp.ok ? resp.json() : Promise.reject("Imagen no encontrada");
};

// ================= CARRITO =================

export const obtenerCarrito = async (usuarioId) => {
  if (!usuarioId) return { items: [] };
  try {
    const raw = localStorage.getItem(`carrito_${usuarioId}`);
    return { items: raw ? JSON.parse(raw) : [] };
  } catch {
    return { items: [] };
  }
};

export const agregarAlCarrito = async (usuarioId, productoInput, cantidad = 1) => {
  if (!usuarioId) throw new Error("Debes iniciar sesión para agregar al carrito");

  const productoId = typeof productoInput === "object" && productoInput !== null
    ? (productoInput.productoId ?? productoInput.id)
    : productoInput;

  const raw = localStorage.getItem(`carrito_${usuarioId}`);
  let items = raw ? JSON.parse(raw) : [];

  const index = items.findIndex((it) => (it.productoId ?? it.id) === productoId);

  if (index >= 0) {
    items[index].cantidad += Number(cantidad);
  } else {
    items.push({
      productoId: productoId,
      id: productoId,
      cantidad: Number(cantidad),
      ...(typeof productoInput === "object" && productoInput !== null ? productoInput : {}),
    });
  }

  localStorage.setItem(`carrito_${usuarioId}`, JSON.stringify(items));

  // Publicar evento informativo en RabbitMQ
  const nombreProd = productoInput?.nombre || productoId;
  enviarPedidoAMQP(
    `CART-${usuarioId}-${Date.now()}`,
    `Usuario ID ${usuarioId} agregó al carrito: ${nombreProd} (Cant: ${cantidad})`
  );

  return { items };
};

export const actualizarItemCarrito = async (usuarioId, itemId, cantidad) => {
  if (!usuarioId) return Promise.reject("Usuario no definido");

  const raw = localStorage.getItem(`carrito_${usuarioId}`);
  let items = raw ? JSON.parse(raw) : [];

  items = items.map((it) => {
    if ((it.productoId ?? it.id) === itemId) {
      return { ...it, cantidad: Number(cantidad) };
    }
    return it;
  });

  localStorage.setItem(`carrito_${usuarioId}`, JSON.stringify(items));
  return { items };
};

export const eliminarItemCarrito = async (usuarioId, itemId) => {
  if (!usuarioId) return Promise.reject("Usuario no definido");

  const raw = localStorage.getItem(`carrito_${usuarioId}`);
  let items = raw ? JSON.parse(raw) : [];

  items = items.filter((it) => (it.productoId ?? it.id) !== itemId);

  localStorage.setItem(`carrito_${usuarioId}`, JSON.stringify(items));
  return { items };
};

export const vaciarCarrito = async (usuarioId) => {
  if (!usuarioId) return false;
  localStorage.removeItem(`carrito_${usuarioId}`);
  return true;
};

// ================= BOLETAS =================

export const generarBoleta = async (usuarioId, itemsDirectos = null, simularFallo = false) => {
  if (!usuarioId) return Promise.reject("Usuario no definido");

  // Si se le pasan los items desde el componente los usa; si no, busca en el storage
  let itemsStorage = itemsDirectos;
  if (!itemsStorage || itemsStorage.length === 0) {
    const rawStorage =
      localStorage.getItem(`carrito_${usuarioId}`) ||
      localStorage.getItem("carrito");
    itemsStorage = rawStorage ? JSON.parse(rawStorage) : [];
  }

  if (!itemsStorage || itemsStorage.length === 0) {
    throw new Error("El carrito está vacío");
  }

  // Estructura requerida por BoletaController
  const payload = {
    usuarioId: Number(usuarioId),
    items: itemsStorage.map((it) => ({
      productoId: String(it.productoId || it.id),
      cantidad: Number(it.cantidad || 1),
      precioUnitario: Number(it.precioUnitario || it.precio || 0),
    })),
  };

  // 1. Guardar en Oracle Autonomous DB
  const resp = await fetch(`${API_BOLETAS}/generar`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(errorText || "Error al generar la boleta en Oracle");
  }

  const boletaGenerada = await resp.json();

  // 2. Notificar a RabbitMQ (pedidos.queue)
  const detalleAMQP = simularFallo
    ? `ERROR: Falla forzada en despacho para boleta ${boletaGenerada.id}`
    : `Boleta ${boletaGenerada.id} pagada exitosamente por un total de $${boletaGenerada.total}`;

  await enviarPedidoAMQP(`BOL-${boletaGenerada.id}`, detalleAMQP);

  // 3. Limpiar carrito
  localStorage.removeItem(`carrito_${usuarioId}`);
  localStorage.removeItem("carrito");

  return boletaGenerada;
};
// Simulación directa para inventario.queue -> inventario.dlq
export const enviarInventarioAMQP = async (idPedido, descripcion) => {
  try {
    const resp = await fetch(`${API_PEDIDOS_AMQP}/simular/inventario`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        cliente: idPedido,
        detalle: descripcion,
      }),
    });
    return resp.ok ? await resp.json() : null;
  } catch (error) {
    console.warn("[AMQP] Error al emitir mensaje a inventario:", error);
    return null;
  }
};

// Simulación directa para notificaciones.queue -> notificaciones.dlq
export const enviarNotificacionAMQP = async (idPedido, descripcion) => {
  try {
    const resp = await fetch(`${API_PEDIDOS_AMQP}/simular/notificaciones`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        cliente: idPedido,
        detalle: descripcion,
      }),
    });
    return resp.ok ? await resp.json() : null;
  } catch (error) {
    console.warn("[AMQP] Error al emitir mensaje a notificaciones:", error);
    return null;
  }
};
