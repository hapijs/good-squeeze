'use strict';

const Stream = require('stream');
const Stringify = require('fast-safe-stringify');

class SafeJson extends Stream.Transform {
    constructor(options, stringify) {

        options = Object.assign({}, options, {
            objectMode: true
        });
        super(options);
        this._stringify = Object.assign({}, {
            separator: '\n',
            space: 0
        }, stringify);
    }
    _transform(data, enc, next) {

        next(null, `${Stringify(data, null, this._stringify.space)}${this._stringify.separator}`);
    }
}

module.exports = SafeJson;
