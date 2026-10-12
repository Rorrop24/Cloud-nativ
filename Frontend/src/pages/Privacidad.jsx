import Footer from "../components/Footer";

function Privacidad() {
  return (
    <>
    <div className="container my-5">
      <h1 className="mb-4">Política de Privacidad</h1>
      <p>En <strong>Punto Gamer</strong>, tu privacidad es importante. A continuación te explicamos cómo manejamos tus datos:</p>

      <h5 className="mt-4">1. Información que recolectamos</h5>
      <p>Podemos recolectar:</p>
      <ul>
        <li>Nombre y correo electrónico al registrarte.</li>
        <li>Datos de compra y preferencias en el carrito.</li>
        <li>Información de navegación para mejorar la experiencia de usuario.</li>
      </ul>

      <h5 className="mt-4">2. Uso de la información</h5>
      <p>Utilizamos tus datos para:</p>
      <ul>
        <li>Procesar compras y envíos.</li>
        <li>Enviar promociones, novedades y noticias (solo si te suscribes).</li>
        <li>Mejorar nuestro sitio y personalizar la experiencia de usuario.</li>
      </ul>

      <h5 className="mt-4">3. Protección de datos</h5>
      <p>Mantenemos medidas de seguridad razonables para proteger tus datos de accesos no autorizados.</p>

      <h5 className="mt-4">4. Compartir información</h5>
      <p>No vendemos tus datos a terceros. Solo compartimos información cuando es necesario para procesar pagos o cumplir con la ley.</p>

      <h5 className="mt-4">5. Cambios en la política</h5>
      <p>Podemos actualizar nuestra política de privacidad en cualquier momento. Te recomendamos revisarla periódicamente.</p>

      <p className="mt-4">Si tienes dudas sobre nuestra política, contáctanos a través de soporte.</p>
    </div>
    <Footer />
    </>
  );
}

export default Privacidad;
