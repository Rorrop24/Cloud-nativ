import { API_RABBITMQ_ADMIN, API_PEDIDOS_AMQP, getHeaders } from "../utils/apihelper";
import { apiFetch as fetch } from "../auth/apiFetch";

async function request(path, options = {}, base = API_RABBITMQ_ADMIN) {
  const response = await fetch(`${base}${path}`, { ...options, headers: getHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.detail || (response.status === 401
      ? "Inicia sesion para acceder a mensajeria."
      : response.status === 403 ? "Necesitas el rol Rabbit.Admin."
        : `No se pudo completar la operacion (${response.status}).`));
  }
  return response.status === 204 ? null : response.json();
}

export const obtenerTopologia = () => request("/topology");
export const crearColaDinamica = (queueName) => request("/queues", {
  method: "POST", body: JSON.stringify({ queueName, durable: true }),
});
export const obtenerInfoCola = (name) => request(`/queues/${encodeURIComponent(name)}`);
export const eliminarCola = (name) => request(`/queues/${encodeURIComponent(name)}`, { method: "DELETE" });
export const crearExchange = (exchangeName) => request("/exchanges", {
  method: "POST", body: JSON.stringify({ exchangeName, type: "direct", durable: true }),
});
export const eliminarExchange = (name) => request(`/exchanges/${encodeURIComponent(name)}`, { method: "DELETE" });
export const crearBinding = (binding) => request("/bindings", { method: "POST", body: JSON.stringify(binding) });
export const eliminarBinding = (binding) => request("/bindings", { method: "DELETE", body: JSON.stringify(binding) });
export const enviarEvento = (domain, cliente, detalle) => request(
  domain === "pedidos" ? "/crear" : `/simular/${domain}`,
  { method: "POST", body: JSON.stringify({ cliente, detalle }) }, API_PEDIDOS_AMQP,
);
export const enviarPedidoAMQP = (id, detalle) => enviarEvento("pedidos", id, detalle);
