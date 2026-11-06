package com.lifeatlas.app;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
/** Disabled staging only. Never replaces the passphrase key or rewrites conversation ciphertext. */
public final class AtlasKeyWrapper {
    public static final boolean ACTIVATION_ENABLED=false;
    private static final String ALIAS="atlas-ai-wrapper-v1";
    private static SecretKey key(boolean create) throws Exception {
        if(!ACTIVATION_ENABLED)throw new IllegalStateException("Keystore activation awaits device recovery validation");
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(!store.containsAlias(ALIAS)){
            if(!create)throw new IllegalStateException("Wrapper key unavailable. Recover using the passphrase.");
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setUserAuthenticationRequired(true).setUserAuthenticationValidityDurationSeconds(30).build());
            generator.generateKey();
        }
        return (SecretKey)store.getKey(ALIAS,null);
    }
    public static byte[][] wrap(byte[] existingKey) throws Exception {
        if(existingKey.length!=32)throw new IllegalArgumentException("AES-256 key required");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key(true));
        return new byte[][]{cipher.getIV(),cipher.doFinal(existingKey)};
    }
    public static byte[] unwrap(byte[] iv,byte[] wrapped) throws Exception {
        if(iv.length!=12)throw new IllegalArgumentException("Invalid wrapper IV");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(false),new GCMParameterSpec(128,iv));
        return cipher.doFinal(wrapped);
    }
}
