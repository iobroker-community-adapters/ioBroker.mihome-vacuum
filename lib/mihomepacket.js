const crypto = require('crypto');

function Packet(token, adapter) {
    // Properties
    this.magic = Buffer.alloc(2);
    this.len = Buffer.alloc(2);
    this.unknown = Buffer.alloc(4);
    this.serial = Buffer.alloc(4);
    this.stamp = Buffer.alloc(4);
    this.checksum = Buffer.alloc(16);
    this.data = Buffer.alloc(0);
    this.token = Buffer.alloc(16);
    this.key = Buffer.alloc(16);
    this.iv = Buffer.alloc(16);
    this.plainMessageOut = '';
    this.ioskey = Buffer.from('00000000000000000000000000000000', 'hex');
    this.adapter = adapter;
    // Methods
    this.msgCounter = 1;

    // for Timediff calculation
    this.stamprec = Buffer.alloc(4);
    this.timediff = 0;

    // Functions and internal functions
    this.setHelo = function () {
        this.magic = Buffer.from('2131', 'hex');
        this.len = Buffer.from('0020', 'hex');
        this.unknown = Buffer.from('FFFFFFFF', 'hex');
        this.serial = Buffer.from('FFFFFFFF', 'hex');
        this.stamp = Buffer.from('FFFFFFFF', 'hex');
        this.checksum = Buffer.from('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 'hex');
        this.data = Buffer.alloc(0);
    };
    /*
        this.getRaw = function () {
              if (this.data.length > 0) {
                    this.len = Buffer.from(decimalToHex(this.data.length + 32,4), 'hex');
                    const zwraw = Buffer.from(this.magic.toString('hex') + this.len.toString('hex') + this.unknown.toString('hex') + this.serial.toString('hex') + this.stamp.toString('hex') + this.token.toString('hex') + this.data.toString('hex'), 'hex');
                    //const zwraw = Buffer(this.magic.toString('hex')+this.len.toString('hex')+this.unknown.toString('hex')+this.serial.toString('hex')+this.stamp.toString('hex')+'00000000000000000000000000000000'+this.data.toString('hex'),'hex');
                    this.checksum = _md5(zwraw);
              }
              return (Buffer(this.magic.toString('hex') + this.len.toString('hex') + this.unknown.toString('hex') + this.serial.toString('hex') + this.stamp.toString('hex') + this.checksum.toString('hex') + this.data.toString('hex'), 'hex'));
        };
    */
    this.setIosToken = function (iosToken) {
        const iostoken = iosToken.toString('hex');
        const encrypted = Buffer.from(iostoken.substr(0, 64), 'hex');

        const decipher = crypto.createDecipheriv('aes-128-ecb', this.ioskey, '');
        decipher.setAutoPadding(false);
        const decrypted = decipher.update(encrypted, 'binary', 'ascii') /*+ decipher.final('ascii')*/;

        this.adapter.log.debug('Ios Token decrypted to: ' + decrypted);
        return str2hex(decrypted);
    };


    this.getRaw_fast = function (plainData) {
        const cipher = crypto.createCipheriv('aes-128-cbc', this.key, this.iv);
        let crypted = cipher.update(plainData, 'utf8', 'binary');
        crypted += cipher.final('binary');
        crypted = Buffer.from(crypted, 'binary');
        this.data = crypted;
        this.stamp = '00000000';
        this.stamp += (parseInt((new Date().getTime()) / 1000) + this.timediff).toString(16);
        this.stamp = this.stamp.substring(this.stamp.length - 8, this.stamp.length);

        //this.adapter.log.debug('Timestamp: ' + this.stamp);

        if (this.data.length > 0) {
            this.len = Buffer.from(decimalToHex(this.data.length + 32, 4), 'hex');
            const zwraw = Buffer.from(this.magic.toString('hex') + this.len.toString('hex') + this.unknown.toString('hex') + this.serial.toString('hex') + this.stamp.toString('hex') + this.token.toString('hex') + this.data.toString('hex'), 'hex');
            //const zwraw = Buffer(this.magic.toString('hex')+this.len.toString('hex')+this.unknown.toString('hex')+this.serial.toString('hex')+this.stamp.toString('hex')+'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'+this.data.toString('hex'),'hex');
            this.checksum = _md5(zwraw);
        }
        return (Buffer.from(this.magic.toString('hex') + this.len.toString('hex') + this.unknown.toString('hex') + this.serial.toString('hex') + this.stamp.toString('hex') + this.checksum.toString('hex') + this.data.toString('hex'), 'hex'));
    };

    this.setRaw = function (raw) {
        const rawhex = raw.toString('hex');
        this.magic = Buffer.from(rawhex.substr(0, 4), 'hex');
        this.len = Buffer.from(rawhex.substr(4, 4), 'hex');
        this.unknown = Buffer.from(rawhex.substr(8, 8), 'hex');
        this.serial = Buffer.from(rawhex.substr(16, 8), 'hex');

        this.stamprec = Buffer.from(rawhex.substr(24, 8), 'hex');
        //this.stamp    = Buffer.from(rawhex.substr(24,  8), 'hex');
        this.checksum = Buffer.from(rawhex.substr(32, 32), 'hex');
        this.data = Buffer.from(rawhex.substr(64), 'hex');
    };
    /*
        this.setPlainData = function (plainData) {
            const cipher  = crypto.createCipheriv('aes-128-cbc', this.key, this.iv);
            const crypted = cipher.update(plainData, 'utf8', 'binary');
            crypted += cipher.final('binary');
            crypted = Buffer.from(crypted, 'binary');
            this.data = crypted;
            this.stamp =parseInt(new Date().getTime()/1000).toString(16);
        };
    */
    this.getPlainData = function () {
        const decipher = crypto.createDecipheriv('aes-128-cbc', this.key, this.iv);
        let dec = decipher.update(this.data, 'binary', 'utf8');
        dec += decipher.final('utf8');
        dec = dec.substring(0, dec.length - 1);
        return dec;
    };

    function _md5(data) {
        return Buffer.from(crypto.createHash('md5').update(data).digest('hex'), 'hex');
    }

    this.setToken = function (token) {
        if (token.length === 48) {
            this.token = this.setIosToken(token)
        }
        else {
            this.token = token;
        }
       

        this.key = _md5(this.token);
        this.iv = _md5(Buffer.from(this.key.toString('hex') + this.token.toString('hex'), 'hex'));
    };

    //Call Initializer
    this.setHelo();

    if (token) {
        this.setToken(token);
    }
    return this;
}

function decimalToHex(decimal, chars) {
    return (decimal + Math.pow(16, chars)).toString(16).slice(-chars).toUpperCase();
}

function str2hex(str) {
    str = str.replace(/\s/g, '');
    const buf = Buffer.alloc(str.length / 2);

    for (let i = 0; i < str.length / 2; i++) {
        buf[i] = parseInt(str[i * 2] + str[i * 2 + 1], 16);
    }
    return buf;
}

exports.Packet = Packet;
exports.decimalToHex = decimalToHex;
