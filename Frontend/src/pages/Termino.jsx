import Footer from "../components/Footer";

function Termino() {
  return (
    <>
    <div className="container my-5">
      <h1 className="mb-4">Términos y Condiciones</h1>
      <p>Bienvenido a <strong>Punto Gamer</strong>. Al usar nuestra plataforma, aceptas los siguientes términos:</p>

      <h5 className="mt-4">1. Uso del sitio</h5>
      <p>Los usuarios deben ser mayores de 18 años. El contenido y los productos de nuestra tienda son solo para uso personal, no comercial.</p>

      <h5 className="mt-4">2. Registro y cuentas</h5>
      <p>Al registrarte, debes proporcionar información veraz. La cuenta es personal e intransferible.</p>

      <h5 className="mt-4">3. Compras y pagos</h5>
      <p>Las compras se realizan a través de nuestra plataforma. Nos reservamos el derecho de modificar precios o disponibilidad de productos.</p>

      <h5 className="mt-4">4. Propiedad intelectual</h5>
      <p>Todo el contenido, imágenes, logos y descripciones son propiedad de Punto Gamer y no pueden ser reproducidos sin autorización.</p>

      <h5 className="mt-4">5. Responsabilidad</h5>
      <p>No nos hacemos responsables por errores de uso, información incorrecta proporcionada por el usuario, o problemas externos de pago y entrega.</p>

      <h5 className="mt-4">6. Cambios en los términos</h5>
      <p>Podemos actualizar estos términos en cualquier momento. Se recomienda revisarlos periódicamente.</p>

      <p className="mt-4">Si tienes dudas, contáctanos a través de nuestro soporte.</p>
    </div>
    <Footer />
    </>
  );
}

export default Termino;
