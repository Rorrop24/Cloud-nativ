package cl.tiendalevelup.Entity;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "categorias")
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;

    // Relación con productos
    @OneToMany(mappedBy = "categoria", cascade = CascadeType.ALL)
    @JsonIgnore  
    private List<Producto> productos = new ArrayList<>();

    // Getters y Setters
    public Long getId()
         { return id; }

    public void setId(Long id)
        { this.id = id; }

    public String getNombre()
        { return nombre; }

    public void setNombre(String nombre)
        { this.nombre = nombre; }

    public List<Producto> getProductos()
        { return productos; }
        
    public void setProductos(List<Producto> productos)
        { this.productos = productos; }
}

