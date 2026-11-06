package com.lifeatlas.app;
import java.io.*;
import java.security.MessageDigest;
/** Bounded transfer primitive; caller owns temporary-file cleanup and atomic promotion. */
public final class AtlasModelTransfer {
    public interface Cancellation { boolean canceled(); }
    public interface Progress { void received(long bytes); }
    public static void copy(InputStream in, File temporary, long expectedBytes, String expectedHash, Cancellation cancellation, Progress progress) throws Exception {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");long count=0;
        try(FileOutputStream out=new FileOutputStream(temporary)) {
            byte[] buffer=new byte[65536];int n;
            while((n=in.read(buffer))!=-1) {
                if(cancellation.canceled())throw new IOException("Canceled");
                count+=n;if(count>expectedBytes)throw new IOException("Model exceeds catalogue size");
                out.write(buffer,0,n);digest.update(buffer,0,n);progress.received(count);
            }
            out.getFD().sync();
        }
        if(cancellation.canceled())throw new IOException("Canceled");
        if(count!=expectedBytes)throw new IOException("Incomplete download");
        StringBuilder hash=new StringBuilder();for(byte b:digest.digest())hash.append(String.format("%02x",b&255));
        if(!hash.toString().equals(expectedHash))throw new IOException("Model integrity verification failed");
    }
}
