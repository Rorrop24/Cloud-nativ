import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_USUARIOS = "http://localhost:8082/v2/usuarios";

export default function LoginForm({ onClose, onUsuarioChange }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alerta, setAlerta] = useState(null);
  const navigate = useNavigate();

  const mostrarAlerta = (tipo, mensaje) => {
    setAlerta({ tipo, mensaje });
    setTimeout(() => setAlerta(null), 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      mostrarAlerta("danger", "Por favor, ingresa un correo y contraseña.");
      return;
    }

    try {
      const resp = await fetch(`${API_USUARIOS}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!resp.ok) {
        mostrarAlerta("danger", "Email o contraseña incorrectos.");
        return;
      }

      const data = await resp.json();
      const token = data.token;
      const usuario = data.usuario || data;

      if (token) {
        localStorage.setItem("token", token);
      }
      localStorage.setItem("usuario", JSON.stringify(usuario));
      mostrarAlerta("success", `Bienvenido, ${usuario.nombre}`);

      if (onUsuarioChange) onUsuarioChange();

      setTimeout(() => {
        onClose();
        if (usuario.rol && usuario.rol.toLowerCase() === "admin") {
          navigate("/homeadmin");
        } else {
          navigate("/");
        }
      }, 1000);

    } catch (error) {
      console.error(error);
      mostrarAlerta("danger", "Error al conectar con el servidor.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="row g-3">
      {alerta && <div className={`alert alert-${alerta.tipo} w-100`}>{alerta.mensaje}</div>}

      <div className="col-12">
        <input
          type="email"
          className="form-control"
          placeholder="Correo electrónico"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>

      <div className="col-12">
        <input
          type="password"
          className="form-control"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      <div className="col-12">
        <button type="submit" className="btn btn-accent w-100">
          Entrar
        </button>
      </div>
    </form>
  );
}