import { openDB, IDBPDatabase } from "idb";

// The private key never leaves the browser.
// We use the Web Crypto API with extractable: false — the key exists
// in the browser's secure key store and JS can USE it but never export it.
// This is stronger than storing a raw key string in IndexedDB.
//
// However, for the PUBLIC key we need to export it to send to the server,
// so it's created with extractable: true.
//
// Algorithm: RSA-OAEP with SHA-256
// - RSA-OAEP is the standard for asymmetric encryption
// - 2048-bit modulus — secure, widely supported, reasonable performance
// - SHA-256 hash algorithm

const DB_NAME = "neurova_keys";
const DB_VERSION = 1;
const STORE_NAME = "key_pairs";
const KEY_ID = "neurova_main_keypair";

interface StoredKeyPair {
    id: string;
    privateKey: CryptoKey;          // non-extractable — cannot be exported
    publicKeySpki: ArrayBuffer;     // exported SPKI format — sent to server
}

const getDB = async (): Promise<IDBPDatabase> => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        },
    });
};

// RSA-OAEP parameters — used for key generation and import
const RSA_PARAMS: RsaHashedKeyGenParams = {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), // 65537
    hash: "SHA-256",
};

export const keyManager = {
    // Generates a new RSA-OAEP key pair and stores it in IndexedDB.
    // Returns the public key in base64 format for uploading to the server.
    async generateAndStore(): Promise<string> {
        const keyPair = await window.crypto.subtle.generateKey(
            RSA_PARAMS,
            false,       // privateKey is NON-EXTRACTABLE — cannot be exported as raw bytes
            ["encrypt", "decrypt"]
        );

        // Export the public key in SPKI format (standard public key encoding)
        const publicKeySpki = await window.crypto.subtle.exportKey(
            "spki",
            keyPair.publicKey
        );

        const db = await getDB();
        await db.put(STORE_NAME, {
            id: KEY_ID,
            privateKey: keyPair.privateKey,
            publicKeySpki,
        } satisfies StoredKeyPair);

        // Convert to base64 for sending to the server
        return arrayBufferToBase64(publicKeySpki);
    },

    // Loads the stored private key — used for decryption
    async getPrivateKey(): Promise<CryptoKey | null> {
        const db = await getDB();
        const stored = await db.get(STORE_NAME, KEY_ID) as StoredKeyPair | undefined;
        return stored?.privateKey ?? null;
    },

    // Loads the stored public key in CryptoKey format — used for encrypting
    // messages TO this user (e.g. when sending to yourself in a saved note)
    async getPublicKey(): Promise<CryptoKey | null> {
        const db = await getDB();
        const stored = await db.get(STORE_NAME, KEY_ID) as StoredKeyPair | undefined;
        if (!stored) return null;

        return window.crypto.subtle.importKey(
            "spki",
            stored.publicKeySpki,
            RSA_PARAMS,
            true,
            ["encrypt"]
        );
    },

    // Returns true if a key pair exists in IndexedDB
    async hasKeyPair(): Promise<boolean> {
        const db = await getDB();
        const stored = await db.get(STORE_NAME, KEY_ID);
        return !!stored;
    },

    // Imports a recipient's public key from base64 (fetched from server)
    // Returns a CryptoKey ready for encryption
    async importPublicKey(base64PublicKey: string): Promise<CryptoKey> {
        const spki = base64ToArrayBuffer(base64PublicKey);
        return window.crypto.subtle.importKey(
            "spki",
            spki,
            RSA_PARAMS,
            true,
            ["encrypt"]
        );
    },

    // Clears the stored key pair — called on logout.
    // WARNING: this permanently destroys the ability to decrypt old messages.
    // In production, warn the user before calling this.
    async clearKeyPair(): Promise<void> {
        const db = await getDB();
        await db.delete(STORE_NAME, KEY_ID);
    },
};

// ─── Encoding utilities ───────────────────────────────────────────────────────

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};