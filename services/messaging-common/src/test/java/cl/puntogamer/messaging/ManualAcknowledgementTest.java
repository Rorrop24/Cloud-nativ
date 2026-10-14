package cl.puntogamer.messaging;
import com.rabbitmq.client.Channel;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.*;
import org.springframework.amqp.core.*;
import org.springframework.dao.TransientDataAccessException;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class ManualAcknowledgementTest {
    private Channel channel;private ConfirmedPublisher publisher;private ManualAcknowledgement acknowledgement;
    @BeforeEach void setup(){channel=mock(Channel.class);publisher=mock(ConfirmedPublisher.class);var route=new MessagingProperties.Route("test.main","test.key","test.dlq","test.dead",30000);acknowledgement=new ManualAcknowledgement(new MessagingProperties("test.exchange","test.dlx",route,route,route,86400000,3),publisher);}
    private Message message(String value){return new Message(value.getBytes(StandardCharsets.UTF_8),new MessageProperties());}
    @Test void acknowledgesOnlyAfterProcessing()throws Exception{acknowledgement.process("pedidos",message("{\"idPedido\":\"ok\"}"),channel,42,body->{verifyNoInteractions(channel);});verify(channel).basicAck(42,false);verify(channel,never()).basicNack(anyLong(),anyBoolean(),anyBoolean());}
    @Test void malformedJsonIsRejectedWithoutRequeue()throws Exception{acknowledgement.process("pedidos",message("not-json"),channel,42,body->fail("No debe procesarse"));verify(channel).basicNack(42,false,false);verify(channel,never()).basicAck(anyLong(),anyBoolean());}
    @Test void processingExceptionGoesToDlq()throws Exception{acknowledgement.process("inventario",message("{}"),channel,42,body->{throw new IllegalArgumentException("Stock invalido");});verify(channel).basicNack(42,false,false);}
    @Test void transientFailureConfirmsRetryBeforeAcknowledgingOriginal()throws Exception{var original=message("{}");acknowledgement.process("pedidos",original,channel,42,body->{throw new TransientDataAccessException("Temporal"){};});var order=inOrder(publisher,channel);order.verify(publisher).retry(eq("test.exchange"),eq("test.key"),eq(original),eq(1),anyString());order.verify(channel).basicAck(42,false);}
    @Test void exhaustedRetryGoesToDlq()throws Exception{var original=message("{}");original.getMessageProperties().setHeader("x-attempt",3);acknowledgement.process("pedidos",original,channel,42,body->{throw new TransientDataAccessException("Temporal"){};});verify(channel).basicNack(42,false,false);verifyNoInteractions(publisher);}
    @Test void ackFailureDoesNotIssueSecondAcknowledgement()throws Exception{doThrow(new java.io.IOException("Conexion perdida")).when(channel).basicAck(42,false);assertThrows(java.io.IOException.class,()->acknowledgement.process("pedidos",message("{}"),channel,42,body->{}));verify(channel,never()).basicNack(anyLong(),anyBoolean(),anyBoolean());}
    @Test void retryAckFailureDoesNotIssueSecondAcknowledgement()throws Exception{doThrow(new java.io.IOException("Conexion perdida")).when(channel).basicAck(42,false);assertThrows(java.io.IOException.class,()->acknowledgement.process("pedidos",message("{}"),channel,42,body->{throw new TransientDataAccessException("Temporal"){};}));verify(channel,never()).basicNack(anyLong(),anyBoolean(),anyBoolean());}
}
