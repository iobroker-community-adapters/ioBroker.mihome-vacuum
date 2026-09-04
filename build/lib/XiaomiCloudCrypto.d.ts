export type XiaomiEncryptedParams = Record<string, string>;
export declare function signedNonce(nonce: string, ssecurity: string): string;
export declare function generateNonce(millis: number, randomBytes?: (size: number) => Buffer): string;
export declare function generateEncSignature(url: string, method: string, signedNonceValue: string, params: XiaomiEncryptedParams): string;
export declare function generateEncryptedParams(rc4: XiaomiRC4Cipher, url: string, method: string, nonce: string, params: XiaomiEncryptedParams, ssecurity: string): XiaomiEncryptedParams;
export declare class XiaomiRC4Cipher {
    readonly passwordB64: string;
    private readonly key;
    private readonly state;
    private stateIndex;
    private keyIndex;
    constructor(passwordB64: string);
    private generateKeystreamByte;
    encrypt(plainText: unknown): string;
    decrypt(cipherTextB64: string): string;
}
