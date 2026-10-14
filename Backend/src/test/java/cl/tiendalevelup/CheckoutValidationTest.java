package cl.tiendalevelup;
import cl.tiendalevelup.Entity.*;
import cl.tiendalevelup.Repository.*;
import cl.tiendalevelup.Service.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class CheckoutValidationTest {
    BoletaRepository receipts;UsuarioRepository users;ProductoRepository products;PedidoProducerService publisher;BoletaService service;
    @BeforeEach void setup(){receipts=mock(BoletaRepository.class);users=mock(UsuarioRepository.class);products=mock(ProductoRepository.class);publisher=mock(PedidoProducerService.class);service=new BoletaService(receipts,users,products,publisher);var user=new Usuario();user.setUsuarioId(1);when(users.findById(1)).thenReturn(Optional.of(user));}
    @Test void ignoresClientPriceAndPublishesServerTotal(){var product=new Producto();product.setId("sku");product.setPrecio(200);product.setDescuento(10);when(products.findById("sku")).thenReturn(Optional.of(product));when(products.descontarStockAtomicamente("sku",2)).thenReturn(1);when(products.stockActual("sku")).thenReturn(8);when(receipts.saveAndFlush(any())).thenAnswer(invocation->{Boleta receipt=invocation.getArgument(0);receipt.setId(10L);return receipt;});var receipt=service.generarBoleta(1,List.of(Map.of("productoId","sku","cantidad",2,"precioUnitario",1)));assertEquals(360,receipt.getTotal());verify(publisher).publicarEventosDeCompra(eq(10L),any(),eq(360.0),any(),any());}
    @Test void negativeQuantityCannotIncreaseStock(){assertThrows(ResponseStatusException.class,()->service.generarBoleta(1,List.of(Map.of("productoId","sku","cantidad",-3))));verifyNoInteractions(products);verify(receipts,never()).saveAndFlush(any());}
    @Test void concurrentStockExhaustionDoesNotCreateReceipt(){var product=new Producto();product.setId("sku");product.setPrecio(100);when(products.findById("sku")).thenReturn(Optional.of(product));when(products.descontarStockAtomicamente("sku",1)).thenReturn(0);assertThrows(ResponseStatusException.class,()->service.generarBoleta(1,List.of(Map.of("productoId","sku","cantidad",1))));verify(receipts,never()).saveAndFlush(any());verifyNoInteractions(publisher);}
}
