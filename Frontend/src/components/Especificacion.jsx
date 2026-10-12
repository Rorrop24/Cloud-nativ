export default function Especificacion({ detalles }) {
  if (!detalles || Object.keys(detalles).length === 0) return null;

  return (
    <div className="mb-4">
      <h4>Especificaciones</h4>
      <ul className="list-group">
        {Object.entries(detalles).map(([clave, valor]) => (
          <li key={clave} className="list-group-item d-flex justify-content-between">
            <strong>{clave}</strong>
            <span>{valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
