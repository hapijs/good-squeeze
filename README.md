# good-squeeze

A simple transform stream for filtering events from [good](https://github.com/hapijs/good).

[![Build Status](https://travis-ci.org/hapijs/good-squeeze.svg?branch=master&style=flat)](https://travis-ci.org/hapijs/good-squeeze)
![Current Version](https://img.shields.io/npm/v/good-squeeze.svg?style=flat)

Lead Maintainer: [Adam Bretz](https://github.com/arb)

## Usage

good-squeeze is a transform stream useful in custom good reporter clients. It should generally be used as the first step in a custom pipeline to filter out events that the current reporter isn't subscribed to.

## Methods

### `GoodSqueeze(events, [options])`

Creates a new GoodSqueeze object where:

- `events` an object where each key is a valid good event, and the value is a string or array of strings representing event tags. "\*" indicates no filtering. `null` and `undefined` are assumed to be "\*".
- `options` an optional configuration object that gets passed to the Node [`Stream.Transform`](http://nodejs.org/api/stream.html#stream_class_stream_transform) constructor. **Note** `objectMode` is always `true` for all `GoodSqueeze` objects.

### `GoodSqueeze.subscription(events)`

A static method on `GoodSqueeze` that creates a new event subscription map where:

- `events` an object where each key is a valid good event, and the value is a string or array of strings representing event tags. "*" indicates no filtering. `null` and `undefined` are assumed to be "*".

```js
var GoodSqueeze = require('good-squeeze');

GoodSqueeze.subscription({ log: 'user', ops: '*', request: ['hapi', 'foo'] });

// Results in
// {
//     log: [ 'user' ],
//     ops: [],
//     request: [ 'hapi', 'foo', 'hapi', 'foo' ]
// }
```

Useful for creating an event subscription to be used with `GoodSqueeze.filter` if you do not plan on creating a pipeline coming from good and instead want to manage event filtering manually.


### `GoodSqueeze.filter(subscription, data)`

Returns `true` if the supplied `data.event` + `data.tags` should be reported based on `subscription` where:

- `subscription` - a subscription map created by `GoodSqueeze.subscription()`.
- `data` - event object emitted from good/hapi which should contain the following keys:
    - `event` - a string representing the event name of `data`
    - `tags` - an array of strings representing tags associated with this event.
