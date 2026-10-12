import Footer from "../components/Footer";
import SoporteForm from "../components/SoporteForm";

function Soporte({ usuario }) {
  return (
    <>
      <section className="hero py-5 border-bottom border-secondary-subtle">
        <div className="container">
          <h2 className="section-title mb-4">Soporte</h2>
          <p className="text-secondary mb-4">
            Envía tu mensaje para soporte técnico o consultas generales.
          </p>
          <SoporteForm usuario={usuario} />
        </div>
      </section>
      <Footer />
    </>
  );
}

export default Soporte;
