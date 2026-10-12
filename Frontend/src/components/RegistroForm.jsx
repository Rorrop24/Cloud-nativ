import { useState, useEffect } from "react";
import regionesData from "../data/regiones.json";
import Swal from "sweetalert2"; 
import "sweetalert2/dist/sweetalert2.min.css"; 


export default function RegistroForm({ onClose, onUsuarioChange, abrirLogin }) {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fecha, setFecha] = useState("");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [telefono, setTelefono] = useState("");
  const [comunasDisponibles, setComunasDisponibles] = useState([]);

  const [errores, setErrores] = useState({});

  // --- Actualizar comunas según región ---
  useEffect(() => {
    if (region) {
      const regionObj = regionesData.find(r => r.region === region);
      setComunasDisponibles(regionObj ? regionObj.comunas : []);
      setComuna("");
    }
  }, [region]);

  // --- Validaciones ---
  const validarCampo = {
    nombre: val => val.trim() !== "" || "Debes ingresar tu nombre",
    apellido: val => val.trim() !== "" || "Debes ingresar tu apellido",
    rut: val => /^[0-9]{8}[0-9Kk]$/.test(val) || "RUT inválido (9 caracteres)",  
    email: val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || "Correo inválido",
    password: val => val.length >= 6 || "La contraseña debe tener al menos 6 caracteres",
    confirmPassword: val => val === password || "Las contraseñas no coinciden",
    fecha: val => {
      if (!val) return "Debes ingresar tu fecha de nacimiento";
      const nacimiento = new Date(val);
      const hoy = new Date();
      let edad = hoy.getFullYear() - nacimiento.getFullYear();
      const mes = hoy.getMonth() - nacimiento.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
      return edad >= 18 || "Debes ser mayor de 18 años";
    },
    region: val => val !== "" || "Debes seleccionar una región",
    comuna: val => val !== "" || "Debes seleccionar una comuna",
    telefono: val => val.length >= 9 || "El número debe tener mínimo 9 dígitos",
  };

  // --- Validación en tiempo real ---
  const handleChange = (campo, valor) => {
    // normalizar algunos inputs básicos
    if (campo === "telefono") {
      valor = valor.replace(/[^0-9]/g, "").slice(0, 9);
    }
    
    if (campo === "rut") {
      valor = valor.replace(/[.-]/g, "");
    }


    const valid = validarCampo[campo] ? validarCampo[campo](valor) : true;
    setErrores(prev => ({ ...prev, [campo]: valid === true ? "" : valid }));

    switch(campo){
      case "nombre": setNombre(valor); break;
      case "apellido": setApellido(valor); break;
      case "rut": setRut(valor); break;
      case "email": setEmail(valor); break;
      case "password": 
        setPassword(valor);
        if (confirmPassword) {
          setErrores(prev => ({
            ...prev,
            confirmPassword: valor === confirmPassword ? "" : "Las contraseñas no coinciden"
          }));
        }
      break;
      case "confirmPassword": setConfirmPassword(valor); break;
      case "fecha": setFecha(valor); break;
      case "region": setRegion(valor); break;
      case "comuna": setComuna(valor); break;
      case "telefono": setTelefono(valor); break;
      default: break;
    }
  };

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    let hayError = false;
    let nuevoErrores = {};

    const campos = { 
      nombre, apellido, rut, email, password, confirmPassword,
      fecha, region, comuna, telefono
    };

    Object.keys(validarCampo).forEach(campo => {
      const valid = validarCampo[campo](campos[campo]);
      if (valid !== true) {
        nuevoErrores[campo] = valid;
        hayError = true;
      }
    });

    if (hayError) {
      setErrores(nuevoErrores);
      return;
    }

    // Preparar datos para enviar al backend

    const nuevoUsuario = {
      nombre,
      apellido,
      rut,
      email,
      password,
      fechaNacimiento: fecha,
      region,
      comuna,
      telefono
    };

    // Enviar al backend (Spring Boot)
    try {
      const res = await fetch("http://localhost:8082/v2/usuarios/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoUsuario)
      });

    if (!res.ok) {
      let msg = "Error en el servidor";

      try {
        const err = await res.json();
        if (err && err.message) msg = err.message;
      } catch (e) {
        console.error(e);
      }
      throw new Error(msg);
    }

      const usuarioCreado = await res.json();

      localStorage.setItem("usuario", JSON.stringify(usuarioCreado));
      if (onUsuarioChange) onUsuarioChange();

      Swal.fire({
        title: "¡Registro exitoso!",
        text: "Tu cuenta ha sido creada correctamente.",
        icon: "success",
        confirmButtonText: "Ir al login",
        background: "#2c2c2c",
        color: "#fff",
        confirmButtonColor: "#1E90FF"
      }).then(() => {
        onClose();
        if (abrirLogin) abrirLogin();
      });

      // limpiar formulario
      setNombre(""); 
      setApellido(""); 
      setRut(""); 
      setEmail(""); 
      setPassword(""); 
      setConfirmPassword("");
      setFecha(""); 
      setRegion(""); 
      setComuna(""); 
      setTelefono("");
      setErrores({});

    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el usuario.", "error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="row g-3">

      {/* NOMBRE */}
      <div className="col-md-6">
        <label className="form-label">Nombre</label>
        <input
          type="text"
          className={`form-control ${errores.nombre ? "is-invalid" : (nombre ? "is-valid" : "")}`}
          value={nombre}
          onChange={e => handleChange("nombre", e.target.value)}
        />
        {errores.nombre && <div className="text-danger">{errores.nombre}</div>}
      </div>

      {/* APELLIDO */}
      <div className="col-md-6">
        <label className="form-label">Apellido</label>
        <input
          type="text"
          className={`form-control ${errores.apellido ? "is-invalid" : (apellido ? "is-valid" : "")}`}
          value={apellido}
          onChange={e => handleChange("apellido", e.target.value)}
        />
        {errores.apellido && <div className="text-danger">{errores.apellido}</div>}
      </div>

      {/* RUT */}
      <div className="col-md-6">
        <label className="form-label">RUT</label>
        <input
          type="text"
          className={`form-control ${errores.rut ? "is-invalid" : (rut ? "is-valid" : "")}`}
          value={rut}
          onChange={e => handleChange("rut", e.target.value)}
        />
        {errores.rut && <div className="text-danger">{errores.rut}</div>}
      </div>

      {/* EMAIL */}
      <div className="col-md-6">
        <label className="form-label">Correo</label>
        <input
          type="email"
          className={`form-control ${errores.email ? "is-invalid" : (email ? "is-valid" : "")}`}
          value={email}
          onChange={e => handleChange("email", e.target.value)}
        />
        {errores.email && <div className="text-danger">{errores.email}</div>}
        <span className="form-hint">
          <i className="bi bi-gift-fill me-1"></i> Usa un correo <strong>@duoc.cl</strong> y obtén 20% de descuento.
        </span>
      </div>

      {/* REGIÓN */}
      <div className="col-md-6">
        <label className="form-label">Región</label>
        <select
          className={`form-select ${errores.region ? "is-invalid" : (region ? "is-valid" : "")}`}
          value={region}
          onChange={e => handleChange("region", e.target.value)}
        >
          <option value="">Selecciona Región</option>
          {regionesData.map(r => (
            <option key={r.region} value={r.region}>{r.region}</option>
          ))}
        </select>
        {errores.region && <div className="text-danger">{errores.region}</div>}
      </div>

      {/* COMUNA */}
      <div className="col-md-6">
        <label className="form-label">Comuna</label>
        <select
          className={`form-select ${errores.comuna ? "is-invalid" : (comuna ? "is-valid" : "")}`}
          value={comuna}
          onChange={e => handleChange("comuna", e.target.value)}
        >
          <option value="">Selecciona Comuna</option>
          {comunasDisponibles.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {errores.comuna && <div className="text-danger">{errores.comuna}</div>}
      </div>

      {/* FECHA */}
      <div className="col-md-6">
        <label className="form-label">Fecha de nacimiento</label>
        <input
          type="date"
          className={`form-control ${errores.fecha ? "is-invalid" : (fecha ? "is-valid" : "")}`}
          value={fecha}
          onChange={e => handleChange("fecha", e.target.value)}
        />
        {errores.fecha && <div className="text-danger">{errores.fecha}</div>}
      </div>

      {/* TELEFONO */}
      <div className="col-md-6">
        <label className="form-label">Teléfono</label>
        <input
          type="text"
          maxLength="9"
          className={`form-control ${errores.telefono ? "is-invalid" : (telefono ? "is-valid" : "")}`}
          value={telefono}
          onChange={e => handleChange("telefono", e.target.value)}
        />
        {errores.telefono && <div className="text-danger">{errores.telefono}</div>}
      </div>

      {/* CONTRASEÑA */}
      <div className="col-md-6">
        <label className="form-label">Contraseña</label>
        <input
          type="password"
          className={`form-control ${errores.password ? "is-invalid" : (password ? "is-valid" : "")}`}
          value={password}
          onChange={e => handleChange("password", e.target.value)}
        />
        {errores.password && <div className="text-danger">{errores.password}</div>}
      </div>

      {/* CONFIRMAR CONTRASEÑA */}
      <div className="col-md-6">
        <label className="form-label">Confirmar Contraseña</label>
        <input
          type="password"
          className={`form-control ${errores.confirmPassword ? "is-invalid" : (confirmPassword ? "is-valid" : "")}`}
          value={confirmPassword}
          onChange={e => handleChange("confirmPassword", e.target.value)}
        />
        {errores.confirmPassword && <div className="text-danger">{errores.confirmPassword}</div>}
      </div>

      {/* BOTÓN */}
      <div className="col-12">
        <button type="submit" className="btn btn-accent w-100">Registrarme</button>
      </div>
    </form>
  );
}
