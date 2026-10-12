import { useState, useEffect } from "react";

function Incidencia({ usuario, actualizarTrigger }) {
  const [incidencias, setIncidencias] = useState([]);

  useEffect(() => {
    if (!usuario) return;
    const todasIncidencias = JSON.parse(localStorage.getItem("mensajesSoporte")) || {};
    setIncidencias(todasIncidencias[usuario.email] || []);
  }, [usuario, actualizarTrigger]);

  const eliminarIncidencia = (index) => {
    const todasIncidencias = JSON.parse(localStorage.getItem("mensajesSoporte")) || {};
    const nuevasIncidencias = [...incidencias];
    nuevasIncidencias.splice(index, 1);
    todasIncidencias[usuario.email] = nuevasIncidencias;
    localStorage.setItem("mensajesSoporte", JSON.stringify(todasIncidencias));
    setIncidencias(nuevasIncidencias);
  };

  if (!usuario) return null;

  if (incidencias.length === 0) {
    return <p className="text-secondary">No has enviado solicitudes de soporte.</p>;
  }

  return (
    <ul id="incidenciasUsuario" className="list-group">
      {incidencias.map((i, index) => (
        <li
          key={index}
          className="list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-start"
        >
          <div>
            <strong>{i.tipo.toUpperCase()} - {i.asunto}</strong> <br />
            <span className="text-secondary">{i.fecha}</span>
            <p className="mt-1">{i.mensaje}</p>
          </div>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={() => eliminarIncidencia(index)}
          >
            Eliminar
          </button>
        </li>
      ))}
    </ul>
  );
}

export default Incidencia;
