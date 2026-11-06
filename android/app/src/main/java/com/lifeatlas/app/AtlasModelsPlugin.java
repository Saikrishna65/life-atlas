package com.lifeatlas.app;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Only bundled, reviewed catalogue entries can be installed. No JS-supplied URL or digest. */
@CapacitorPlugin(name="AtlasModels")
public class AtlasModelsPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean canceled = new AtomicBoolean();
    private final AtomicBoolean busy = new AtomicBoolean();
    private volatile HttpURLConnection connection;
    @Override public void load(){worker.execute(()->{try{File[] files=directory().listFiles();if(files!=null)for(File f:files)if(f.getName().startsWith("download-")&&f.getName().endsWith(".part"))f.delete();}catch(IOException ignored){/* list/install report storage failures */}});}
    private File directory() throws IOException {
        File dir = new File(getContext().getNoBackupFilesDir(), "atlas-models");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Model storage unavailable");
        return dir;
    }
    private JSONArray catalogue() throws Exception {
        try (InputStream in = getContext().getAssets().open("atlas-model-catalogue.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int n;
            while ((n = in.read(buffer)) != -1) { if (bytes.size() + n > 65536) throw new IOException("Catalogue too large"); bytes.write(buffer,0,n); }
            return new JSONArray(bytes.toString("UTF-8"));
        }
    }
    private JSONObject entry(String id) throws Exception {
        JSONArray all = catalogue();
        for (int i=0;i<all.length();i++) {
            JSONObject m=all.getJSONObject(i);
            if (!m.getString("id").equals(id)) continue;
            if (!id.matches("[a-z0-9-]{1,80}") || !m.getString("revision").matches("[a-f0-9]{40}") || !m.getString("sha256").matches("[a-f0-9]{64}") || m.getString("sha256").matches("0+") || !m.getString("repository").matches("[\\w.-]+/[\\w.-]+") || !m.getString("filename").matches("[\\w.-]+\\.gguf") || m.getString("license").isEmpty() || !m.getString("licenseUrl").startsWith("https://")) throw new IOException("Invalid reviewed catalogue");
            long size=m.getLong("bytes"); if(size<=0||size>1500000000L) throw new IOException("Unsupported model size");
            return m;
        }
        throw new IOException("No reviewed model is available. Downloads are disabled.");
    }
    private File target(JSONObject m) throws Exception { return new File(directory(),m.getString("sha256")+".gguf"); }
    private String hash(File file) throws Exception {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(InputStream in=new FileInputStream(file)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1){if(canceled.get())throw new IOException("Canceled");digest.update(b,0,n);}}
        StringBuilder s=new StringBuilder();for(byte b:digest.digest())s.append(String.format("%02x",b&255));return s.toString();
    }
    private boolean verified(JSONObject m) throws Exception { File f=target(m);return f.isFile()&&f.length()==m.getLong("bytes")&&hash(f).equals(m.getString("sha256")); }
    private void operation(PluginCall call, Work task) {
        if(!busy.compareAndSet(false,true)){call.reject("Another model operation is active");return;}
        canceled.set(false);
        worker.execute(()->{try{task.run();}catch(Exception e){call.reject(e.getMessage());}finally{connection=null;busy.set(false);}});
    }
    private interface Work {void run() throws Exception;}
    @PluginMethod public void list(PluginCall call){operation(call,()->{
        JSONArray all=catalogue();JSArray result=new JSArray();
        for(int i=0;i<all.length();i++){JSONObject m=entry(all.getJSONObject(i).getString("id"));result.put(new JSObject().put("id",m.getString("id")).put("name",m.getString("name")).put("bytes",m.getLong("bytes")).put("installed",verified(m)));}
        call.resolve(new JSObject().put("models",result).put("availableBytes",directory().getUsableSpace()).put("selected",getContext().getSharedPreferences("atlas-model-selection",0).getString("id","")));
    });}
    @PluginMethod public void install(PluginCall call){operation(call,()->{
        if(!Boolean.TRUE.equals(call.getBoolean("consent")))throw new IOException("Explicit download consent required");
        JSONObject m=entry(call.getString("id",""));File dest=target(m);
        if(verified(m)){call.resolve();return;}
        long size=m.getLong("bytes");if(directory().getUsableSpace()<size*2+268435456L)throw new IOException("Insufficient free storage");
        File part=File.createTempFile("download-",".part",directory());
        try {
            URL url=new URL("https://huggingface.co/"+m.getString("repository")+"/resolve/"+m.getString("revision")+"/"+m.getString("filename"));
            for(int redirect=0;;redirect++){
                if(canceled.get())throw new IOException("Canceled");
                connection=(HttpURLConnection)url.openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(15000);
                int code=connection.getResponseCode();
                if(code>=300&&code<400){if(redirect>=5)throw new IOException("Too many redirects");String location=connection.getHeaderField("Location");connection.disconnect();if(location==null)throw new IOException("Invalid redirect");url=new URL(url,location);String host=url.getHost();if(!url.getProtocol().equals("https")||url.getUserInfo()!=null||!(host.equals("huggingface.co")||host.endsWith(".huggingface.co")||host.endsWith(".hf.co")))throw new IOException("Unapproved model download host");continue;}
                if(code!=200)throw new IOException("Model download failed: HTTP "+code);break;
            }
            String contentLength=connection.getHeaderField("Content-Length");long length=contentLength==null?-1:Long.parseLong(contentLength);if(length>=0&&length!=size)throw new IOException("Unexpected model size");
            final long[] last={0};
            try(InputStream in=connection.getInputStream()) {
                AtlasModelTransfer.copy(in,part,size,m.getString("sha256"),()->canceled.get(),received->{
                    long now=System.currentTimeMillis();if(now-last[0]>250){notifyListeners("progress",new JSObject().put("id",call.getString("id")).put("received",received).put("total",size));last[0]=now;}
                });
            }
            if(!hash(part).equals(m.getString("sha256")))throw new IOException("Model integrity verification failed");
            if(canceled.get())throw new IOException("Canceled");
            // Same-filesystem atomic rename. Never remove the previous file before promotion.
            if(!part.renameTo(dest))throw new IOException("Atomic model installation failed");
            call.resolve();
        }finally{if(connection!=null)connection.disconnect();if(part.exists())part.delete();}
    });}
    @PluginMethod public void cancel(PluginCall call){canceled.set(true);HttpURLConnection c=connection;if(c!=null)c.disconnect();call.resolve();}
    @PluginMethod public void select(PluginCall call){operation(call,()->{JSONObject m=entry(call.getString("id",""));if(!verified(m))throw new IOException("Model is missing or failed integrity verification");if(!getContext().getSharedPreferences("atlas-model-selection",0).edit().putString("id",m.getString("id")).commit())throw new IOException("Could not save model selection");call.resolve();});}
    @PluginMethod public void remove(PluginCall call){operation(call,()->{if(!Boolean.TRUE.equals(call.getBoolean("confirmed")))throw new IOException("Deletion confirmation required");JSONObject m=entry(call.getString("id",""));File file=target(m);if(file.exists()&&!file.delete())throw new IOException("Could not remove model");android.content.SharedPreferences prefs=getContext().getSharedPreferences("atlas-model-selection",0);if(prefs.getString("id","").equals(m.getString("id")))prefs.edit().remove("id").commit();call.resolve();});}
    @Override protected void handleOnDestroy(){canceled.set(true);if(connection!=null)connection.disconnect();worker.shutdown();}
}
