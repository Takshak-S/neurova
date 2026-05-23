import { keyManager } from "./keyManager";

// RSA-OAEP encryption/decryption for messages.
//
// Encrypt flow (sender):
//   1. Fetch receiver's public key from server (base64)
//   2. Import it into a CryptoKey
//   3. Encrypt the plaintext message → ciphertext (ArrayBuffer)
//   4. Base64-encode ciphertext → encryptedText (string, safe for JSON)
//   5. Send { encryptedText, iv: "" } to server (RSA-OAEP doesn't use IV,
//      but the schema expects it — we send an empty string)
//
// Decrypt flow (receiver):
//   1. Load own private key from IndexedDB
//   2. Base64-decode encryptedText → ArrayBuffer
//   3. Decrypt with private key → plaintext
//
// Note on RSA-OAEP message size limit:
// RSA-OAEP with 2048-bit key can encrypt max ~190 bytes.
// For longer messages, the production approach is AES-GCM hybrid encryption:
//   - Generate random AES key per message
//   - Encrypt message content with AES-GCM
//   - Encrypt the AES key with RSA-OAEP
//   - Send both encrypted payloads
// We implement the hybrid approach here for production correctness.

export interface EncryptedPayload {
    encryptedText: string; // base64(RSA-encrypted AES key + AES-encrypted content)
    iv: string;            // base64(AES-GCM IV)
}

export const messageEncryption = {
    // Encrypts a plaintext message for a recipient.
    // Uses AES-GCM for the content + RSA-OAEP for the AES key (hybrid).
    async encrypt(
        plaintext: string,
        recipientPublicKeyBase64: string
    ): Promise<EncryptedPayload> {
        // Step 1: Import recipient's public key
        const recipientPublicKey = await keyManager.importPublicKey(
            recipientPublicKeyBase64
        );

        // Step 2: Generate a random AES-GCM key for this message
        const aesKey = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true, // extractable — we need to export it for RSA wrapping
            ["encrypt"]
        );

        // Step 3: Generate a random IV for AES-GCM (12 bytes is standard)
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Step 4: Encrypt the plaintext with AES-GCM
        const encoder = new TextEncoder();
        const plaintextBytes = encoder.encode(plaintext);
        const encryptedContent = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            aesKey,
            plaintextBytes
        );

        // Step 5: Export the AES key as raw bytes
        const aesKeyRaw = await crypto.subtle.exportKey("raw", aesKey);

        // Step 6: Encrypt the AES key with the recipient's RSA public key
        const encryptedAesKey = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            recipientPublicKey,
            aesKeyRaw
        );

        // Step 7: Concatenate encryptedAesKey + encryptedContent
        // Format: [4 bytes: AES key length][AES key ciphertext][message ciphertext]
        // This allows the receiver to split them without needing a separator
        const aesKeyLength = new Uint32Array([encryptedAesKey.byteLength]);
        const combined = new Uint8Array(
            4 + encryptedAesKey.byteLength + encryptedContent.byteLength
        );
        combined.set(new Uint8Array(aesKeyLength.buffer), 0);
        combined.set(new Uint8Array(encryptedAesKey), 4);
        combined.set(new Uint8Array(encryptedContent), 4 + encryptedAesKey.byteLength);

        return {
            encryptedText: btoa(String.fromCharCode(...combined)),
            iv: btoa(String.fromCharCode(...iv)),
        };
    },

    // Decrypts a message using the receiver's private key from IndexedDB.
    async decrypt(payload: EncryptedPayload): Promise<string> {
        const privateKey = await keyManager.getPrivateKey();
        if (!privateKey) {
            throw new Error(
                "No private key found. Your encryption keys may have been cleared."
            );
        }

        // Decode the combined payload
        const combined = Uint8Array.from(atob(payload.encryptedText), (c) =>
            c.charCodeAt(0)
        );
        const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));

        // Extract AES key length from first 4 bytes
        const aesKeyLength = new DataView(combined.buffer).getUint32(0);

        // Split into encrypted AES key and encrypted content
        const encryptedAesKey = combined.slice(4, 4 + aesKeyLength);
        const encryptedContent = combined.slice(4 + aesKeyLength);

        // Decrypt the AES key with our RSA private key
        const aesKeyRaw = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encryptedAesKey
        );

        // Import the AES key
        const aesKey = await crypto.subtle.importKey(
            "raw",
            aesKeyRaw,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        // Decrypt the message content
        const plaintextBytes = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            aesKey,
            encryptedContent
        );

        return new TextDecoder().decode(plaintextBytes);
    },

    // Prepares messages for the AI endpoint — decrypts all of them.
    // Called only when the user explicitly triggers an AI feature.
    async decryptBatch(
        messages: Array<{ _id: string; encryptedText: string; iv: string; senderId: string; createdAt: string }>,
        memberMap: Record<string, string> // userId → name
    ) {
        const results = await Promise.allSettled(
            messages.map(async (msg) => ({
                senderId: msg.senderId,
                senderName: memberMap[msg.senderId],
                content: await messageEncryption.decrypt({
                    encryptedText: msg.encryptedText,
                    iv: msg.iv,
                }),
                createdAt: msg.createdAt,
            }))
        );

        return results
            .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
            .map((r) => r.value);
    },
};