// src/components/FormularioUsuarioNV.jsx (CÓDIGO FINAL CON POST Y PUT)

import React, { useState, useEffect, useCallback } from 'react'; // 🛑 AÑADIMOS useEffect y useCallback
import { useParams, useNavigate } from 'react-router-dom';     // 🛑 AÑADIMOS useParams y useNavigate
import regionesD from "../data/regiones.json"; 
import { apiFetch as fetch } from "../auth/apiFetch";
import { API_USUARIOS } from "../utils/apihelper";

// --- Configuración Global y API ---
const API_URL_CREAR = `${API_USUARIOS}/crear`;
const API_URL_ACTUALIZAR = `${API_USUARIOS}/actualizar`;
const API_URL_BUSCAR_ID = `${API_USUARIOS}/buscar/id/`;
const ROLES = ["admin", "usuario"]; 
const MIN_PASSWORD_LENGTH = 6; 
const DUOC_DOMAIN = '@duoc.cl'; 


function FormularioUsuarioNV() {
    // Detectar si hay un ID en la URL (modo Edición)
    const { id } = useParams(); 
    const navigate = useNavigate(); // Para redirigir después de crear/editar

    // ... (Inicialización de regiones y estados se mantiene igual) ...
    const regionesArray = Array.isArray(regionesD) ? regionesD : []; 
    const initialRegion = regionesArray[0]?.region || ''; 
    const initialComuna = regionesArray[0]?.comunas[0] || '';

    const [formData, setFormData] = useState({
        nombre: '', apellido: '', rut: '', email: '', fecha: '', 
        region: initialRegion, comuna: initialComuna, telefono: '', 
        password: '', // Nota: La contraseña en edición a menudo se deja vacía o con un valor placeholder
        rol: ROLES[0],
    });
    const [status, setStatus] = useState({ loading: false, error: null, success: false });
    const [initialLoading, setInitialLoading] = useState(false); // Nuevo estado para cargar datos iniciales


    // 🛑 LÓGICA DE CARGA INICIAL (MODO EDICIÓN)
    const fetchUserData = useCallback(async (userId) => {
        if (!userId) return;

        setInitialLoading(true);
        try {
            // GET: /v2/usuarios/buscar/id/{usuarioId}
            const response = await fetch(`${API_URL_BUSCAR_ID}${userId}`);
            
            if (!response.ok) {
                throw new Error(`Usuario ${userId} no encontrado.`);
            }
            const user = await response.json();
            
            // Mapeamos los datos de la API al estado del formulario
            setFormData({
                // El ID se mantiene, pero no se usa en el formulario como input
                nombre: user.nombre || '', 
                apellido: user.apellido || '', 
                rut: user.rut || '', 
                email: user.email || '', 
                fecha: user.fecha ? user.fecha.split('T')[0] : '', // Formato Date a YYYY-MM-DD
                region: user.region || initialRegion, 
                comuna: user.comuna || initialComuna, 
                telefono: user.telefono || '', 
                password: '', // Nunca cargamos la contraseña existente, se deja vacía para forzar cambio si se requiere
                rol: user.rol || ROLES[0],
            });

        } catch (err) {
            alert(`Error al cargar datos del usuario: ${err.message}`);
            // Podrías redirigir a la lista si falla la carga
            // navigate('/adminhome/usuariosadmin');
        } finally {
            setInitialLoading(false);
        }
    }, [initialRegion, initialComuna]);


    // Ejecutar la carga al montar si hay un ID
    useEffect(() => {
        if (id) {
            fetchUserData(id);
        }
    }, [id, fetchUserData]);


    // ... (handleChange y handleRegionChange se mantienen iguales) ...

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ loading: true, error: null, success: false });
        
        // --- VALIDACIONES DE DATOS (se mantienen iguales) ---
        // ... (Validaciones de edad, RUT, Teléfono, Email, Contraseña, etc.) ...
        
        // Asumiendo que las validaciones son exitosas...

        // 3. Crear el objeto final para la API
        const isEditing = !!id;
        const usuarioAPI = {
            // Solo incluimos el ID si estamos EDITANDO (para el PUT)
            ...(isEditing && { usuarioId: parseInt(id) }), // 🛑 ID para PUT
            nombre: formData.nombre, apellido: formData.apellido,
            rut: formData.rut.replace(/[^0-9kK]/g, ""), 
            email: formData.email.toLowerCase(), 
            fecha: formData.fecha,
            region: formData.region, comuna: formData.comuna, telefono: formData.telefono,
            rol: formData.rol,
            esDuoc: formData.email.toLowerCase().endsWith(DUOC_DOMAIN),
            
            // 🛑 LÓGICA DE CONTRASEÑA: Solo se envía si el campo no está vacío
            ...(formData.password && { password: formData.password }),
        };

        // 4. Lógica de envío a la API (POST o PUT)
        try {
            const method = isEditing ? 'PUT' : 'POST';
            const url = isEditing ? API_URL_ACTUALIZAR : API_URL_CREAR;
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(usuarioAPI),
            });

            if (response.status === 409) { // 409 Conflict (Email/RUT duplicado)
                 throw new Error("El email o RUT ya están registrados. No se pudo guardar.");
            }
            if (!response.ok) {
                // Captura otros errores del servidor
                throw new Error(`Error de servidor (${response.status}). Intente de nuevo.`);
            }

            const action = isEditing ? "actualizado" : "creado";
            
            setStatus({ loading: false, error: null, success: true });
            alert(`✅ Usuario ${usuarioAPI.nombre} ${action} con éxito.`);
            
            // Redirigir después de la operación
            navigate('/adminhome/usuariosadmin');

        } catch (err) {
            console.error(`Error al ${isEditing ? 'actualizar' : 'registrar'} usuario:`, err);
            setStatus({ loading: false, error: err.message, success: false });
            alert(`❌ Fallo al ${isEditing ? 'actualizar' : 'registrar'}: ${err.message}`);
        }
    };
    
    // ... (Obtener comunasOptions se mantiene igual) ...
    // ... (Renderizado JSX se mantiene igual) ...

    const currentGeneratedId = id ? `Editando ID: ${id}` : "Automático (API)";

    if (initialLoading) {
        return <div className="text-center p-5 text-warning"><i className="fas fa-spinner fa-spin me-2"></i> Cargando datos del usuario...</div>;
    }


    return (
        <div className="p-4" style={{ backgroundColor: '#212529', borderRadius: '8px', color: 'white' }}>
            <h2>{id ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}</h2>
            <form onSubmit={handleSubmit}>
                
                {/* Fila 1: ID, Nombre, Apellido */}
                <div className="row mb-3">
                    <div className="col-md-3 mb-3">
                        <label className="form-label">ID</label>
                        <div className="form-control bg-secondary text-white border-secondary fw-bold">
                            {currentGeneratedId}
                        </div>
                    </div>
                    {/* ... (resto de campos de texto se mantienen) ... */}
                </div>
                {/* ... (otras filas de campos de formulario) ... */}

                {/* Botón de Envío */}
                <button type="submit" className="btn btn-primary w-100" disabled={status.loading || initialLoading}>
                    {initialLoading ? 'Cargando...' : status.loading ? (
                        <>
                            <i className="fas fa-spinner fa-spin me-2"></i> {id ? 'Actualizando...' : 'Registrando...'}
                        </>
                    ) : (
                        <>
                            <i className="fas fa-save me-2"></i> {id ? 'Actualizar Usuario' : 'Registrar Nuevo Usuario'}
                        </>
                    )}
                </button>
                {status.error && <div className="alert alert-danger mt-3">{status.error}</div>}
                {status.success && <div className="alert alert-success mt-3">¡Operación completada con éxito!</div>}

            </form>
        </div>
    );
}

export default FormularioUsuarioNV;
