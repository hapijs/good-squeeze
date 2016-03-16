'use strict';

const Stream = require('stream');
const Hoek = require('hoek');

class Squeeze extends Stream.Transform {
    constructor(events, options) {

        events = events || {};
        Hoek.assert(typeof events === 'object', 'events must be an object');

        options = Object.assign({}, options, {
            objectMode: true
        });
        super(options);
        this._subscription = Squeeze.subscription(events);
    }
    _transform(data, enc, next) {

        if (Squeeze.filter(this._subscription, data)) {
            return next(null, data);
        }
        next(null);
    }
    static subscription(events) {

        const result = Object.create(null);
        const subs = Object.keys(events);

        for (let i = 0; i < subs.length; ++i) {
            const key = subs[i];
            const filter = events[key];
            let tags = Array.isArray(filter) ? filter : [];

            if (filter && filter !== '*') {
                tags = tags.concat(filter);
            }

            // Force everything to be a string
            for (let j = 0; j < tags.length; ++j) {
                tags[j] = '' + tags[j];
            }

            result[key.toLowerCase()] = tags;
        }
        return result;
    }
    static filter(subscription, data) {

        const tags = data.tags || [];
        const subEventTags = subscription[data.event];

        // If we aren't interested in this event, break
        if (!subEventTags) {
            return false;
        }

        // If it's an empty array, we do not want to do any filtering
        if (subEventTags.length === 0) {
            return true;
        }

        // Check event tags to see if one of them is in this reports list
        if (Array.isArray(tags)) {
            let result = false;
            for (let i = 0; i < tags.length; ++i) {
                const eventTag = tags[i];
                result = result || subEventTags.indexOf(eventTag) > -1;
            }

            return result;
        }

        return false;
    }
}

module.exports = Squeeze;
