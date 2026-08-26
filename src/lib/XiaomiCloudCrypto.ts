import * as crypto from 'node:crypto';

export type XiaomiEncryptedParams = Record<string, string>;

export function signedNonce(nonce: string, ssecurity: string): string {
    return crypto
        .createHash('sha256')
        .update(Buffer.concat([Buffer.from(ssecurity, 'base64'), Buffer.from(nonce, 'base64')]))
        .digest('base64');
}

export function generateNonce(millis: number, randomBytes: (size: number) => Buffer = crypto.randomBytes): string {
    const time = Buffer.alloc(4);
    time.writeUInt32BE(Math.floor(millis / 60_000), 0);
    return Buffer.concat([randomBytes(8), time]).toString('base64');
}

export function generateEncSignature(
    url: string,
    method: string,
    signedNonceValue: string,
    params: XiaomiEncryptedParams,
): string {
    return crypto
        .createHash('sha1')
        .update(
            [
                method,
                `/${url.split('/app/')[1]}`,
                ...Object.entries(params).map(([key, value]) => `${key}=${value}`),
                signedNonceValue,
            ].join('&'),
            'utf8',
        )
        .digest('base64');
}

export function generateEncryptedParams(
    rc4: XiaomiRC4Cipher,
    url: string,
    method: string,
    nonce: string,
    params: XiaomiEncryptedParams,
    ssecurity: string,
): XiaomiEncryptedParams {
    params.rc4_hash__ = generateEncSignature(url, method, rc4.passwordB64, params);
    for (const [key, value] of Object.entries(params)) {
        params[key] = rc4.encrypt(value);
    }
    params.signature = generateEncSignature(url, method, rc4.passwordB64, params);
    params.ssecurity = ssecurity;
    params._nonce = nonce;
    return params;
}

export class XiaomiRC4Cipher {
    readonly passwordB64: string;
    private readonly key: Buffer;
    private readonly state = new Uint8Array(256);
    private stateIndex = 0;
    private keyIndex = 0;

    constructor(passwordB64: string) {
        this.passwordB64 = passwordB64;
        this.key = Buffer.from(passwordB64, 'base64');
        for (let index = 0; index < 256; index++) {
            this.state[index] = index;
        }
        let keyIndex = 0;
        for (let index = 0; index < 256; index++) {
            keyIndex = (keyIndex + this.state[index] + this.key[index % this.key.length]) % 256;
            [this.state[index], this.state[keyIndex]] = [this.state[keyIndex], this.state[index]];
        }
        for (let drop = 0; drop < 1024; drop++) {
            this.generateKeystreamByte();
        }
    }

    private generateKeystreamByte(): number {
        this.stateIndex = (this.stateIndex + 1) % 256;
        this.keyIndex = (this.keyIndex + this.state[this.stateIndex]) % 256;
        [this.state[this.stateIndex], this.state[this.keyIndex]] = [
            this.state[this.keyIndex],
            this.state[this.stateIndex],
        ];
        return this.state[(this.state[this.stateIndex] + this.state[this.keyIndex]) % 256];
    }

    encrypt(plainText: unknown): string {
        const input = Buffer.from(String(plainText), 'utf8');
        const output = Buffer.alloc(input.length);
        for (let index = 0; index < input.length; index++) {
            output[index] = input[index] ^ this.generateKeystreamByte();
        }
        return output.toString('base64');
    }

    decrypt(cipherTextB64: string): string {
        const input = Buffer.from(cipherTextB64, 'base64');
        const output = Buffer.alloc(input.length);
        for (let index = 0; index < input.length; index++) {
            output[index] = input[index] ^ this.generateKeystreamByte();
        }
        return output.toString('utf8');
    }
}
