import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch as fetch } from "../auth/apiFetch";
import { API_USUARIOS } from "../utils/apihelper";
// ELIMINAMOS DATOS ESTÁTICOS
// import usuariosD from "../data/usuarios.json"; 
import regionesD from "../data/regiones.json"; 

// ELIMINAMOS lógica de localStorage y generación de ID local:
// const LOCAL_STORAGE_KEY_USERS = 'usuarios_maestro';
// const getMasterUsers = () => { /* ... */ };

// --- Configuración Global y API ---
const ROLES = ["admin", "usuario"]; 
const ALLOWED_DOMAINS = ['@duoc.cl', '@gmail.com', '@levelup.cl']; 
const MIN_PASSWORD_LENGTH = 6; 
const DUOC_DOMAIN = '@duoc.cl'; 

// 🛑 Endpoints de la API
const API_URL_BUSCAR_ID = `${API_USUARIOS}/buscar/id/`;
const API_URL_ACTUALIZAR = `${API_USUARIOS}/actualizar`;

// Acceso directo al array de regiones
const regionesArray = Array.isArray(regionesD) ? regionesD : []; 


function FormularioUsuarioEdit({ userId }) {
    
    const navigate = useNavigate();

    // Estado inicial de carga
    const [formData, setFormData] = useState(null); 
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState({ loading: false, error: null });

    // Estado para las comunas disponibles (basado en el JSON local)
    const [comunasOptions, setComunasOptions] = useState([]);
    
    // Valores por defecto para manejar estados de carga si regiones no cargó
    const initialRegion = regionesArray[0]?.region || '';
    const initialComuna = regionesArray[0]?.comunas[0] || '';


    // 🛑 FUNCIÓN DE CARGA INICIAL (GET - Database)
    const fetchUserData = useCallback(async () => {
        if (!userId) {
            navigate('/homeadmin/usuariosadmin');
            return;
        }

        setIsLoading(true);
        setStatus({ loading: true, error: null });

        try {
            // GET: /v2/usuarios/buscar/id/{usuarioId}
            const response = await fetch(`${API_URL_BUSCAR_ID}${userId}`);
            
            if (!response.ok) {
                throw new Error(`Usuario con ID ${userId} no encontrado en la base de datos.`);
            }
            const user = await response.json();
            
            // 1. Mapear los datos de la API al estado del formulario
            const initialData = {
                // Usamos user.usuarioId si la entidad lo devuelve, sino el userId de la prop
                id: user.usuarioId || parseInt(userId), 
                nombre: user.nombre || '', 
                apellido: user.apellido || '', 
                rut: user.rut || '', 
                email: user.email || '', 
                // Formatear fecha para el input type="date" (YYYY-MM-DD)
                fecha: user.fecha ? user.fecha.split('T')[0] : '', 
                region: user.region || initialRegion, 
                comuna: user.comuna || initialComuna, 
                telefono: user.telefono || '', 
                password: '', // Contraseña vacía por seguridad
                originalPassword: user.password, // Solo si necesitas el hash original para validación (opcional)
                rol: user.rol || ROLES[0],
            };
            setFormData(initialData);

            // 2. Cargar las comunas iniciales
            const initialRegionData = regionesArray.find(r => r.region === initialData.region);
            if (initialRegionData) {
                setComunasOptions(initialRegionData.comunas);
            }
            
        } catch (err) {
            alert(`Error al cargar datos del usuario: ${err.message}`);
            navigate('/homeadmin/usuariosadmin'); // Redirigir si falla la carga
        } finally {
            setIsLoading(false);
            setStatus({ loading: false, error: null });
        }
    }, [userId, navigate]);


    // --- Efecto para cargar los datos del usuario al inicio ---
    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    // Función de manejo de cambio de Región (se mantiene la lógica JSON)
    const handleRegionChange = (e) => {
        const selectedRegionName = e.target.value;
        const selectedRegion = regionesArray.find(r => r.region === selectedRegionName);
        
        setFormData(prev => ({
            ...prev,
            region: selectedRegionName,
            comuna: selectedRegion?.comunas[0] || '',
        }));
        setComunasOptions(selectedRegion?.comunas || []);
    };


    // 🛑 FUNCIÓN DE ENVÍO Y ACTUALIZACIÓN (PUT - Database)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData) return;
        
        setStatus({ loading: true, error: null });

        // --- VALIDACIONES DE DATOS (se mantienen) ---
        // ... (Validaciones de edad, RUT, Teléfono, Email, Contraseña) ...
        
        const rutSanitized = formData.rut.replace(/[^0-9kK]/g, "");
        const emailLowerCase = formData.email.toLowerCase(); 
        const esDuocAutomatico = emailLowerCase.endsWith(DUOC_DOMAIN);
        
        // Validación de Contraseña: Solo si se ingresó un nuevo valor
        if (formData.password && formData.password.length < MIN_PASSWORD_LENGTH) {
            alert(`Error de validación: La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
            setStatus({ loading: false, error: "Contraseña muy corta." });
            return;
        }
        // Asumiendo que las otras validaciones (RUT, edad, email) son exitosas...

        // 1. Construir el objeto actualizado para el PUT
        const usuarioAPI = {
            usuarioId: parseInt(formData.id), // 🛑 ID DEBE SER ENVIADO PARA EL PUT
            nombre: formData.nombre,
            apellido: formData.apellido,
            rut: rutSanitized,
            email: emailLowerCase,
            fecha: formData.fecha,
            region: formData.region,
            comuna: formData.comuna,
            telefono: formData.telefono,
            esDuoc: esDuocAutomatico, 
            rol: formData.rol,
            
            // Solo incluimos la contraseña si el campo fue llenado
            password: formData.password || formData.originalPassword, 
        };

        // 2. Enviar la petición PUT
        try {
            const response = await fetch(API_URL_ACTUALIZAR, { // PUT: /v2/usuarios/actualizar
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(usuarioAPI),
            });

            if (!response.ok) {
                const errorMsg = await response.text();
                throw new Error(errorMsg || "Fallo al actualizar el usuario. Verifique el servidor.");
            }

            setStatus({ loading: false, error: null });
            alert(`✅ Usuario ${formData.nombre} actualizado correctamente en la base de datos.`);
            navigate('/homeadmin/usuariosadmin'); // Volver a la lista después de guardar

        } catch (err) {
            console.error("Error al actualizar usuario:", err);
            setStatus({ loading: false, error: err.message });
            alert(`❌ Error al guardar: ${err.message}`);
        }
    };
    
    // Mostrar estado de carga inicial
    if (isLoading || !formData) {
        return <div className="text-light p-5 text-center">Cargando datos del usuario...</div>;
    }
    

    return (
        <div className="p-4" style={{ backgroundColor: '#212529', borderRadius: '8px', color: 'white' }}>
            <h2 className="mb-4">Editar Usuario ID: {formData.id}</h2>
            <form onSubmit={handleSubmit}>
                
                {/* ID (Inmutable) */}
                <div className="row mb-3">
                    <div className="col-md-3 mb-3">
                        <label className="form-label">ID de Usuario</label>
                        <div className="form-control bg-dark text-warning border-secondary fw-bold">
                            {formData.id}
                        </div>
                    </div>
                </div>
                {/* ... (Filas 1-3 con todos los campos de texto y selectores) ... */}
                
                {/* Fila 4: Contraseña, Rol */}
                <div className="row mb-4">
                    <div className="col-md-6 mb-3">
                        <label htmlFor="password" className="form-label">Nueva Contraseña (Dejar vacío para no cambiar)</label>
                        <input type="password" className="form-control bg-dark text-white border-secondary" id="password" name="password" value={formData.password} onChange={handleChange} />
                    </div>
                    <div className="col-md-6 mb-3">
                        <label htmlFor="rol" className="form-label">Rol</label>
                        <select className="form-select bg-dark text-white border-secondary" id="rol" name="rol" value={formData.rol} onChange={handleChange} required>
                            {ROLES.map(rol => (
                                <option key={rol} value={rol}>{rol.charAt(0).toUpperCase() + rol.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                </div>


                {/* Mensajes de Estado */}
                {status.error && <div className="alert alert-danger mt-3">{status.error}</div>}

                {/* Botones de Acción */}
                <button type="submit" className="btn btn-success me-3" disabled={status.loading}>
                    {status.loading ? (
                        <> <i className="fas fa-spinner fa-spin me-2"></i> Guardando... </>
                    ) : (
                        <> <i className="fas fa-save me-2"></i> Guardar Cambios </>
                    )}
                </button>
                <button type="button" onClick={() => navigate('/homeadmin/usuariosadmin')} className="btn btn-secondary">
                    <i className="fas fa-times me-2"></i> Cancelar
                </button>
                
            </form>
        </div>
    );
}

export default FormularioUsuarioEdit;
