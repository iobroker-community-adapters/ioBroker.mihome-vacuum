var crypto = require('crypto');

function Packet() {
  //Properties
  this.magic =     Buffer( 2);
  this.len =       Buffer( 2);
  this.unknown =   Buffer( 4);
  this.serial =    Buffer( 4);
  this.stamp =     Buffer( 4);
  this.checksum =  Buffer(16);
  this.data =      Buffer( 0);
  this.token =     Buffer(16);
  this.key =       Buffer(16);
  this.iv =        Buffer(16);
  this.host =      "";
  this.port =      54321;
  this.plainMessageOut = "";

  //Methods
  this.getRaw = getRaw;
  this.setRaw = setRaw;
  this.setHelo = setHelo;
  this.msgCounter = 1;
  this.setPlainData = setPlainData;
  this.getPlainData = getPlainData;
  this.setToken = setToken;

  //Call Initializer
  this.setHelo();

  //Functions and internal functions
  function setHelo() {
    this.magic =     Buffer("2131",'hex');
    this.len =       Buffer("0020",'hex');
    this.unknown =   Buffer("FFFFFFFF",'hex');
    this.serial =    Buffer("FFFFFFFF",'hex');
    this.stamp =     Buffer("FFFFFFFF",'hex');
    this.checksum =  Buffer("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",'hex');
    this.data =      Buffer(0);
  }
  
  function getRaw() {
      if (this.data.length>0) {
        this.len=Buffer(decimalToHex(this.data.length+32,4),'hex');
        var zwraw=Buffer(this.magic.toString('hex')+this.len.toString('hex')+this.unknown.toString('hex')+this.serial.toString('hex')+this.stamp.toString('hex')+this.token.toString('hex')+this.data.toString('hex'),'hex');
        //var zwraw=Buffer(this.magic.toString('hex')+this.len.toString('hex')+this.unknown.toString('hex')+this.serial.toString('hex')+this.stamp.toString('hex')+"00000000000000000000000000000000"+this.data.toString('hex'),'hex');
        this.checksum=_md5(zwraw);
      }
      return(Buffer(this.magic.toString('hex')+this.len.toString('hex')+this.unknown.toString('hex')+this.serial.toString('hex')+this.stamp.toString('hex')+this.checksum.toString('hex')+this.data.toString('hex'),'hex'));
  }
  
  function setRaw(raw) {
        var rawhex = raw.toString('hex');
        this.magic=Buffer(rawhex.substr(   0, 4),'hex');
        this.len=Buffer(rawhex.substr(     4, 4),'hex');
        this.unknown=Buffer(rawhex.substr( 8, 8),'hex');
        this.serial=Buffer(rawhex.substr(  16, 8),'hex');
        this.stamp=Buffer(rawhex.substr(   24, 8),'hex');
        this.checksum=Buffer(rawhex.substr(32,32),'hex');
        this.data=Buffer(rawhex.substr(    64),'hex');
  }
  
  function setPlainData(plainData) {
    var cipher = crypto.createCipheriv('aes-128-cbc', this.key, this.iv);
    var crypted = cipher.update(plainData,'utf8','binary');
    crypted += cipher.final('binary');
    crypted = new Buffer(crypted, 'binary');
    this.data = crypted;
  }
  
  function getPlainData() {
    var decipher = crypto.createDecipheriv('aes-128-cbc', this.key, this.iv);
    var dec = decipher.update(this.data,'binary','utf8');
    dec += decipher.final('utf8');
    return dec;
  }
  
  function _md5(data) {
    return new Buffer(crypto.createHash('md5').update(data).digest("hex"),"hex");
  }
  
  function setToken(token) {
    this.token = token;
    this.key = _md5(this.token);
    this.iv =  _md5(new Buffer(this.key.toString('hex')+this.token.toString('hex'),'hex'));
  }
}

function decimalToHex(decimal, chars) {
    return (decimal + Math.pow(16, chars)).toString(16).slice(-chars).toUpperCase();
}

function str2hex(str) {
    str = str.replace(/\s/g, '');
    var buf = new Buffer(str.length / 2);

    for (var i = 0; i < str.length / 2; i++) {
        buf[i] = parseInt(str[i * 2] + str[i* 2 + 1], 16);
    }
    return buf;
}

exports.Packet = Packet;
exports.decimalToHex = decimalToHex;

