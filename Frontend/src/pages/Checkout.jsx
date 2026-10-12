import { useNavigate } from "react-router-dom";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import {
  generarBoleta,
  enviarPedidoAMQP,
  enviarInventarioAMQP,
  enviarNotificacionAMQP,
} from "../utils/apihelper";

function Checkout({ carrito, onActualizarCantidad, onCompraExitosa }) {
  const navigate = useNavigate();

  const obtenerStock = (id, stockOriginal) => {
    const almacen = localStorage.getItem(`stock_${id}`);
    return almacen !== null ? Number(almacen) : stockOriginal;
  };

  const totalProductos = carrito.reduce((acc, p) => acc + p.cantidad, 0);
  const totalPrecio = carrito.reduce((acc, p) => {
    const precioFinal = p.descuento
      ? Math.round(p.precio * (1 - p.descuento / 100))
      : p.precio;
    return acc + p.cantidad * precioFinal;
  }, 0);

  // Obtiene el ID del usuario autenticado (ID 21 como valor de respaldo)
  const usuarioActivo =
    JSON.parse(localStorage.getItem("usuario")) ||
    JSON.parse(localStorage.getItem("usuarioActual")) ||
    {};
  const usuarioId =
    usuarioActivo.usuarioId ||
    usuarioActivo.id ||
    localStorage.getItem("usuarioId") ||
    21;

  // ================= PANEL DE PRUEBAS DE RESILIENCIA (DLQ / NACK) =================

  // 1. Falla en Pagos (pedidos.queue -> pedidos.dlq)
  const handleSimularFallaDLQ = async () => {
    try {
      Swal.fire({
        title: "Simulando Fallo de Pago...",
        text: "Enviando evento de pago rechazado a RabbitMQ para activar la DLQ",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await enviarPedidoAMQP(
        `PAY-FAIL-${Date.now()}`,
        `ERROR: Transacción bancaria rechazada para usuario ID ${usuarioId}. Simulación forzada para DLQ.`
      );

      Swal.fire({
        title: "¡Enviado a la DLQ!",
        text: "El backend aplicó basicNack en pedidos.queue. Mensaje en pedidos.dlq.",
        icon: "warning",
        confirmButtonColor: "#f39c12",
      });
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  // 2. Falla en Inventario (inventario.queue -> inventario.dlq)
  const handleSimularFallaInventario = async () => {
    try {
      Swal.fire({
        title: "Simulando Quiebre de Stock...",
        text: "Enviando evento a inventario.queue para activar su DLQ",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await enviarInventarioAMQP(
        `INV-FAIL-${Date.now()}`,
        `ERROR_STOCK: Inconsistencia física de bodega para usuario ID ${usuarioId}. Stock insuficiente.`
      );

      Swal.fire({
        title: "¡Rechazado a DLQ!",
        text: "El consumidor de inventario aplicó basicNack. Mensaje resguardado en inventario.dlq.",
        icon: "warning",
        confirmButtonColor: "#f39c12",
      });
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  // 3. Falla en Notificaciones (notificaciones.queue -> notificaciones.dlq)
  const handleSimularFallaNotificacion = async () => {
    try {
      Swal.fire({
        title: "Simulando Caída SMTP...",
        text: "Enviando evento a notificaciones.queue para activar su DLQ",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await enviarNotificacionAMQP(
        `NOTIF-FAIL-${Date.now()}`,
        `ERROR_NOTIFICACION: Timeout al conectar con servidor SMTP externo para usuario ID ${usuarioId}.`
      );

      Swal.fire({
        title: "¡Rechazado a DLQ!",
        text: "El consumidor de notificaciones aplicó basicNack. Mensaje resguardado en notificaciones.dlq.",
        icon: "warning",
        confirmButtonColor: "#f39c12",
      });
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  return (
    <>
      <Navbar />

      <div className="container py-5">
        <h2 className="mb-4 text-center">Checkout</h2>

        {carrito.length === 0 ? (
          <p className="text-center text-muted">Tu carrito está vacío</p>
        ) : (
          <div className="row g-4">
            <div className="col-lg-8">
              {carrito.map((p) => {
                const precioFinal = p.descuento
                  ? Math.round(p.precio * (1 - p.descuento / 100))
                  : p.precio;
                const stockActual = obtenerStock(p.id, p.stock);

                return (
                  <div
                    key={p.id}
                    className="card mb-3 shadow-sm d-flex flex-row align-items-center p-2"
                  >
                    <img
                      src={p.imagen}
                      alt={p.nombre}
                      style={{
                        width: 80,
                        height: 80,
                        objectFit: "contain",
                        marginRight: 15,
                      }}
                    />
                    <div className="flex-grow-1">
                      <h5 className="mb-1">{p.nombre}</h5>
                      {p.descuento > 0 && (
                        <span className="badge bg-danger mb-1">
                          -{p.descuento}%
                        </span>
                      )}
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() =>
                            onActualizarCantidad(p.id, p.cantidad - 1)
                          }
                          disabled={p.cantidad <= 1}
                        >
                          -
                        </button>
                        <span className="fw-bold">{p.cantidad}</span>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() =>
                            onActualizarCantidad(
                              p.id,
                              Math.min(p.cantidad + 1, stockActual)
                            )
                          }
                          disabled={p.cantidad >= stockActual}
                        >
                          +
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => onActualizarCantidad(p.id, 0)}
                        >
                          🗑
                        </button>
                      </div>
                      <small className="text-muted">
                        Stock disponible: {stockActual}
                      </small>
                    </div>
                    <div className="fw-bold">
                      ${(precioFinal * p.cantidad).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="col-lg-4">
              <div className="card shadow-sm p-3">
                <h4 className="mb-3">Resumen del pedido</h4>
                <p>
                  Total productos: <strong>{totalProductos}</strong>
                </p>
                <p>
                  Total a pagar: <strong>${totalPrecio.toLocaleString()}</strong>
                </p>

                <PayPalScriptProvider
                  options={{
                    "client-id":
                      "AdPk7nylxq-_Cjepu-zLtkRcs6MXPi9RkPJ6MOJKGA-5hF9IHIy-WCsEc5y0NHnSXUb5H_bsZMkIWauw",
                    currency: "USD",
                    intent: "capture",
                  }}
                >
                  <PayPalButtons
                    style={{
                      layout: "vertical",
                      color: "blue",
                      shape: "rect",
                      label: "paypal",
                    }}
                    createOrder={(data, actions) => {
                      const calculoUSD = totalPrecio / 900;
                      const valorFinalUSD =
                        calculoUSD >= 1 ? calculoUSD.toFixed(2) : "1.00";

                      return actions.order.create({
                        purchase_units: [
                          {
                            amount: {
                              currency_code: "USD",
                              value: valorFinalUSD,
                            },
                          },
                        ],
                      });
                    }}
                    onApprove={async (data, actions) => {
                      try {
                        const order = await actions.order.capture();

                        // 1. Guardar la boleta en Oracle DB y emitir eventos concurrentes
                        const boletaBD = await generarBoleta(usuarioId, carrito, false);

                        // 2. Preparar los datos para la vista /boleta
                        const items = carrito.map((p) => {
                          const precioFinal = p.descuento
                            ? Math.round(p.precio * (1 - p.descuento / 100))
                            : p.precio;

                          return {
                            id: p.id,
                            nombre: p.nombre,
                            cantidad: p.cantidad,
                            precioUnitario: precioFinal,
                            subtotal: precioFinal * p.cantidad,
                            imagen: p.imagen,
                          };
                        });

                        const boleta = {
                          id: boletaBD.id,
                          idTransaccionPayPal: order.id || data.orderID,
                          fecha: new Date().toISOString(),
                          items,
                          totalProductos,
                          totalPrecio,
                          payer: order.payer || null,
                        };

                        localStorage.setItem("ultimaBoleta", JSON.stringify(boleta));

                        const todasBoletas =
                          JSON.parse(localStorage.getItem("boletas")) || [];
                        todasBoletas.push({
                          ...boleta,
                          email: usuarioActivo.email,
                        });
                        localStorage.setItem("boletas", JSON.stringify(todasBoletas));

                        if (onCompraExitosa) onCompraExitosa();

                        Swal.fire({
                          title: "¡Compra exitosa!",
                          text: `Boleta N° ${boletaBD.id} registrada en Oracle y procesada concurrentemente por RabbitMQ.`,
                          icon: "success",
                          confirmButtonText: "Ver boleta",
                          confirmButtonColor: "#3085d6",
                        }).then(() => {
                          navigate("/boleta");
                        });
                      } catch (err) {
                        console.error("Error al procesar boleta en backend:", err);
                        Swal.fire({
                          title: "Error al registrar compra",
                          text: err.message || "Fallo en el servicio de pagos.",
                          icon: "error",
                          confirmButtonText: "Aceptar",
                          confirmButtonColor: "#d33",
                        });
                      }
                    }}
                    onCancel={async () => {
                      await enviarPedidoAMQP(
                        `PAY-CANCEL-${Date.now()}`,
                        `ERROR: Usuario ID ${usuarioId} canceló el flujo de pago en PayPal.`
                      );

                      Swal.fire({
                        title: "Pago cancelado",
                        text: "Cancelaste la operación. Se registró el evento en auditoría (DLQ).",
                        icon: "warning",
                        confirmButtonText: "Aceptar",
                        confirmButtonColor: "#f39c12",
                      });
                    }}
                    onError={async (err) => {
                      console.error("Error en PayPal:", err);

                      await enviarPedidoAMQP(
                        `PAY-ERR-${Date.now()}`,
                        `ERROR: Fallo en pasarela PayPal para usuario ID ${usuarioId}. Detalle: ${err?.message || "Timeout"}`
                      );

                      Swal.fire({
                        title: "Pago rechazado",
                        text: "Hubo un error con la pasarela. Se envió el evento a la DLQ.",
                        icon: "error",
                        confirmButtonText: "Reintentar",
                        confirmButtonColor: "#d33",
                      });
                    }}
                  />
                </PayPalScriptProvider>

                {/* PANEL DE PRUEBAS DE RESILIENCIA (EVIDENCIA EVALUACIÓN EP2) */}
                <div className="border border-secondary rounded p-2 mt-3 bg-dark">
                  <small className="text-muted d-block text-center mb-2 fw-bold">
                    Demostración de Tolerancia a Fallos (DLQ)
                  </small>

                  <button
                    className="btn btn-outline-danger btn-sm w-100 mb-1"
                    onClick={handleSimularFallaDLQ}
                  >
                    ⚠️ 1. Falla de Pago (pedidos.queue)
                  </button>

                  <button
                    className="btn btn-outline-warning btn-sm w-100 mb-1"
                    onClick={handleSimularFallaInventario}
                  >
                    📦 2. Quiebre de Stock (inventario.queue)
                  </button>

                  <button
                    className="btn btn-outline-info btn-sm w-100 mb-2"
                    onClick={handleSimularFallaNotificacion}
                  >
                    ✉️ 3. Caída SMTP (notificaciones.queue)
                  </button>
                </div>

                <button
                  className="btn btn-secondary w-100 mt-2"
                  onClick={() => navigate(-1)}
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}

export default Checkout;