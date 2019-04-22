'use strict';

const Stream = require('stream');

const Boom = require('@hapi/boom');
const Code = require('@hapi/code');
const GoodSqueeze = require('..');
const Hoek = require('@hapi/hoek');
const Lab = require('@hapi/lab');
const Teamwork = require('teamwork');


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


const internals = {};


describe('Squeeze', () => {

    it('does not forward events if "filter()" is false', { plan: 1 }, async () => {

        const stream = new GoodSqueeze.Squeeze({ request: '*' });
        const result = [];

        stream.on('data', (data) => {

            result.push(data);
        });

        const team = new Teamwork();
        stream.on('end', () => {

            expect(result).to.equal([{
                event: 'request',
                id: 1
            }]);

            team.attend();
        });

        const read = internals.readStream();

        read.pipe(stream);

        read.push({ event: 'request', id: 1 });
        read.push({ event: 'ops', id: 2 });
        read.push(null);

        await team.work;
    });

    it('remains open as long as the read stream does not end it', { plan: 1 }, async () => {

        const stream = new GoodSqueeze.Squeeze({ request: '*' });
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

        await Hoek.wait(500);

        read.push({ event: 'request', id: 3 });
        read.push({ event: 'request', id: 4 });

        expect(result).to.equal([
            { event: 'request', id: 1 },
            { event: 'request', id: 2 },
            { event: 'request', id: 3 },
            { event: 'request', id: 4 }
        ]);
    });

    it('throws an error if "events" not a truthy object', { plan: 2 }, () => {

        expect(() => {

            new GoodSqueeze.Squeeze('request');
        }).to.throw('events must be an object');
        expect(() => {

            new GoodSqueeze.Squeeze(1);
        }).to.throw('events must be an object');
    });

    it('allows empty event arguments', { plan: 1 }, () => {

        const stream = new GoodSqueeze.Squeeze(null);
        expect(stream._subscription).to.equal(Object.create(null));
    });

    describe('subscription()', () => {

        it('converts *, null, undefined, 0, and false to an empty include/exclude object, indicating all tags are acceptable', { plan: 5 }, () => {

            const tags = ['*', null, undefined, false, 0];
            for (let i = 0; i < tags.length; ++i) {

                const result = GoodSqueeze.Squeeze.subscription({ error: tags[i] });

                expect(result.error).to.equal({
                    include: [],
                    exclude: []
                });
            }
        });

        it('converts a single tag to an include/exclude object', { plan: 1 }, () => {

            const result = GoodSqueeze.Squeeze.subscription({ error: 'hapi' });
            expect(result.error).to.equal({
                include: ['hapi'],
                exclude: []
            });
        });

        it('converts an array to an include/exclude object', { plan: 1 }, () => {

            const result = GoodSqueeze.Squeeze.subscription({ error: ['hapi', 'error'] });
            expect(result.error).to.equal({
                include: ['hapi', 'error'],
                exclude: []
            });
        });

        it('adds excluded tags to exclude array in map', () => {

            const result = GoodSqueeze.Squeeze.subscription({ error: { exclude: ['sensitive'] } });
            expect(result.error).to.equal({
                include: [],
                exclude: ['sensitive']
            });
        });
    });

    describe('filter()', () => {

        it('returns true if this reporter should report this event type', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ log: '*' });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'error', 'hapi'] })).to.be.true();
        });

        it('returns false if this report should not report this event type', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ log: '*' });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'ops', tags: ['*'] })).to.be.false();
        });

        it('returns true if the event is matched, but there are not any tags with the data', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ log: '*' });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'log' })).to.be.true();
        });

        it('returns false if the subscriber has tags, but the matched event does not have any', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ error: 'db' });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'error', tags: [] })).to.be.false();
        });

        it('returns true if the event and tag match', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ error: ['high', 'medium', 'log'] });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'error', tags: ['hapi', 'high', 'db', 'severe'] })).to.be.true();
        });

        it('returns false by default', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ request: 'hapi' });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'request' })).to.be.false();
        });

        it('returns false if "tags" is not an array', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ request: 'hapi' });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'request', tags: 'hapi' })).to.be.false();
        });

        it('returns true if this reporter should report this event type (advanced)', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ log: { include: '*' } });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'hapi', 'debug'] })).to.be.true();
        });

        it('returns false if this reporter should not report this event with both include and exclude tags defined', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ log: { include: 'request', exclude: 'debug' } });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'hapi', 'debug'] })).to.be.false();
        });

        it('returns false if this reporter should not report this event with exclude tags defined', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ log: { exclude: 'debug' } });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'hapi', 'debug'] })).to.be.false();
        });

        it('returns true if this reporter should report this event with only exclude tags defined', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ log: { exclude: 'debug' } });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'log', tags: ['request', 'server', 'hapi'] })).to.be.true();
        });

        it('returns true if this reporter should report this event with only exclude tags defined in case no tags are present', { plan: 1 }, () => {

            const subscription = GoodSqueeze.Squeeze.subscription({ log: { exclude: 'debug' } });
            expect(GoodSqueeze.Squeeze.filter(subscription, { event: 'log' })).to.be.true();
        });
    });
});

