import { useEffect, useState } from "react";
import CardBlog from "../components/CardBlog";
import Footer from "../components/Footer";
import { getImagenesPorTipo } from "../utils/apihelper";

function Blog() {
  const [imagenes, setImagenes] = useState([]);

  useEffect(() => {
    getImagenesPorTipo("blog")
      .then(data => setImagenes(data))
      .catch(err => console.error("Error cargando imágenes:", err));
  }, []);

  return (
    <>
      <div className="container my-5">
        <h2 className="section-title mb-4">Blog & Noticias</h2>

        <div className="row g-4">
          {imagenes.length > 0 && (
            <>
              <CardBlog
                titulo="Cómo elegir tu silla gamer ideal Calidad-Precio"
                categoria="Guías"
                descripcion="La guia sobre como elegir tu silla gamer calidad-precio combinando ergonomía, durabilidad y diseño atractivo sin romper el banco."
                imagenSrc={imagenes[0]?.url || "https://imgur.com/Ljm5iGV"} 
                videoUrl="https://www.youtube.com/embed/vZG9w2BDHDg?si=4A4FcKeZcFSKpSFE"
              />
              <CardBlog
                titulo="La MEJOR PC GAMER para cada presupuesto en 2025"
                categoria="Reviews"
                descripcion="En 2025, la elección de la mejor PC gamer depende de tus necesidades y presupuesto."
                imagenSrc={imagenes[1]?.url || "/img/fallback.png"}
                videoUrl="https://www.youtube.com/embed/blA9MqxF0-A?si=i5JTwcJGJ4B8MMTz"
              />
              <CardBlog
                titulo="Periféricos buenos, bonitos y baratos"
                categoria="Tips"
                descripcion="En 2025, existen opciones destacadas que combinan rendimiento y diseño sin comprometer el presupuesto."
                imagenSrc={imagenes[2]?.url || "/img/fallback.png"}
                videoUrl="https://www.youtube.com/embed/XWKZqhBx1XA?si=rY99wSPrllscYGTt"
              />
            </>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}

export default Blog;
