import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

function ProteccionUser({ children, usuario }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!usuario) {
      // Vaciar carrito y devolver stock
      const carritoLS = JSON.parse(localStorage.getItem("carrito")) || [];
      carritoLS.forEach(item => {
        const stockActual = Number(localStorage.getItem(`stock_${item.id}`)) || 0;
        const stockNuevo = stockActual + item.cantidad;
        localStorage.setItem(`stock_${item.id}`, stockNuevo);
      });
      localStorage.removeItem("carrito");


      window.dispatchEvent(new Event("carritoCambiado"));
      window.dispatchEvent(new Event("usuarioCambiado"));

      Swal.fire({
        title: "⚠️ Debes iniciar sesión",
        text: "Redirigiendo a Auth...",
        icon: "warning",
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        background: "#2c2c2c",
        color: "#fff",
        customClass: {
          popup: "swal2-popup",
          title: "swal2-title",
          content: "swal2-content"
        }
      });

      const timer = setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [usuario, navigate]);

  if (!usuario) return null;

  return children;
}

export default ProteccionUser;
