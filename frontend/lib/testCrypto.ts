/**
 * TEST SCRIPT for Phase 6
 * To be run manually by the user, injected into a client component.
 */

import {
  generateKeypair,
  exportPublicKey,
  deriveSharedSecret,
  deriveKey,
  encryptMessage,
  decryptMessage,
} from "./crypto";

export async function runCryptoTest() {
  console.log("=== Phase 6 Crypto Test Started ===");

  try {
    // 1. Generate Keypairs
    console.log("Generating keypairs for Alice and Bob...");
    const aliceKeys = await generateKeypair(false);
    const bobKeys = await generateKeypair(false);

    // 2. Export Public Keys
    console.log("Exporting public keys...");
    const alicePubBase64 = await exportPublicKey(aliceKeys.publicKey);
    const bobPubBase64 = await exportPublicKey(bobKeys.publicKey);

    // 3. Derive Shared Secrets
    console.log("Running ECDH...");
    const aliceSharedSecret = await deriveSharedSecret(
      aliceKeys.privateKey,
      bobPubBase64,
    );
    const bobSharedSecret = await deriveSharedSecret(
      bobKeys.privateKey,
      alicePubBase64,
    );

    // 4. HKDF Derivation
    console.log("Running HKDF for AES-GCM keys...");
    const salt = "test-salt";
    const info = "DM-v1";
    const aliceAesKey = await deriveKey(aliceSharedSecret, salt, info);
    const bobAesKey = await deriveKey(bobSharedSecret, salt, info);

    // 5. Encrypt
    const p1 = "Hello Bob! This is an E2EE message.";
    console.log(`Alice encrypting: "${p1}"`);
    const c1 = await encryptMessage(aliceAesKey, p1);
    console.log(`Alice ciphertext: ${c1}`);

    // 6. Decrypt
    console.log("Bob decrypting...");
    const p2 = await decryptMessage(bobAesKey, c1);
    console.log(`Bob decrypted: "${p2}"`);

    if (p1 === p2) {
      console.log("✅ ECDH -> HKDF -> AES-GCM lifecycle successful!");
    } else {
      console.error("❌ Decrypted text did not match original.");
    }
  } catch (err) {
    console.error("❌ Crypto Test Failed:", err);
  }
}
