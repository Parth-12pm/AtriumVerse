# AtriumVerse End-to-End Encryption (E2EE) Architecture & Data Flow

This document provides a highly detailed, step-by-step breakdown of how data flows through the AtriumVerse application, specifically focusing on the End-to-End Encryption (E2EE) implementation.

## 1. High-Level System Architecture

AtriumVerse employs a **Hybrid Encryption Architecture** that strictly enforces the requirement that the server never sees plaintext messages or private keys. 

*   **Frontend (Next.js / WebCrypto API):** The frontend is the cryptographic brain. It uses native `window.crypto.subtle` APIs for all encryption and decryption operations. This ensures high performance and security without relying on slower user-land JavaScript libraries.
*   **Backend (FastAPI / PostgreSQL):** The backend is a "dumb" router and persistent state store. It receives encrypted blobs (ciphertexts) and metadata, stores them in PostgreSQL via SQLAlchemy, and serves them back to clients. The backend has zero knowledge of the actual message content.

### Cryptographic Primitives
1.  **Asymmetric Encryption (ECDH - X25519):** Used for key exchange. Every device has a public/private keypair. The public key is shared; the private key never leaves the browser.
2.  **Symmetric Encryption (AES-GCM-256):** Used for encrypting the actual message content. It is extremely fast and suitable for bulk data.
3.  **Key Derivation (HKDF-SHA256):** Used to securely derive a strong symmetric AES key from an asymmetric shared secret.

---

## 2. Data Flow: Device Registration & Bootstrapping

Because users can log in from multiple devices (e.g., phone, laptop), encryption cannot be tied solely to a "User." It must be tied to a "User + Device."

### Flow Steps:
1.  **Initial Login/Registration (Frontend):** 
    *   The user logs into AtriumVerse for the very first time on a specific browser.
    *   `crypto.ts` (`generateKeypair`) generates a new X25519 public/private keypair.
    *   The **Private Key** is saved securely in the browser's local storage (likely IndexedDB).
2.  **Device Registration (Frontend -> Backend):** 
    *   The frontend sends the **Public Key** to the FastAPI backend.
3.  **Storage (Backend):**
    *   The backend creates a new record in the `devices` table.
    *   Since this is the user's first device, it is immediately marked as `is_trusted = True`.

---

## 3. Data Flow: Direct Messages (1-on-1 Chat)

Direct messages are encrypted individually for every trusted device that needs to read them. This is known as "fan-out" encryption.

### Scenario: Alice sends "Hello" to Bob.
Both Alice and Bob might have multiple trusted devices (e.g., Alice has a Laptop and a Phone; Bob has a Desktop and a Tablet). 

#### Phase 1: Sending (Alice's Laptop)
1.  **Preparation:** Alice types "Hello". Alice's frontend queries the backend for the Public Keys of:
    *   Bob's trusted devices (Desktop, Tablet).
    *   Alice's *other* trusted devices (Phone) - so she can read her own sent messages elsewhere.
2.  **Encryption Fan-out (Frontend):**
    *   For *each* recipient device, Alice's frontend performs:
        *   `ECDH(Alice's Private Key, Target Device's Public Key) -> Shared Secret`
        *   `HKDF(Shared Secret) -> AES-256 Wrapping Key`
        *   `AES-GCM-Encrypt("Hello", Wrapping Key) -> Ciphertext Blob (base64url)`
3.  **Transmission (Frontend -> Backend):**
    *   Alice sends a single payload to the backend containing the sender/receiver IDs and a list of the encrypted blobs, mapped to their specific target `device_id`s.

#### Phase 2: Storage (Backend)
1.  The backend creates exactly **1 row** in the `direct_messages` table to represent the message metadata (sender, receiver, timestamp). The `content` column is marked `[encrypted]`.
2.  The backend creates **N rows** in the `dm_device_keys` table. Each row links the `dm_id`, a specific `device_id`, and that device's specific `encrypted_ciphertext`.

#### Phase 3: Receiving & Decryption (Bob's Desktop)
1.  **Fetching:** Bob opens his Desktop browser. The frontend fetches his direct messages from the backend.
2.  **Retrieval:** The backend looks at `dm_device_keys`, finds the row where `device_id == Bob's Desktop ID`, and sends down *only* that specific `encrypted_ciphertext`.
3.  **Decryption (Frontend):**
    *   Bob's frontend loads his Desktop's Private Key.
    *   `ECDH(Bob's Desktop Private Key, Alice's Laptop Public Key) -> Shared Secret`
    *   `HKDF(Shared Secret) -> AES-256 Wrapping Key`
    *   `AES-GCM-Decrypt(Ciphertext, Wrapping Key) -> "Hello"`
4.  The message "Hello" is rendered on the screen.

---

## 4. Data Flow: Server Channels (Group Chat)

Encrypting a message individually for 100+ devices in a large server channel is too slow and requires too much database storage. Instead, AtriumVerse uses **Epoch-based Symmetric Keys**.

### Architecture: The "Channel Key"
Every encrypted channel has a shared symmetric AES-256 "Channel Key". We call its current version an **Epoch**.

#### Phase 1: Channel Key Distribution
1.  When a channel is encrypted, a random symmetric AES-256 Channel Key is generated.
2.  The frontend encrypts a copy of this Channel Key for *every single trusted device* of *every single member* in the channel using the fan-out ECDH method described above.
3.  These wrapped keys are stored in the `channel_device_keys` table.

#### Phase 2: Sending a Channel Message
1.  **Encryption:** A user types a message in the channel. Their frontend simply looks up the active Channel Key for that channel, and encrypts the message using standard AES-GCM.
2.  **Storage:** The encrypted message is sent to the backend and stored directly in the `messages.ciphertext` column, along with the integer `epoch` representing which Channel Key was used.

#### Phase 3: Receiving a Channel Message
1.  **Key Retrieval:** A user opens the channel. Their frontend asks the backend for their secure copy of the Channel Key from `channel_device_keys`.
2.  **Key Decryption:** The frontend uses the device's Private Key to unwrap the AES-256 Channel Key.
3.  **Bulk Decryption:** The frontend uses this single Channel Key to rapidly decrypt every message in the channel that shares the same `epoch`.

---

## 5. Data Flow: Device Linking Ceremony

What happens when Alice logs in on her Phone for the first time? She needs her Private Keys, but the server doesn't have them.

1.  **Request:** The new Phone generates a new Keypair, sends the Public Key to the DB, and creates a `DeviceLinkRequest` with `status = PENDING`.
2.  **Approval (Laptop):** Alice gets a notification on her already-trusted Laptop. She approves the new Phone.
3.  **Key Transfer (Laptop -> Phone):**
    *   The Laptop takes its *own* historical private key data (or channel keys).
    *   It encrypts these secrets using the Phone's newly submitted Public Key (via ECDH -> AES).
    *   It sends this encrypted blob back to the server.
4.  **Finalization (Phone):**
    *   The Phone downloads the encrypted blob from the server.
    *   It uses its brand new Private Key to decrypt the blob, securely retrieving all the historical access keys it needs to participate in the E2EE network.
    *   The server updates the Phone's status to `is_trusted = True`.
