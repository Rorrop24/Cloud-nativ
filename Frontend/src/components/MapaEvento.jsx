import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function MapaEvento({ eventos, marcadorSeleccionado }) {
  const mapaRef = useRef(null);

  useEffect(() => {
    const mapa = L.map(mapaRef.current).setView([-33.45, -70.65], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapa);

    const marcadores = {};
    eventos.forEach(evento => {
      const marcador = L.marker(evento.coordenadas)
        .addTo(mapa)
        .bindPopup(`<strong>${evento.titulo}</strong><br>${evento.lugar}`);
      marcadores[evento.titulo] = marcador;
    });

    // Si hay un marcador seleccionado, centrar y abrir popup
    if (marcadorSeleccionado) {
      const { lat, lng } = marcadorSeleccionado;
      mapa.setView([lat, lng], 15);

      Object.values(marcadores).forEach(m => {
        const pos = m.getLatLng();
        if (pos.lat === lat && pos.lng === lng) {
          m.openPopup();
        }
      });
    }

    return () => mapa.remove();
  }, [eventos, marcadorSeleccionado]);

  return <div ref={mapaRef} style={{ height: "420px", borderRadius: "1rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }} />;
}

export default MapaEvento;
