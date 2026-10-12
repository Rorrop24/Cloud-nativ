import { useState } from "react";
import Footer from "../components/Footer";
import CarritoSidebar from "../components/CarritoSidebar";
import EventoCard from "../components/EventoCard";
import MapaEvento from "../components/MapaEvento";

const eventosData = [
  { titulo: "Evento Gaming Centro", fecha: "03 Noviembre 2025, 16:00 hrs", lugar: "Centro de Convenciones Santiago", coordenadas: [-33.4489, -70.6693] },
  { titulo: "Torneo Punto Gamer", fecha: "19 Noviembre 2025, 18:00 hrs", lugar: "Arena eSports Santiago", coordenadas: [-33.4378, -70.6505] },
  { titulo: "Meet & Greet Gamers", fecha: "28 Noviembre 2025, 14:00 hrs", lugar: "Parque Bicentenario", coordenadas: [-33.4561, -70.6391] }
];

function Eventos() {
  const [carritoOpen, setCarritoOpen] = useState(false);
  const [marcadorSeleccionado, setMarcadorSeleccionado] = useState(null);

  const handleCardClick = (coordenadas) => {
    setMarcadorSeleccionado({ lat: coordenadas[0], lng: coordenadas[1] });
  };

  return (
    <>
      <section id="eventos" className="hero py-5 border-bottom border-secondary-subtle">
        <div className="container">
          <h2 className="section-title mb-4">Eventos Punto Gamer</h2>
          <small className="text-secondary mb-4 d-block">Asiste a eventos, escanea el QR y gana puntos</small>

          <div className="row g-3 mb-4">
            {eventosData.map(evento => (
              <EventoCard
                key={evento.titulo}
                {...evento}
                onClick={handleCardClick}
              />
            ))}
          </div>

          <MapaEvento eventos={eventosData} marcadorSeleccionado={marcadorSeleccionado} />
        </div>
      </section>

      <CarritoSidebar isOpen={carritoOpen} cerrar={() => setCarritoOpen(false)} />
      <Footer />
    </>
  );
}

export default Eventos;
