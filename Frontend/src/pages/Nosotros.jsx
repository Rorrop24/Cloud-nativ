import { useEffect } from "react";
import CarritoSidebar from "../components/CarritoSidebar";
import Footer from "../components/Footer";
import { getImagenesPorTipo } from "../utils/apihelper";

function Nosotros({ carritoOpen, setCarritoOpen }) {


  useEffect(() => {
    getImagenesPorTipo("nosotros")
      .catch((err) => console.error("Error cargando imágenes:", err));
  }, []);

  return (
    <>
      {/* Sección Historia */}
      <section id="historia" className="hero py-5 border-bottom border-secondary-subtle">
        <div className="container">
          <h2 className="section-title mb-4">Nuestra Historia</h2>
          <p className="text-secondary lead">
            Punto Gamer nació hace 2 años con la misión de brindar productos de alta calidad para gamers en todo Chile. Desde consolas y accesorios hasta PC y sillas especializadas, nuestro objetivo siempre ha sido mejorar la experiencia de juego y la satisfacción de nuestros clientes.
          </p>
        </div>
      </section>

      {/* Misión, Visión y Valores */}
      <section id="mision-vision" className="py-5 border-bottom border-secondary-subtle">
        <div className="container">
          <h2 className="section-title mb-4">Misión, Visión y Valores</h2>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card h-100 card-body bg-dark border border-secondary-subtle">
                <h5 className="card-title">Misión</h5>
                <p className="text-secondary">
                  Proveer productos de alta calidad y experiencias únicas para gamers, con un enfoque personalizado y atención excepcional.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 card-body bg-dark border border-secondary-subtle">
                <h5 className="card-title">Visión</h5>
                <p className="text-secondary">
                  Ser la tienda líder en Chile en innovación, servicio y gamificación, inspirando a la comunidad gamer a alcanzar su máximo potencial.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 card-body bg-dark border border-secondary-subtle">
                <h5 className="card-title">Valores</h5>
                <p className="text-secondary">
                  Pasión por los videojuegos, compromiso con nuestros clientes, honestidad, innovación y trabajo en equipo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Carrito */}
      <CarritoSidebar isOpen={carritoOpen} cerrar={() => setCarritoOpen(false)} />

      {/* Footer */}
      <Footer />
    </>
  );
}

export default Nosotros;
