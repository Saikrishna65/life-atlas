/**
 * Life Atlas Finance: Secure Storage Architecture & Native Android Key Management
 * 
 * ============================================================================
 * SECURITY AUDIT & HONEST DISCLOSURE OF LOCAL STORAGE BOUNDARIES
 * ============================================================================
 * 
 * 1. Current Storage Engine: IndexedDB (life_atlas_finance_db)
 *    - On Web browsers and standard Capacitor WebView for Android, IndexedDB is stored
 *      inside the private application data directory:
 *      `/data/data/com.lifeatlas.app/app_webview/IndexedDB/`
 *    - Android OS enforces sandboxing boundaries (SELinux + Linux user UID/GID), which
 *      prevents other standard Android apps from reading this directory.
 *    - HOWEVER, IndexedDB on disk is NOT encrypted at rest by default.
 *    - On rooted Android devices or via direct adb file-system backups (if debuggable),
 *      the raw LevelDB files can theoretically be examined.
 * 
 * 2. Hardware-Backed Encryption Strategy (Target Native Android):
 *    - To achieve military-grade hardware encryption at rest, the app will integrate
 *      with the Android Keystore System (`KeyStore` / `MasterKey` / `EncryptedSharedPreferences`)
 *      and SQLCipher / Room DB encrypted with a 256-bit AES-GCM key stored in Keystore.
 *    - Below is the `ISecureStorageAdapter` interface that abstracts this boundary.
 *    - This ensures the application domain is 100% prepared to swap or wrap the storage
 *      layer with hardware-backed encryption without modifying financial business logic.
 */

export interface ISecureStorageAdapter {
  /**
   * Encrypts plaintext data using a hardware-backed key before writing to disk
   */
  encrypt(plaintext: string): Promise<string>;

  /**
   * Decrypts ciphertext data retrieved from storage
   */
  decrypt(ciphertext: string): Promise<string>;

  /**
   * Returns whether hardware-backed secure storage (e.g. Android Keystore / StrongBox) is active
   */
  isHardwareBacked(): boolean;

  /**
   * Diagnostic name of the encryption provider (e.g. "Software-IndexedDB-Plaintext", "Android-Keystore-AES256")
   */
  getProviderName(): string;
}

/**
 * Standard Passthrough Adapter (used when running in standard WebView without native SQLCipher plugin)
 * Honestly reports that hardware encryption is not active.
 */
export class WebIndexedDBSecureStorageAdapter implements ISecureStorageAdapter {
  async encrypt(plaintext: string): Promise<string> {
    // In standard web/Capacitor WebView, data is stored in the OS-sandboxed IndexedDB
    return plaintext;
  }

  async decrypt(ciphertext: string): Promise<string> {
    return ciphertext;
  }

  isHardwareBacked(): boolean {
    return false;
  }

  getProviderName(): string {
    return "OS-Sandboxed-IndexedDB (Unencrypted at rest)";
  }
}

