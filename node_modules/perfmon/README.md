# perfmon

Streaming [Performance Monitor](http://technet.microsoft.com/en-us/library/cc749249.aspx) metrics for [Node](http://nodejs.org) on Windows.

[node-perfmon](http://markitondemand.github.com/node-perfmon) is a thin wrapper around [typeperf](http://technet.microsoft.com/en-us/library/bb490960.aspx), and provides a [ReadableStream](http://nodejs.org/docs/latest/api/streams.html#readable_Stream) interface to the typeperf output.  Metrics are streamed once per second.  `perfmon` wraps up the typeperf executable as a child_process. It ensures that no more than one process will be spawned for each host machine streaming metrics.

### Dependenices

Node, Windows, and the typeperf executable in your path.  I've never seen a Windows installation that didn't have it, but it's not out of the realm of possibility.  Windows For Workgroups 3.11 had it. _Maybe._ Definitely NT4 and up.

Only the machine running Node needs Node. Makes perfect sense.  The only requirements to stream metrics from a remote machine are Windows running on that machine, and appropriate permissions to do so.

## Install

	npm install perfmon

## Usage

The most basic usage is to stream a single metric from the local machine.  The `perfmon` function returns an instance of a ReadableStream.  You can either pass a callback as the last argument, or attach to the `data` and `error` events on the returned Stream.

The first two arguments to perfmon, `counters` and `hosts`, can be strings or arrays.  `hosts` is optional and assumed to be local machine if not specified.

```javascript
var perfmon = require('perfmon');

perfmon('\\processor(_total)\\% processor time', function(err, data) {
	console.log(data);
});
```

The `data` object logged to the console:

```javascript
{ host: 'yourcomputer',
  time: 1328067580990, // UTC timestamp in ms
  counters:
  { '\\processor(_total)\\% processor time': 17 }
}
```

### List available metric counters

Use `list` to return a, um, list of available counters.

```javascript
perfmon.list('memory', function(err, data) {
	console.log(data);
});
```

The `data` object logged to the console:

```javascript
{ counters:
  [ 'memory\\Page Faults/sec',
    'memory\\Available Bytes',
    'memory\\Committed Bytes',
    // ... omitted for brevity ...
    'memory\\Available KBytes',
    'memory\\Available MBytes',
    'memory\\Transition Pages RePurposed/sec',
    'memory\\Free & Zero Page List Bytes',
    'memory\\Modified Page List Bytes',
    'memory\\Standby Cache Reserve Bytes',
    'memory\\Standby Cache Normal Priority Bytes',
    'memory\\Standby Cache Core Bytes' ],
host: 'yourcomputer' }
```

### Stream remote host metrics

You can connect to any host on your network and stream metrics from that machine. 

```javascript
var counters = [
	'\\processor(_total)\\% processor time',
	'\\memory\\available bytes',
];

perfmon(counters, 'somecomputer.somewhere.local', function(err, data) {
	console.log(data);
});
```