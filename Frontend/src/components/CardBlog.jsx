import { useRef, useEffect } from "react";

function CardBlog({ titulo, categoria, imagenSrc, videoUrl, descripcion }) {
  const modalVideoRef = useRef();
  const iframeVideoRef = useRef();
  const modalCompartirRef = useRef();
  const botonCopiarRef = useRef();
  const linkWhatsAppRef = useRef();
  const linkTwitterRef = useRef();
  const linkFacebookRef = useRef();
  const modalTituloRef = useRef();

  // Detener video al cerrar modal
  useEffect(() => {
    const modalEl = modalVideoRef.current;
    if (!modalEl) return;

    const manejarCierre = () => {
      if (iframeVideoRef.current) {
        const src = iframeVideoRef.current.src;
        iframeVideoRef.current.src = "";
        iframeVideoRef.current.src = src;
      }
    };

    modalEl.addEventListener("hidden.bs.modal", manejarCierre);
    return () => modalEl.removeEventListener("hidden.bs.modal", manejarCierre);
  }, []);

  const abrirModalVideo = () => {
    const modalEl = modalVideoRef.current;
    const bsModal = new window.bootstrap.Modal(modalEl);
    bsModal.show();
  };

  const compartir = async () => {
    const datos = {
      titulo,
      texto: "Mira este video en Punto Gamer: " + titulo,
      url: videoUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(datos);
      } catch (err) {
        console.log(err);
      }
      return;
    }

    const modalEl = modalCompartirRef.current;
    if (!modalEl) return;

    modalTituloRef.current.textContent = datos.titulo;
    linkWhatsAppRef.current.href = `https://wa.me/?text=${encodeURIComponent(datos.texto)}`;
    linkTwitterRef.current.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(datos.texto)}`;
    linkFacebookRef.current.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(datos.url)}&quote=${encodeURIComponent(datos.texto)}`;

    const bsModal = new window.bootstrap.Modal(modalEl);
    bsModal.show();

    botonCopiarRef.current.onclick = async () => {
      try {
        await navigator.clipboard.writeText(`${datos.titulo} - ${datos.url}`);
        botonCopiarRef.current.innerHTML = '<i class="bi bi-check2 me-2"></i> Copiado';
        setTimeout(() => {
          botonCopiarRef.current.innerHTML = '<i class="bi bi-clipboard me-2"></i> Copiar enlace';
        }, 1500);
      } catch {
        alert("No se pudo copiar. Copia manualmente:\n" + `${datos.titulo} - ${datos.url}`);
      }
    };
  };

  return (
    <>
      {/* Tarjeta */}
      <div className="col-md-4">
        <div className="card h-100">
          <div className="blog-card-img">
            <img src={imagenSrc} alt={titulo} />
          </div>
          <div className="card-body">
            <span className="badge badge-neon mb-2">{categoria}</span>
            <h5 className="card-title">{titulo}</h5>
            <p className="card-text text-secondary mb-3">{descripcion}</p>
            <div className="d-flex gap-2">
              <button className="btn btn-ver btn-sm" onClick={abrirModalVideo}>
                <i className="bi bi-play-btn"></i> Ver
              </button>
              <button className="btn btn-sm btn-compartir" onClick={compartir}>
                <i className="bi bi-share"></i> Compartir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de video */}
      <div className="modal fade" tabIndex="-1" aria-hidden="true" ref={modalVideoRef}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content bg-dark">
            <div className="modal-header border-0">
              <h5 className="modal-title text-white">{titulo}</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body p-0">
              <div className="ratio ratio-16x9">
                <iframe ref={iframeVideoRef} src={videoUrl} title={titulo} allowFullScreen></iframe>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de compartir */}
      <div className="modal fade" tabIndex="-1" aria-hidden="true" ref={modalCompartirRef}>
        <div className="modal-dialog modal-sm modal-dialog-centered">
          <div className="modal-content bg-dark">
            <div className="modal-header border-0">
              <h5 className="modal-title" ref={modalTituloRef}></h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              <div className="d-grid gap-2">
                <a href="#" target="_blank" className="btn btn-success" ref={linkWhatsAppRef}>
                  <i className="bi bi-whatsapp me-2"></i> WhatsApp
                </a>
                <a href="#" target="_blank" className="btn btn-primary" ref={linkTwitterRef}>
                  <i className="bi bi-twitter me-2"></i> Twitter
                </a>
                <a href="#" target="_blank" className="btn btn-info text-white" ref={linkFacebookRef}>
                  <i className="bi bi-facebook me-2"></i> Facebook
                </a>
                <button className="btn btn-outline-light" ref={botonCopiarRef}>
                  <i className="bi bi-clipboard me-2"></i> Copiar enlace
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default CardBlog;
