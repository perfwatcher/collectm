var os = require('os');
var TypePerf = require('./lib/TypePerf');
var PerfmonStream = require('./lib/PerfmonStream');

var hosts = {};
var hostname = os.hostname();

function subset(a, b) {
	// is b a subset of a?
	return b.every(function(value) {
		return (a.indexOf(value) != -1);
	});
}

function stringOrArrayToArray(value) {
 	if (Array.isArray(value)) {
 		return value;
 	}

 	if (typeof(value) == 'string') {
 		return [value];
 	}

 	return false;
}

function init(host, options, pstream) {
	var typePerf;

	if (!hosts[host]) {
		hosts[host] = new TypePerf(host);
	}

	typePerf = hosts[host];
	pstream.attach(typePerf);

	// this is wrong. if the current typeperf ALREADY contains the new
	// counters, you should not do anything!
	if (!subset(typePerf.counters(), options.counters)) {
		typePerf.counters(typePerf.counters().concat(options.counters));
		typePerf.spawn();
	}
	else if (!typePerf.cp) {
		typePerf.spawn();
	}
}

function each(host, cb) {
	if (!host) {
		// do em all
		for (var h in hosts) {
			cb(hosts[h]);
		}
	}
	else {
		if (!Array.isArray(host)) {
			host = [host];
		}

		host.forEach(function(h) {
			if (hosts[h]) {
				cb(hosts[h]);
			}
		});
	}	
}

function parseInputs(args) {
	// counters can be array or string
	// options is object
	// cb must be func
	// host can be array or string

	// if 0 is object, options == 0
		// cb is last arg fn or nothing
	// if 0 is string or array, counters = [0]
		// if 1 is string or array, hosts = [1]
		// cb is last arg fn or nothing

	var counters = stringOrArrayToArray(args[0]);
	var hosts = stringOrArrayToArray(args[1]);
	var cb = args[args.length - 1];
	var options = {};

	if (counters) {
		options = {
			counters: counters
		}

		if (hosts) {
			options.hosts = hosts;
		}

	}
	else if (typeof(args[0]) == 'object') {
		options = args[0];

		options.counters = stringOrArrayToArray(options.counters || options.counter);
		options.hosts = stringOrArrayToArray(options.hosts || options.host);
	}

	if (!options.counters) {
		options.error = 'perfmon invalid inputs';
	}

	if (!options.hosts) {
		options.hosts = [hostname];
	}

	return {
		options: options,
		cb: cb
	}
}

/*
public interface
acceptable inputs

perfmon(counters)
perfmon(counters, cb)
perfmon(counters, host, cb)
perfmon(options)
perfmon(options, cb)
*/

function perfmon() {
	var inputs = parseInputs(arguments);
	var pstream = new PerfmonStream(inputs.options.counters);

	if (typeof(inputs.cb) == 'function') {
		pstream.on('data', function(data) {
			inputs.cb(null, data);
		});

		pstream.on('error', inputs.cb);
	}

	if (inputs.options.error) {
		process.nextTick(function() {
			pstream.emit('error', inputs.options.error);
		});
	}
	else {
		inputs.options.hosts.forEach(function(h) {
			init(h, inputs.options, pstream);
		});	
	}

	return pstream;
}

/*
acceptable inputs
perfmon.list(counterFamily, cb)
perfmon.list(counterFamily, hosts, cb)
*/

perfmon.list = function() {
	var inputs = parseInputs(arguments);
	// dont pass counters for list, no need to filter anything
	var pstream = new PerfmonStream();

	inputs.options.hosts.forEach(function(host) {
		TypePerf.listCounters(inputs.options.counters, host, function(err, data) {
			if (err) {
				pstream.emit('error', err);
			}
			else {
				pstream.write(data);
			}
		});
	});

	if (typeof(inputs.cb) == 'function') {
		pstream.on('data', function(data) {
			inputs.cb(null, data);
		});
		pstream.on('error', inputs.cb);
	}

	if (inputs.options.error) {
		process.nextTick(function() {
			pstream.emit('error', inputs.options.error);
		});
	}

	return pstream;
};

perfmon.stop = function(host) {
	each(host, function(typePerf) {
		typePerf.kill();
	});
};

perfmon.start = function(host) {
	each(host, function(typePerf) {
		typePerf.spawn();
	});
};

module.exports = perfmon;