var Stream = require('stream').Stream;
var util = require('util');

function PerfmonStream(counters) {
	Stream.call(this);

	this.counters = counters;
	this.writable = true;
	this.readable = true;
	this._queue = [];
	this._paused = false;
}

util.inherits(PerfmonStream, Stream);

PerfmonStream.prototype.attach = function(typePerf) {
	var self = this;

	typePerf.on('data', function(data) {
		self.write(data);
	});

	typePerf.on('error', function(err) {
		self.writeError(err);
	});
};

PerfmonStream.prototype._filter = function(data, isError) {
	var out = {};

	// if generic error applies to all PerfmonStream listeners
	if (!this.counters || (isError && !data.counters)) {
		return data;
	}

	for (var i in data) {
		out[i] = data[i];
	}

	out.counters = {};

	this.counters.forEach(function(c) {
		if (null === data.counters[c] || undefined === data.counters[c]) return;

		out.counters[c] = data.counters[c];
	});

	if (!Object.keys(out.counters).length) {
		return;
	}

	return out;
}

PerfmonStream.prototype.write = function(data) {
	var out = this._filter(data);

	if (!out) {
		return;
	}

	if (this._paused) {
		this._queue.push(out);
	}
	else {
		this.emit('data', out);
	}
};

PerfmonStream.prototype.writeError = function(data) {
	var out = this._filter(data, true);

	if (!out) {
		return;
	}

	this.emit('error', out);
};


PerfmonStream.prototype.pause = function() {
	this._paused = true;
};

PerfmonStream.prototype.resume = function() {
	this._paused = false;

	while (this._queue.length) {
		this.write(this._queue.shift());
	}
};

module.exports = PerfmonStream;