describe('SafeJson', () => {

    it('safely handles circular references in incoming data', { plan: 1 }, async () => {

        let result = '';
        const stream = new GoodSqueeze.SafeJson();
        const read = internals.readStream();

        const message = {
            x: 1
        };
        message.y = message;

        stream.on('data', (data) => {

            result += data;
        });

        const team = new Teamwork();
        stream.on('end', () => {

            expect(result).to.equal('{"x":1,"y":"[Circular]"}\n{"foo":"bar"}\n');
            team.attend();
        });

        read.pipe(stream);

        read.push(message);
        read.push({ foo: 'bar' });
        read.push(null);

        await team.work;
    });

    it('pretty print JSON with space when specified', { plan: 1 }, async () => {

        let result = '';
        const stream = new GoodSqueeze.SafeJson({}, { space: 2 });
        const read = internals.readStream();

        stream.on('data', (data) => {

            result += data;
        });

        const team = new Teamwork();
        stream.on('end', () => {

            expect(result).to.equal('{\n  "foo": "bar"\n}\n');
            team.attend();
        });

        read.pipe(stream);

        read.push({ foo: 'bar' });
        read.push(null);
        await team.work;
    });

    it('adds a separator value when specified', { plan: 1 }, async () => {

        let result = '';
        const stream = new GoodSqueeze.SafeJson({}, { separator: '#' });
        const read = internals.readStream();

        stream.on('data', (data) => {

            result += data;
        });

        const team = new Teamwork();
        stream.on('end', () => {

            expect(result).to.equal('{"foo":"bar"}#{"bar":"baz"}#');
            team.attend();
        });

        read.pipe(stream);

        read.push({ foo: 'bar' });
        read.push({ bar: 'baz' });
        read.push(null);
        await team.work;
    });

    it('serializes incoming buffer data', { plan: 1 }, async () => {

        let result = '';
        const stream = new GoodSqueeze.SafeJson({}, { separator: '#' });
        const read = internals.readStream();

        stream.on('data', (data) => {

            result += data;
        });

        const team = new Teamwork();
        stream.on('end', () => {

            expect(result).to.equal('{\"type\":\"Buffer\",\"data\":[116,101,115,116,45,48]}#{\"type\":\"Buffer\",\"data\":[116,101,115,116,45,49]}#');
            team.attend();
        });

        read.pipe(stream);

        read.push(Buffer.from('test-0'));
        read.push(Buffer.from('test-1'));
        read.push(null);
        await team.work;
    });

    it('serializes incoming string data', { plan: 1 }, async () => {

        let result = '';
        const stream = new GoodSqueeze.SafeJson({}, { separator: '#' });
        const read = internals.readStream();

        stream.on('data', (data) => {

            result += data;
        });

        const team = new Teamwork();
        stream.on('end', () => {

            expect(result).to.equal('"test-0"#"test-1"#');
            team.attend();
        });

        read.pipe(stream);

        read.push('test-0');
        read.push('test-1');
        read.push(null);
        await team.work;
    });

    it('serializes incoming boom objects', { plan: 1 }, async () => {

        let result = '';
        const stream = new GoodSqueeze.SafeJson({}, { separator: '#' });
        const read = internals.readStream();

        stream.on('data', (data) => {

            result += data;
        });

        const team = new Teamwork();
        stream.on('end', () => {

            expect(result).to.equal('{"data":null,"isBoom":true,"isServer":true,"output":{"statusCode":500,"payload":{"statusCode":500,"error":"Internal Server Error","message":"An internal server error occurred"},"headers":{}},"isDeveloperError":true}#');
            team.attend();
        });

        read.pipe(stream);

        read.push(Boom.badImplementation('test-message'));
        read.push(null);
        await team.work;
    });
});


internals.readStream = function () {

    const stream = new Stream.Readable({ objectMode: true });
    stream._read = () => { };
    return stream;
};
