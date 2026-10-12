package cl.tiendalevelup.Entity;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name="USUARIO")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int usuarioId;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "apellido", nullable = false, length = 100)
    private String apellido;

    @Column(name = "rut", unique = true, nullable = false, length = 10)
    private String rut;

    @Column(name = "email", unique = true, nullable = false, length = 200)
    private String email;

    @Column(name = "azure_subject", unique = true, length = 80)
    private String azureSubject;

    @Column(name = "password", nullable = false, length = 300)
    private String password;

    @Column(name = "fecha", nullable = false)
    private String fechaNacimiento;

    @Column(name = "region", nullable = false, length = 100)
    private String region;

    @Column(name = "comuna", nullable = false, length = 100)
    private String comuna;

    @Column(name = "telefono", nullable = false, length = 20)
    private String telefono;

    @Column(name = "esduoc", nullable = false)
    private boolean esDuoc;

    @Column(name = "rol", nullable = false, length = 50)
    private String rol;

    // Getters y setters
    public int getUsuarioId() { return usuarioId; }
    public void setUsuarioId(int usuarioId) { this.usuarioId = usuarioId; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getApellido() { return apellido; }
    public void setApellido(String apellido) { this.apellido = apellido; }

    public String getRut() { return rut; }
    public void setRut(String rut) { this.rut = rut; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public String getAzureSubject() { return azureSubject; }
    public void setAzureSubject(String azureSubject) { this.azureSubject = azureSubject; }

    public String getFechaNacimiento() { return fechaNacimiento; }
    public void setFechaNacimiento(String fechaNacimiento) { this.fechaNacimiento = fechaNacimiento; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getComuna() { return comuna; }
    public void setComuna(String comuna) { this.comuna = comuna; }

    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }

    public boolean isEsDuoc() { return esDuoc; }
    public void setEsDuoc(boolean esDuoc) { this.esDuoc = esDuoc; }

    public String getRol() { return rol; }
    public void setRol(String rol) { this.rol = rol; }

    @Override
    public String toString() {
        return "Usuario{" +
                "usuarioId=" + usuarioId +
                ", nombre='" + nombre + '\'' +
                ", apellido='" + apellido + '\'' +
                ", rut='" + rut + '\'' +
                ", email='" + email + '\'' +
                ", fechaNacimiento='" + fechaNacimiento + '\'' +
                ", region='" + region + '\'' +
                ", comuna='" + comuna + '\'' +
                ", telefono='" + telefono + '\'' +
                ", esDuoc=" + esDuoc +
                ", rol='" + rol + '\'' +
                '}';
    }
}
