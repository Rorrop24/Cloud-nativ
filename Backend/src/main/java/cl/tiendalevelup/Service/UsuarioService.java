package cl.tiendalevelup.Service;

import cl.tiendalevelup.Entity.Usuario;
import cl.tiendalevelup.Repository.UsuarioRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UsuarioService {

    @Autowired
    private UsuarioRepository repository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public Usuario saveUsuario(Usuario u) {

        // Validar email duplicado
        if (repository.findByEmail(u.getEmail()).isPresent()) {
            throw new RuntimeException("El correo ya está registrado");
        }

        if (repository.existsByRut(u.getRut())) {
        throw new RuntimeException("El RUT ya está registrado");
        }

        // 🔐 Encriptar contraseña
        u.setPassword(passwordEncoder.encode(u.getPassword()));

        // Rol por defecto
        if (u.getRol() == null || u.getRol().isBlank()) {
            u.setRol("USER");
        }
        

        return repository.save(u);
    }

    // Crear varios usuarios
    public List<Usuario> saveUsuarios(List<Usuario> usuarios) {
        usuarios.forEach(u -> u.setPassword(passwordEncoder.encode(u.getPassword())));
        return repository.saveAll(usuarios);
    }

    // Obtener todos
    public List<Usuario> getUsuarios() {
        return repository.findAll();
    }

    // Obtener por ID
    public Usuario getUsuarioById(int usuarioId) {
        return repository.findById(usuarioId).orElse(null);
    }

    // Obtener por RUT
    public Usuario getUsuarioByRut(String rut) {
        return repository.findByRut(rut);
    }

    // Obtener por nombre
    public Usuario getUsuarioByNombre(String nombre) {
        return repository.findByNombre(nombre);
    }

    public Usuario getUsuarioByEmail(String email) {
        Optional<Usuario> usuario = repository.findByEmail(email);
        return usuario.orElse(null);
    }

    // Eliminar usuario
    public String deleteUsuario(int id) {
        repository.deleteById(id);
        return "Usuario Eliminado " + id;
    }

    public String deleteUsuarioByRut(String rut) {
        repository.deleteByRut(rut);
        return "Usuario del RUT " + rut + " eliminado";
    }

    // Actualizar usuario (SIN cambiar password)
    public Usuario updateUsuario(Usuario u) {
        return repository.findById(u.getUsuarioId())
                .map(existing -> {
                    existing.setNombre(u.getNombre());
                    existing.setApellido(u.getApellido());
                    existing.setEmail(u.getEmail());
                    return repository.save(existing);
                })
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }
}
