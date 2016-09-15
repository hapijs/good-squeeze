'use strict';

// Load modules

const Stream = require('stream');

const Code = require('code');
const Lab = require('lab');

const Squeeze = require('..').Squeeze;
const SafeJson = require('..').SafeJson;

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;

const internals = {
    readStream() {

        const stream = new Stream.Readable({ objectMode: true });
        stream._read = () => {};
        return stream;
    }
};

describe('Squeeze', () => {

    describe('subscription()', () => {

        it('converts *, null, undefined, 0, and false to an empty include/exclude object, indicating all tags are acceptable', { plan: 5 }, (done) => {

            const tags = ['*', null, undefined, false, 0];
            for (let i = 0; i < tags.length; ++i) {

                const result = Squeeze.subscription({ error: tags[i] });

                expect(result.error).to.equal({
                    include: [],
                    exclude: []
                });
            }
            done();
        });

        it('converts a single tag to an include/exclude object', { plan: 1 }, (done) => {

            const result = Squeeze.subscription({ error: 'hapi' });
            expect(result.error).to.equal({
                include: ['hapi'],
                exclude: []
            });
            done();
        });

        it('converts an array to an include/exclude object', { plan: 1 }, (done) => {

            const result = Squeeze.subscription({ error: ['hapi', 'error'] });
            expect(result.error).to.equal({
                include: ['hapi', 'error'],
                exclude: []
            });
            done();
        });

        it('adds excluded tags to exclude array in map', (done) => {

            const result = Squeeze.subscription({ error: { exclude: ['sensitive'] } });
            expect(result.error).to.equal({
                include: [],
                exclude: ['sensitive']
            });
            done();
        });
    });

    describe('filter()', () => {

        it('returns true if this reporter should report this event type', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ log: '*' });
            expect(Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'error', 'hapi'] })).to.be.true();
            done();
        });

        it('returns false if this report should not report this event type', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ log: '*' });
            expect(Squeeze.filter(subscription, { event: 'ops', tags: ['*'] })).to.be.false();
            done();
        });

        it('returns true if the event is matched, but there are not any tags with the data', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ log: '*' });
            expect(Squeeze.filter(subscription, { event: 'log' })).to.be.true();
            done();
        });

        it('returns false if the subscriber has tags, but the matched event does not have any', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ error: 'db' });
            expect(Squeeze.filter(subscription, { event: 'error', tags: [] })).to.be.false();
            done();
        });

        it('returns true if the event and tag match', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ error: ['high', 'medium', 'log'] });
            expect(Squeeze.filter(subscription, { event: 'error', tags: ['hapi', 'high', 'db', 'severe'] })).to.be.true();
            done();
        });

        it('returns false by default', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ request: 'hapi' });
            expect(Squeeze.filter(subscription, { event: 'request' })).to.be.false();
            done();
        });

        it('returns false if "tags" is not an array', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ request: 'hapi' });
            expect(Squeeze.filter(subscription, { event: 'request', tags: 'hapi' })).to.be.false();
            done();
        });

        it('returns true if this reporter should report this event type (advanced)', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ log: { include: '*' } });
            expect(Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'hapi', 'debug'] })).to.be.true();
            done();
        });

        it('returns false if this reporter should not report this event with both include and exclude tags defined', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ log: { include: 'request', exclude: 'debug' } });
            expect(Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'hapi', 'debug'] })).to.be.false();

            done();
        });

        it('returns false if this reporter should not report this event with exclude tags defined', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ log: { exclude: 'debug' } });
            expect(Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'hapi', 'debug'] })).to.be.false();

            done();
        });

        it('returns true if this reporter should report this event with only exclude tags defined', { plan: 1 }, (done) => {

            const subscription = Squeeze.subscription({ log: { exclude: 'debug' } });
            expect(Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'hapi'] })).to.be.true();

            done();
        });
    });

    it('does not forward events if "filter()" is false', { plan: 1 }, (done) => {

        const stream = new Squeeze({ request: '*' });
        const result = [];

        stream.on('data', (data) => {

            result.push(data);
        });

        stream.on('end', () => {

            expect(result).to.equal([{
                event: 'request',
                id: 1
            }]);
            done();
        });

        const read = internals.readStream();

        read.pipe(stream);

        read.push({ event: 'request', id: 1 });
        read.push({ event: 'ops', id: 2 });
        read.push(null);
    });

    it('remains open as long as the read stream does not end it', { plan: 1 }, (done) => {

        const stream = new Squeeze({ request: '*' });
        const result = [];

        stream.on('data', (data) => {

            result.push(data);
        });

        stream.on('end', () => {

            expect.fail('End should never be called');
        });

        const read = internals.readStream();

        read.pipe(stream);

        read.push({ event: 'request', id: 1 });
        read.push({ event: 'request', id: 2 });

        setTimeout(() => {

            read.push({ event: 'request', id: 3 });
            read.push({ event: 'request', id: 4 });

            expect(result).to.equal([
                { event: 'request', id: 1 },
                { event: 'request', id: 2 },
                { event: 'request', id: 3 },
                { event: 'request', id: 4 }
            ]);
            done();
        }, 500);
    });

    it('throws an error if "events" not a truthy object', { plan: 2 }, (done) => {

        expect(() => {

            new Squeeze('request');
        }).to.throw('events must be an object');
        expect(() => {

            new Squeeze(1);
        }).to.throw('events must be an object');

        done();
    });

    it('allows empty event arguments', { plan: 1 }, (done) => {

        const stream = new Squeeze(null);

        expect(stream._subscription).to.equal(Object.create(null));
        done();
    });
});

describe('SafeJson', () => {

    it('safely handles circular references in incoming data', { plan: 1 }, (done) => {

        let result = '';
        const stream = new SafeJson();
        const read = internals.readStream();

        const message = {
            x: 1
        };
        message.y = message;

        stream.on('data', (data) => {

            result += data;
        });

        stream.on('end', () => {

            expect(result).to.shallow.equal('{"x":1,"y":"[Circular]"}\n{"foo":"bar"}\n');
            done();
        });

        read.pipe(stream);

        read.push(message);
        read.push({ foo: 'bar' });
        read.push(null);
    });

    it('adds a seperator value when specified', { plan: 1 }, (done) => {

        let result = '';
        const stream = new SafeJson({}, { separator: '#' });
        const read = internals.readStream();

        stream.on('data', (data) => {

            result += data;
        });

        stream.on('end', () => {

            expect(result).to.shallow.equal('{"foo":"bar"}#{"bar":"baz"}#');
            done();
        });

        read.pipe(stream);

        read.push({ foo: 'bar' });
        read.push({ bar: 'baz' });
        read.push(null);
    });
});
