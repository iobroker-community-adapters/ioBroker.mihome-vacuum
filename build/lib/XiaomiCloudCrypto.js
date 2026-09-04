"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.XiaomiRC4Cipher = void 0;
exports.signedNonce = signedNonce;
exports.generateNonce = generateNonce;
exports.generateEncSignature = generateEncSignature;
exports.generateEncryptedParams = generateEncryptedParams;
const crypto = __importStar(require("node:crypto"));
function signedNonce(nonce, ssecurity) {
    return crypto
        .createHash('sha256')
        .update(Buffer.concat([Buffer.from(ssecurity, 'base64'), Buffer.from(nonce, 'base64')]))
        .digest('base64');
}
function generateNonce(millis, randomBytes = crypto.randomBytes) {
    const time = Buffer.alloc(4);
    time.writeUInt32BE(Math.floor(millis / 60_000), 0);
    return Buffer.concat([randomBytes(8), time]).toString('base64');
}
function generateEncSignature(url, method, signedNonceValue, params) {
    return crypto
        .createHash('sha1')
        .update([
        method,
        `/${url.split('/app/')[1]}`,
        ...Object.entries(params).map(([key, value]) => `${key}=${value}`),
        signedNonceValue,
    ].join('&'), 'utf8')
        .digest('base64');
}
function generateEncryptedParams(rc4, url, method, nonce, params, ssecurity) {
    params.rc4_hash__ = generateEncSignature(url, method, rc4.passwordB64, params);
    for (const [key, value] of Object.entries(params)) {
        params[key] = rc4.encrypt(value);
    }
    params.signature = generateEncSignature(url, method, rc4.passwordB64, params);
    params.ssecurity = ssecurity;
    params._nonce = nonce;
    return params;
}
class XiaomiRC4Cipher {
    passwordB64;
    key;
    state = new Uint8Array(256);
    stateIndex = 0;
    keyIndex = 0;
    constructor(passwordB64) {
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
    generateKeystreamByte() {
        this.stateIndex = (this.stateIndex + 1) % 256;
        this.keyIndex = (this.keyIndex + this.state[this.stateIndex]) % 256;
        [this.state[this.stateIndex], this.state[this.keyIndex]] = [
            this.state[this.keyIndex],
            this.state[this.stateIndex],
        ];
        return this.state[(this.state[this.stateIndex] + this.state[this.keyIndex]) % 256];
    }
    encrypt(plainText) {
        const input = Buffer.from(String(plainText), 'utf8');
        const output = Buffer.alloc(input.length);
        for (let index = 0; index < input.length; index++) {
            output[index] = input[index] ^ this.generateKeystreamByte();
        }
        return output.toString('base64');
    }
    decrypt(cipherTextB64) {
        const input = Buffer.from(cipherTextB64, 'base64');
        const output = Buffer.alloc(input.length);
        for (let index = 0; index < input.length; index++) {
            output[index] = input[index] ^ this.generateKeystreamByte();
        }
        return output.toString('utf8');
    }
}
exports.XiaomiRC4Cipher = XiaomiRC4Cipher;
//# sourceMappingURL=XiaomiCloudCrypto.js.map