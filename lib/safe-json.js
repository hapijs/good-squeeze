var Stream = require('stream');
var Hoek = require('hoek');
var Stringify = require('json-stringify-safe');

var internals = {};

internals.SafeJson = module.exports = function (options) {

    options = options || {};
    options.objectMode = true;

    if (!(this instanceof internals.SafeJson)) {
        return new internals.SafeJson(options);
    }

    Stream.Transform.call(this, options);
};


Hoek.inherits(internals.SafeJson, Stream.Transform);


internals.SafeJson.prototype._transform = function (data, enc, next) {

    this.push(Stringify(data));
    next(null);
};
