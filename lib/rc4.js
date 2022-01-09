/*   based on
  *   https://github.com/sipiyou/edomi-roboroc/blob/main/php/cryptRC4.php
*/
class Crypt_RC4 {
 
    constructor(key, rounds) {
        this.setKey(key || '', rounds);
    }
 
    setKey(key, rounds) {
        let s= [];
        let i= 0;
        let j= 0;
        if (key.length > 0) {
            let arr= Buffer.from(key);
            let len= arr.length;
            let t;
            for (; i < 256; i++) {
                s[i] = i;
            }
     
            for (i = 0; i < 256; i++) {
                j = (j + s[i] + arr[i % len]) % 256;
                t = s[i];
                s[i] = s[j];
                s[j] = t;
            }
            i = j = 0;

            for (let c= 0; c < rounds; c++) {
                i = (i + 1) % 256;
                j = (j + s[i]) % 256;
                t = s[i];
                s[i] = s[j];
                s[j] = t;
            }
        }
        this.s= s;
        this.i= i;
        this.j= j;
    }
 
    crypt(paramstr) {
        let s= (this.s || []).slice(0); // Array copy
        let i= this.i || 0; 
        let j= this.j || 0;
        let len= paramstr.length;
        let out = Buffer.alloc(len);
        let t;
        for (let c= 0; c < len; c++) {
            i = (i + 1) % 256;
            j = (j + s[i]) % 256;
            t = s[i];
            s[i] = s[j];
            s[j] = t;
            t = (s[i] + s[j]) % 256;
            out[c]= paramstr.charCodeAt(c) ^ s[t];
        }
        return out;
    }

    encode(data){
        return this.crypt(data).toString('base64');
    }

    decode(data){
        return this.crypt(Buffer.from(data, 'base64').toString('ascii')).toString('ascii');
    }

}    //end of RC4 class

module.exports = Crypt_RC4;