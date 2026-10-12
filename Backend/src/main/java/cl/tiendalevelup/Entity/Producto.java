package cl.tiendalevelup.Entity;

import java.util.HashMap;
import java.util.Map;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.Table;

@Entity
@Table(name = "productos")
public class Producto {

    @Id
    private String id; // KB001, JM001, etc.

    private String nombre;
    private double precio;
    private double descuento;
    private boolean oferta;
    private double rating;
    private String descripcion;
    private String imagen;
    private int stock;
    private int stockCritico;

    @ElementCollection
    @CollectionTable(name = "producto_detalles", joinColumns = @JoinColumn(name = "producto_id"))
    @MapKeyColumn(name = "detalle_clave")
    @Column(name = "detalle_valor")
    private Map<String, String> detalles = new HashMap<>();

    // Relación con categoría
    @ManyToOne
    @JoinColumn(name = "categoria_id")
    private Categoria categoria;

    @Column(name = "destacado")
    private Boolean destacado;

    // Getters y Setters
    public String getId()
        { return id; }

    public void setId(String id)
        { this.id = id; }

    public String getNombre()
        { return nombre; }

    public void setNombre(String nombre)
        { this.nombre = nombre; }

    public double getPrecio()
        { return precio; }

    public void setPrecio(double precio) 
        { this.precio = precio; }
    
    public double getDescuento()
        { return descuento; }

    public void setDescuento(double descuento)
        { this.descuento = descuento; }

    public boolean isOferta()
        { return oferta; }

    public void setOferta(boolean oferta)
        { this.oferta = oferta; }

    public double getRating()
        { return rating; }

    public void setRating(double rating)
        { this.rating = rating; }

    public String getDescripcion() 
        { return descripcion; }

    public void setDescripcion(String descripcion)
         { this.descripcion = descripcion; }

    public String getImagen()
         { return imagen; }

    public void setImagen(String imagen)
         { this.imagen = imagen; }

    public int getStock()
         { return stock; }

    public void setStock(int stock)
        { this.stock = stock; }

    public int getStockCritico()
        { return stockCritico; }

    public void setStockCritico(int stockCritico)
        { this.stockCritico = stockCritico; }

    public Map<String, String> getDetalles()
        { return detalles; }

    public void setDetalles(Map<String, String> detalles)
        { this.detalles = detalles; }

    public Categoria getCategoria()
        { return categoria; }

    public void setCategoria(Categoria categoria)
        { this.categoria = categoria; }

    public Boolean getDestacado()
        { return destacado; }

    public void setDestacado(Boolean destacado)
        { this.destacado = destacado; }    
}
