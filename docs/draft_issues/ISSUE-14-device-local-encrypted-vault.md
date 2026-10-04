# Title: feat(vault): Device-local zero-knowledge encrypted card vault (Web Crypto AES-GCM + IndexedDB)

**Labels**: `security`, `frontend`, `cryptography`, `privacy`, `p2-medium`  
**Milestone**: Milestone 9 - Device-Local Encrypted Vault & Secure Storage  

---

## 1. User Story
**As a** Card Crew user who frequently needs my card details to complete online checkouts,  
**I want** an optional device-local encrypted vault protected by a personal master PIN,  
**So that** I can securely store and view my card details locally on my own smartphone/computer with zero-knowledge encryption, without ever transmitting sensitive card credentials to Card Crew cloud servers.

---

## 2. Brutal Audit Reasons & Problem Statement
From the Security & Architecture Review:
1. **Severe Cloud Storage Liability**:
   - Storing full credit card numbers, CVVs, or cardholder credentials in Supabase cloud tables would require full PCI-DSS Level 1 certification, expensive third-party audits, and massive compliance liability.
   - Any cloud breach could compromise users' financial instruments.
2. **Real-World User Need**:
   - When coordinating purchases, users often don't have their physical plastic card handy. They want a safe place on their own device to retrieve their card details without leaving plaintext notes in insecure messaging apps or phone memo pads.
3. **Zero-Knowledge Requirement**:
   - The solution must be mathematically zero-knowledge: Card Crew's backend must never receive the decryption key or plaintext payload.

---

## 3. Technical Specifications

### 3.1 Cryptographic Architecture
- **Algorithm**: AES-GCM 256-bit encryption.
- **Key Derivation**: PBKDF2 (Password-Based Key Derivation Function 2) using SHA-256 with at least 100,000 iterations.
- **Salt**: Unique 16-byte cryptographically secure random salt generated per device (`crypto.getRandomValues(new Uint8Array(16))`).
- **Initialization Vector (IV)**: 12-byte random IV per encrypted record.
- **Storage Layer**: IndexedDB via modern browser storage sandbox.
- **Auto-Lock Policy**: In-memory decryption key is wiped after 120 seconds of user inactivity or on `visibilitychange` (tab switch/backgrounding).

### 3.2 Vault Cryptography Utility (`frontend/src/utils/vaultCrypto.ts`)
```typescript
export interface EncryptedVaultRecord {
  id: string;
  iv: string; // Base64
  salt: string; // Base64
  ciphertext: string; // Base64
  updatedAt: string;
}

export interface DecryptedCardSecrets {
  fullPan: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
  notes?: string;
}

export class DeviceVault {
  private static async deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(pin),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  public static async encrypt(secrets: DecryptedCardSecrets, pin: string): Promise<{ ciphertext: string; iv: string; salt: string }> {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(pin, salt);

    const data = enc.encode(JSON.stringify(secrets));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt)),
    };
  }

  public static async decrypt(record: { ciphertext: string; iv: string; salt: string }, pin: string): Promise<DecryptedCardSecrets> {
    const dec = new TextDecoder();
    const salt = Uint8Array.from(atob(record.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(record.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(record.ciphertext), c => c.charCodeAt(0));

    const key = await this.deriveKey(pin, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return JSON.parse(dec.decode(decrypted));
  }
}
```

### 3.3 Vault UI & Auto-Lock State Machine (`VaultPage.tsx`)
1. **Initial State (Locked)**:
   - Prompts for 6-digit Master PIN.
   - If no vault exists on this device, provides "Create Device Vault" flow.
2. **Unlocked State**:
   - Displays cards stored locally.
   - Shows masked details with a tap-to-reveal toggle (reveals for 15 seconds with visible countdown).
   - "Copy to Clipboard" with auto-wipe after 30 seconds.
3. **Auto-Lock Trigger**:
   - `document.addEventListener('visibilitychange')` immediately locks vault when app is minimized.
   - 120-second inactivity timer clears key material from memory.

---

## 4. Step-by-Step Implementation Guide
1. **Build Crypto Module**:
   - Create `frontend/src/utils/vaultCrypto.ts`.
2. **Setup IndexedDB Wrapper**:
   - Create `frontend/src/utils/localVaultStorage.ts` to manage IndexedDB object stores (`card_crew_local_vault`).
3. **Build Vault Page / Drawer**:
   - Create `frontend/src/pages/VaultPage.tsx`.
   - Implement PIN pad component with numbers scrambled/secure styling.
4. **Implement Auto-Lock Lifecycle**:
   - Wire up `useEffect` listening to `visibilitychange` and user touch/mouse events.

---

## 5. Security, Privacy & Integrity Boundaries
- **Zero Cloud Transmission**: Verified by network inspector; no vault payload or PIN is ever sent in HTTP/WebSocket requests.
- **Memory Hygiene**: Discard decrypted objects as soon as the component unmounts or auto-lock fires.

---

## 6. Acceptance Criteria Checklist
- [ ] Vault uses AES-GCM 256-bit with PBKDF2 (100k iterations) via Web Crypto API.
- [ ] Vault records are persisted solely within device IndexedDB.
- [ ] Switching browser tabs or backgrounding the mobile app locks the vault immediately.
- [ ] Copied card details trigger a clipboard wipe after 30 seconds.
- [ ] Wrong PIN attempts show rate-limiting delay (exponential backoff after 3 failed attempts).
- [ ] Zero network requests contain encrypted or decrypted vault payloads.

---

## 7. Verification & Test Plan
1. **Cryptographic Integrity Test**:
   - Encrypt a payload with PIN "123456", decrypt with "123456" $\rightarrow$ assert success.
   - Attempt decryption with "654321" $\rightarrow$ assert cryptographic rejection error.
2. **Network Isolation Audit**:
   - Perform full vault operations while monitoring Network tab in DevTools; verify 0 outbound API calls occur.
