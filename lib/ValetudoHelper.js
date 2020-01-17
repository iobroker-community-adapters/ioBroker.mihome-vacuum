const request = require('request');
const zlib = require('zlib');
const RRMapParser = require('./RRMapParser');
const mapCreator = require('./mapCreator');

const ValetudoHelper = function () {};

ValetudoHelper.getRawMapData = function (robotIp) {

    let that = this;
    let options = {
        url: 'http://' + robotIp + '/api/map/latest'
    };

    var requestWithEncoding = function (options, callback) {
        var req = request.get(options);

        req.on('response', function (res) {
            var chunks = [];
            res.on('data', function (chunk) {
                chunks.push(chunk);
            });

            res.on('end', function () {
                var buffer = Buffer.concat(chunks);

                try {
                    if (buffer[0x00] === 0x1f && buffer[0x01] === 0x8b) { // gzipped data
                        zlib.gunzip(buffer, function (err, decoded) {
                            callback(err, RRMapParser.PARSE(decoded));
                        });
                    } else {
                        callback(null, JSON.parse(buffer));
                    }
                } catch (e) {
                    callback(e, null);
                }
            });
        });

        req.on('error', function (err) {
            callback(err);
        });
    };

    // Return new promise 
    return new Promise(function (resolve, reject) {

        requestWithEncoding(options, function (err, data) {
            if (err) {
                reject(err);
            } else {
                //console.log(JSON.stringify(data));
                //let map = mapCreator.CanvasMap(data);
                resolve(data);
            }
        });
    });
};

ValetudoHelper.getMapBase64 = function (ip, options) {
    let that = this;
    //let options = options
    return new Promise(function (resolve, reject) {

        that.getRawMapData(ip).then(function (data) {
            let map = mapCreator.CanvasMap(data, options);
            resolve(map);
        })
            .catch(error => reject(error));

    });
};

module.exports = ValetudoHelper;