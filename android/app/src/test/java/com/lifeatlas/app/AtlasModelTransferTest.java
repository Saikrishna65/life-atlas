package com.lifeatlas.app;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicLong;
public class AtlasModelTransferTest {
    // Published SHA-256 test vector for "abc", not a model catalogue entry.
    private final String digest="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    @Test public void validTransferReportsProgress() throws Exception {
        File temp=File.createTempFile("atlas-model-test", ".part");
        try{AtomicLong progress=new AtomicLong();AtlasModelTransfer.copy(new ByteArrayInputStream("abc".getBytes(StandardCharsets.UTF_8)),temp,3,digest,()->false,progress::set);assertEquals(3,temp.length());assertEquals(3,progress.get());}finally{temp.delete();}
    }
    @Test public void failuresNeverReturnVerified() throws Exception {
        for(int kind=0;kind<4;kind++){
            File temp=File.createTempFile("atlas-model-test", ".part");final boolean cancel=kind==0;
            try{AtlasModelTransfer.copy(new ByteArrayInputStream(new byte[]{97,98,99}),temp,kind==1?4:kind==2?2:3,kind==3?"bad":digest,()->cancel,n->{});fail("Invalid transfer accepted");}catch(IOException expected){assertNotNull(expected.getMessage());}finally{temp.delete();}
        }
    }
}
