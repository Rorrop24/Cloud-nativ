import React, { useState, useEffect, useCallback } from 'react'; 
import { Link } from 'react-router-dom'; 
import Historial from './Historial'; 
import { getUsuarios, deleteUsuario } from '../utils/apihelper'; 

function TablaUsuarios() {
    const [usersArray, setUsersArray] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null); 

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getUsuarios(); 
            setUsersArray(data.map(u => ({ ...u, id: u.usuarioId || u.USUARIO_ID || u.id }))); 
        } catch (err) {
            console.error("Error al cargar usuarios:", err);
            setError(`No se pudo conectar al servidor para obtener la lista de usuarios: ${err}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleDelete = async (id, name) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar al usuario ${name} (ID: ${id})? Esta acción afectará la base de datos SQL.`)) {
            try {
                await deleteUsuario(id); 
                setUsersArray(prevUsers => prevUsers.filter(u => u.id !== id));
                alert(`Usuario ${name} eliminado exitosamente.`);
            } catch (err) {
                console.error("Error eliminando usuario:", err);
                alert(`Error al eliminar usuario: ${err}`);
            }
        }
    };

    const handleViewHistory = (user) => setSelectedUser(user);
    const handleCloseModal = () => setSelectedUser(null);

    return (
        <div className="admin-content-wrapper p-4 flex-grow-1" style={{ backgroundColor: '#000000ff' }}>
            
            <h1 className="text-light h4 mb-1">Gestión de Usuarios</h1>
            <p className="text-muted mb-4">Listado, roles y gestión de cuentas de usuario.</p>

            {loading && <p className="text-warning"><i className="fas fa-spinner fa-spin me-2"></i> Cargando usuarios...</p>}
            {error && <p className="alert alert-danger">{error}</p>}

            {selectedUser && (
                <Historial
                    userId={selectedUser.id}
                    userName={`${selectedUser.nombre || selectedUser.NOMBRE} ${selectedUser.apellido || selectedUser.APELLIDO}`}
                    onClose={handleCloseModal}
                />
            )}

            {!loading && !error && (
            <div className="table-responsive" style={{ backgroundColor: '#212529', borderRadius: '8px', padding: '10px' }}>
                <table className="table table-dark table-striped table-hover align-middle">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre Completo</th>
                            <th>RUT</th>
                            <th>Email</th>
                            <th>Teléfono</th>
                            <th>Rol</th>
                            <th>Duoc</th>
                            <th style={{ width: '150px' }}>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        {usersArray.map((user) => {
                            const rolNormalizado = String(user.rol || user.ROL || '').toLowerCase().trim();
                            const esAdmin = rolNormalizado === 'admin';

                            return (
                                <tr key={user.id}>
                                    <th>{user.id}</th>
                                    <td>{user.nombre || user.NOMBRE} {user.apellido || user.APELLIDO}</td>
                                    <td>{user.rut || user.RUT}</td>
                                    <td>{user.email || user.EMAIL}</td>
                                    <td>{user.telefono || user.TELEFONO}</td>
                                    <td>
                                        <span className={`badge bg-${esAdmin ? 'warning' : 'info'}`}>
                                            {user.rol || user.ROL || 'cliente'}
                                        </span>
                                    </td>
                                    <td>
                                        <i className={`fas fa-${(user.esDuoc || user.ESDUOC) ? 'check-circle text-success' : 'times-circle text-danger'}`}></i>
                                    </td>

                                    <td>
                                        {/* RUTA CORREGIDA */}
                                        <Link 
                                            to={`/editaruser/${user.id}`}
                                            className="btn btn-sm btn-primary me-1"
                                            title="Editar Usuario"
                                        >
                                            <i className="fas fa-edit"></i>
                                        </Link>

                                        <button 
                                            onClick={() => handleViewHistory(user)} 
                                            className="btn btn-sm btn-info me-1"
                                            title="Ver Historial"
                                        >
                                            <i className="fas fa-history"></i>
                                        </button>

                                        {!esAdmin && (
                                            <button 
                                                onClick={() => handleDelete(user.id, user.nombre || user.NOMBRE)} 
                                                className="btn btn-sm btn-danger"
                                                title="Eliminar Usuario"
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {usersArray.length === 0 && !loading && (
                    <p className="text-center text-muted p-3">No hay usuarios registrados.</p>
                )}
            </div>
            )}
        </div>
    );
}

export default TablaUsuarios;
