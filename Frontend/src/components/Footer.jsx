import { Link } from "react-router-dom";

export default function Footer() {
  return <footer className="store-footer">
    <div className="container footer-main">
      <div><Link className="store-brand" to="/"><i className="bi bi-controller brand-symbol" /><span>PUNTO <small>GAMER</small></span></Link>
        <p>Gaming, tecnologia y comunidad.</p></div>
      <div className="footer-links"><Link to="/categoria">Catalogo</Link><Link to="/nosotros">Nosotros</Link><Link to="/soporte">Contacto y soporte</Link></div>
      <div className="footer-links"><Link to="/termino">Terminos y condiciones</Link><Link to="/privacidad">Privacidad</Link><Link to="/eventos">Eventos</Link></div>
    </div>
    <div className="container footer-bottom"><span>&copy; {new Date().getFullYear()} Punto Gamer</span><span>Chile · Precios en CLP</span></div>
  </footer>;
}
