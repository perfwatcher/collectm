var Stream = require('stream').Stream;
var spawn = require('child_process').spawn;
var util = require('util');
var os = require('os');

function TypePerf(host, counters) {
	Stream.call(this);

	this.host = host;
	this.cp = [];
	this.spawning = [];

	this._counters = [];
	this.readable = true;

	this.counters(counters);
}

util.inherits(TypePerf, Stream);

TypePerf.listCounters = function(name, host, callback) {
	var stdoutBuffer = '';
	var err;
	var data = {
		counters: []
	};

	name = name || '';
	data.host = host;

	var cp = spawn('TypePerf', ['-qx', name, '-s', host]);
	var parseLine = function(line) {
		if (line.indexOf('Error:') == 0) {
			// typeperf emits this regardless of whether or not the object wasn't found
			// or the remote machine doesn't exist.
			err = { 
				host: host, 
				message: 'The specified object was not found on the computer.'
			};
		}
		else if (line.indexOf('\\\\') != 0) {
			return;	
		}

		line = line.substr(host.length+3);
		data.counters.push(line);
	}

	cp.stdout.on('data', function(data) {
		var lines;

		data = stdoutBuffer + data.toString('utf8');
		lines = data.split('\r\n');
		stdoutBuffer = lines.pop();

		lines.forEach(parseLine);
	});

	cp.stderr.on('data', function(data) {
		err = data.toString('utf8');
	});

	cp.on('exit', function() {
		callback(err, data);
	});
};

TypePerf.prototype.counters = function(counters) {
	var self = this;

	if (!counters) {
		return self._counters;
	}

	self._counters = [];
	if (!Array.isArray(counters)) {
		counters = [counters];
	}

	// make it unique
	counters.forEach(function(counter) {
		if (self._counters.indexOf(counter) == -1) {
			self._counters.push(counter);
		}
	});

	return self._counters;
};

TypePerf.prototype.spawn = function() {
	var cp;
	var self = this;
	var stdoutBuffer = '';
	var counters = this._counters;

	// no need to spawn multiple, counters always append,
	// so last spawner is most accurate
	if (self.spawning.length) {
		self.spawning.forEach(function(process) {
			self.kill(process);
		});
		self.spawning = [];
	}

	cp = spawn('TypePerf', this._counters.concat([
		'-s',
		this.host
	]));

	self.spawning.push(cp);
	self.cp.push(cp);

	function checkCounters(line) {
		var testCounters;
		var available;
		var splice = [];
		var missing = {};

		if (counters.length == line.length-1) {
			return;
		}
		
		function clean(list) {
			var cleanList = [];
			list.forEach(function(item, idx) {
				cleanList[idx] = item.replace(self.host, '').replace(/\\/g, '');
			});

			return cleanList;
		}

		testCounters = clean(counters);
		available = clean(line);

		// shift off some garbahj
		available.shift();

		testCounters.forEach(function(item, idx) {
			if (available.indexOf(item) == -1) {
				missing[counters[idx]] = true;
				splice.push(idx);
			}
		});

		if (splice.length) {
			// remove missing from our counters.
			// man this seems lame
			splice.forEach(function(position) {
				counters.splice(position, 1);
			});

			self.emit('error', {
				host: self.host,
				message: 'Counter(s) unavaialable',
				counters: missing
			});
		}
	}

	function update(line) {
		var errCounters = {};
		if (!line.length || !line[0] || line[0].indexOf('Exiting') == 0) {
			return;
		}

		if (line[0].indexOf('(PDH-CSV') == 0) {
			// first line, split to see what counters are valid
			checkCounters(line);
			return;
		}

		if (line[0].indexOf('Error: ') == 0) {

			counters.forEach(function(c) {
				errCounters[c] = true;
			});

			self.emit('error', {
				host: self.host,
				message: line[0].replace(/^Error\:\s/, ''),
				counters: errCounters
			});

			// on error kill myself
			self.kill(cp);

			// stop iterating over lines
			return true;
		}

		// successful, kill any competitor processes.
		self._killOthers(cp);

		var update = {
			host: self.host,
			time: new Date(line.shift()).getTime(),
			counters: {}
		}

		self._counters.forEach(function(counter, idx) {
			// do we care about decimals?
			update.counters[counter] = (line[idx] !== undefined) ? Math.floor(line[idx]*1) : null;

			// interesting idea my son
			// self.emit(counter.toLowerCase(), update.counters[counter]);
		});

		self.emit('data', update);
	}

	cp.stdout.on('data', function(data) {
		data = stdoutBuffer + data.toString('utf8');

		var lines = data.split('\r\n');
		stdoutBuffer = lines.pop();

		lines.some(function(line) {
			line = line.replace(/"/g, '').split(',');
			return update(line);
		});
	});

	// never seen anything sent to stderr, unless you try and run this on non windows
	cp.stderr.on('data', function(data) {
		self.emit('error', {
			host: self.host,
			message: data.toString('utf8')
		});
	});

	cp.on('exit', function(code) {
		cp.removeAllListeners();
	});
};

TypePerf.prototype._killOthers = function(cp) {
	// pass in cp to keep it alive while 
	// killing any other processes,
	// otherwise, kill all
	var i, process;

	// console.warn('killing', self.cp.length)

	for (i=0; i<this.cp.length; i++) {
		process = this.cp[i];

		if (process == cp) {
			continue;
		}

		this.kill(process);
		i--;
	}
}

TypePerf.prototype.kill = function(process) {
	if (!process) {
		// kill everybody if nothing is passed
		return this._killOthers();
	}

	var idx = this.cp.indexOf(process);
	
	if (idx != -1) {
		this.cp.splice(idx, 1);
	}

	process.removeAllListeners();
	process.kill();
};

module.exports = TypePerf;