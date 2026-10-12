import { useCallback, useEffect, useRef, useState } from "react";
import SidebarAdmin from "../components/SidebarAdmin";
import { obtenerTopologia, crearColaDinamica, eliminarCola, crearExchange, eliminarExchange, crearBinding, eliminarBinding, enviarEvento } from "../services/pedidosService";

export default function Mensajeria() {
  const [tab, setTab] = useState("colas");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [binding, setBinding] = useState({ queueName: "", exchangeName: "", routingKey: "" });
  const [domain, setDomain] = useState("pedidos");
  const [scenario, setScenario] = useState("ok");
  const [confirmation, setConfirmation] = useState(null);
  const cancelRef = useRef(null);
  const deleteTrigger = useRef(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await obtenerTopologia()); }
    catch (err) { setError(err.message); setData(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (confirmation) cancelRef.current?.focus(); }, [confirmation]);

  const act = async (operation, success) => {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); setNotice(success); setName(""); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const closeDialog = () => { setConfirmation(null); deleteTrigger.current?.focus(); };
  const confirmDelete = (event, label, operation) => {
    deleteTrigger.current = event.currentTarget;
    setConfirmation({ label, operation });
  };
  const queueCount = data?.queues.length;
  const messages = data?.queues.reduce((sum, q) => sum + Number(q.messages || 0), 0);
  const dead = data?.queues.filter((q) => q.name.endsWith(".dlq")).reduce((sum, q) => sum + Number(q.messages || 0), 0);

  return <SidebarAdmin>
    <div className="admin-page-heading"><div><span className="eyebrow">OPERACIONES</span><h1>Mensajeria</h1><p>Colas, exchanges y rutas de entrega.</p></div>
      <button className="icon-button" onClick={load} disabled={loading || busy} title="Actualizar" aria-label="Actualizar mensajeria"><i className="bi bi-arrow-clockwise" /></button></div>
    {error && <div className="admin-alert" role="alert">{error}<button className="text-link" onClick={load}>Reintentar</button></div>}
    {notice && <div className="admin-alert success" role="status">{notice}<button className="icon-button" aria-label="Cerrar aviso" onClick={() => setNotice("")}><i className="bi bi-x" /></button></div>}
    <div className="admin-metrics">{[["Colas", queueCount, "Principales y dead letter"], ["Mensajes", messages, "Pendientes de confirmacion"], ["En DLQ", dead, "Requieren revision"]].map(([label, value, detail]) => <div className="admin-metric" key={label}><span>{label}</span><strong>{value == null ? "--" : value}</strong><small>{detail}</small></div>)}</div>
    <div className="admin-tabs" role="tablist" aria-label="Recursos RabbitMQ">{[["colas", "Colas"], ["exchanges", "Exchanges"], ["bindings", "Bindings"]].map(([id, label]) => <button key={id} role="tab" id={`tab-${id}`} aria-controls="resources" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setName(""); }}>{label}</button>)}</div>
    <section id="resources" role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab !== "bindings" ? <form className="admin-form" onSubmit={(event) => { event.preventDefault(); act(() => tab === "colas" ? crearColaDinamica(name) : crearExchange(name), "Recurso creado."); }}>
        <label>Nombre {tab === "colas" ? "de la cola" : "del exchange"}<input required pattern="[a-zA-Z0-9._-]+" maxLength="128" placeholder={tab === "colas" ? "pruebas.queue" : "pruebas.exchange"} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <button className="btn btn-accent" disabled={busy || !data}><i className="bi bi-plus-lg" />Crear {tab === "colas" ? "cola" : "exchange"}</button>
      </form> : <form className="admin-form" onSubmit={(event) => { event.preventDefault(); act(() => crearBinding(binding), "Binding creado."); }}>
        <label>Cola<select required value={binding.queueName} onChange={(event) => setBinding({ ...binding, queueName: event.target.value })}><option value="">Seleccionar</option>{data?.queues.map((q) => <option key={q.name}>{q.name}</option>)}</select></label>
        <label>Exchange<select required value={binding.exchangeName} onChange={(event) => setBinding({ ...binding, exchangeName: event.target.value })}><option value="">Seleccionar</option>{data?.exchanges.map((q) => <option key={q.name}>{q.name}</option>)}</select></label>
        <label>Routing key<input required pattern="[a-zA-Z0-9._-]+" maxLength="128" value={binding.routingKey} onChange={(event) => setBinding({ ...binding, routingKey: event.target.value })} placeholder="prueba.creada" /></label>
        <button className="btn btn-accent" disabled={busy || !data}><i className="bi bi-link-45deg" />Crear binding</button>
      </form>}
      {loading ? <p className="admin-loading" role="status">Consultando RabbitMQ...</p> : !data ? <div className="empty-state"><i className="bi bi-cloud-slash" /><h3>Sin conexion al servicio</h3><p>Los datos estaran disponibles al conectar con RabbitMQ.</p></div> : <div className="table-scroll"><table className="admin-table">
        <thead><tr>{(tab === "colas" ? ["Cola", "Tipo", "Mensajes", "Consumidores", "Estado", ""] : tab === "exchanges" ? ["Exchange", "Tipo", "Persistencia", ""] : ["Exchange", "Cola", "Routing key", ""]).map((label, i) => <th key={i}>{label}</th>)}</tr></thead>
        <tbody>{tab === "colas" ? data.queues.map((q) => <tr key={q.name}><td><code>{q.name}</code></td><td>{q.type}</td><td>{q.messages || 0}</td><td>{q.consumers || 0}</td><td><span className={`status-pill ${q.name.endsWith(".dlq") && q.messages > 0 ? "warning" : q.state === "running" ? "" : "neutral"}`}>{q.name.endsWith(".dlq") ? "DLQ" : q.state}</span></td><td><button className="icon-button" title={`Eliminar ${q.name}`} aria-label={`Eliminar ${q.name}`} disabled={busy || q.managed} onClick={(event) => confirmDelete(event, q.name, () => eliminarCola(q.name))}><i className="bi bi-trash3" /></button></td></tr>)
          : tab === "exchanges" ? data.exchanges.map((q) => <tr key={q.name}><td><code>{q.name}</code></td><td>{q.type}</td><td>{q.durable ? "Durable" : "Temporal"}</td><td><button className="icon-button" aria-label={`Eliminar ${q.name}`} title={`Eliminar ${q.name}`} disabled={busy || q.managed} onClick={(event) => confirmDelete(event, q.name, () => eliminarExchange(q.name))}><i className="bi bi-trash3" /></button></td></tr>)
            : data.bindings.map((b) => <tr key={`${b.exchangeName}-${b.queueName}-${b.routingKey}`}><td><code>{b.exchangeName}</code></td><td><code>{b.queueName}</code></td><td><code>{b.routingKey}</code></td><td><button className="icon-button" title="Eliminar binding" aria-label={`Eliminar binding ${b.routingKey}`} disabled={busy || b.managed} onClick={(event) => confirmDelete(event, b.routingKey, () => eliminarBinding(b))}><i className="bi bi-trash3" /></button></td></tr>)}</tbody>
      </table></div>}
    </section>
    <section className="admin-section"><h2>Publicar evento</h2><form className="admin-form" onSubmit={(event) => {
      event.preventDefault(); const id = `TEST-${Date.now()}`;
      act(() => enviarEvento(domain, id, scenario === "ok" ? "Evento de prueba" : scenario === "invalid" ? "ERROR: Evento rechazado" : "RETRY: Error temporal"), `Evento ${id} aceptado por el productor.`);
    }}><label>Dominio<select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="pedidos">Pedidos</option><option value="inventario">Inventario</option><option value="notificaciones">Notificaciones</option></select></label>
      <label>Resultado<select value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="ok">Procesamiento correcto</option><option value="invalid">Rechazo a DLQ</option><option value="transient">Error temporal</option></select></label>
      <button className="btn btn-accent" disabled={busy || !data}><i className="bi bi-send" />Publicar</button></form></section>
    {confirmation && <div className="modal-backdrop-local" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) closeDialog();
      if (event.key === "Tab") { event.preventDefault(); const buttons = event.currentTarget.querySelectorAll("button"); (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus(); }
    }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Eliminar recurso</h2><p>Se eliminara <strong>{confirmation.label}</strong>. Esta accion no se puede deshacer.</p><div className="dialog-actions"><button className="btn btn-outline-light" ref={cancelRef} disabled={busy} onClick={closeDialog}>Cancelar</button><button className="btn btn-danger" disabled={busy} onClick={async () => { await act(confirmation.operation, "Recurso eliminado."); closeDialog(); }}><i className="bi bi-trash3" />Eliminar</button></div></section></div>}
  </SidebarAdmin>;
}
