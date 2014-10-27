var dgram = require('dgram');
var net = require('net');
var os = require('os');

/**
 * Generic helper because all Collectd plugins and PluginInstance
 * counters & gauges are organized as double-nested objects.
 */
function doubleHashUpdate(dh, key1, key2, cb) {
    var val1;
    if (dh.hasOwnProperty(key1)) {
	val1 = dh[key1];
    } else {
	val1 = {};
	dh[key1] = val1;
    }

    var val2 = val1[key2];
    val2 = cb(val2);
    val1[key2] = val2;
    return val2;
}

function doubleHashForEach(dh, cb) {
    for(var key1 in dh)
	if (dh.hasOwnProperty(key1)) {
	    for(var key2 in dh[key1])
		if (dh[key1].hasOwnProperty(key2)) {
		    cb(key1, key2, dh[key1][key2]);
		}
	}
}

/**
 * Your entry hook to set values
 */
function PluginInstance(plugin, instance) {
    this.plugin = plugin;
    this.instance = instance;

    /* Collectd.prototype.send() depends on these structures: */
    this.counters = {};
    this.gauges = {};
    /* TODO: derive & absolute */
};

PluginInstance.prototype = {
    addCounter: function(name, instance, increments) {
	if (increments.constructor !== Array)
	    increments = [increments];

	doubleHashUpdate(this.counters, name, instance, function(counters) {
	    return increments.map(function(increment) {
		var counter = counters && counters[0] || 0;
		return counter + increment;
	    });
	});
    },
    setCounter: function(name, instance, values) {
	if (values.constructor !== Array)
	    values = [values];

	doubleHashUpdate(this.counters, name, instance, function() {
	    return values;
	});
    },
    setGauge: function(name, instance, values) {
	if (values.constructor !== Array)
	    values = [values];

	doubleHashUpdate(this.gauges, name, instance, function(gauge) {
	    gauge = gauge || {
		samples: 0,
		values: []
	    };
	    gauge.samples++;
	    for(var i = 0; i < values.length; i++) {
		gauge.values[i] = values[i] + (gauge.values[i] || 0);
	    }
	    return gauge;
	});
    },

    /* Called by Collectd.prototype.send() */
    forgetGauges: function() {
	this.gauges = {};
    }
};

/**
 * Your context for a client periodically sending to 1 server. Use 
 * 
 * Syntax :
 *   1/ var client = Collectd();
 *   2/ var client = Collectd(int, string, int, string);
 *   3/ var client = Collectd(int, object, ignored, string);
 * 
 * All arguments are optional (like in syntax 1)
 * Syntax 1
 *   no args (they are all optional)
 * Syntax 2
 *   arg1 is the interval between 2 sending data to Collectd servers
 *   arg2 is the Collectd server name
 *   arg3 is the Collectd server port
 *   arg4 is the host name used in Collectd values
 * Syntax 3
 *   arg1 is the interval between 2 sending data to Collectd servers
 *   arg2 is an array like this : [ ['host1', port], ['host2', port], ...]
 *   arg3 is ignored.
 *   arg4 is the host name used in Collectd values
 */
function Collectd(interval, host, port, hostname) {
    this.interval = interval || 10000;
    this.serverHosts = [];

    this.plugins = {};
    this.hostname = typeof hostname !== 'undefined' ? hostname : os.hostname();

    /* Configure Collectd hosts to send metrics to */
    switch(typeof(host)) {
        case 'object':
            for (var i=0; i < host.length; i++) {
                var h = host[i];
                this.serverHosts[this.serverHosts.length] = { 'host': h[0], 'port': (h[1] || 25826) };
            }
            break;
        case 'string':
            this.serverHosts = [{ 'host': host, 'port': (port || 25826) }];
            break;
        default:
            this.serverHosts = [{ 'host': 'ff18::efc0:4a42', 'port': 25826 }];
    }
    /* Create the network sockets for each host */
    for (var i=0; i < this.serverHosts.length; i++) {
        this.serverHosts[i].sock = dgram.createSocket(net.isIPv6(this.serverHosts[i].host) ? 'udp6' : 'udp4');
        this.serverHosts[i].sock.on('error', function(e) {
                console.error(e.stack || e.message || e);
        });
    }

    setInterval(this.send.bind(this), this.interval);
};
module.exports = Collectd;

/**
 * Get or create a plugin instance
 */
Collectd.prototype.plugin = function(name, instance) {
    return doubleHashUpdate(this.plugins, name, instance, function(pluginInstance) {
	return pluginInstance || new PluginInstance(name, instance);
    });
};

/**
 * Called by interval set up by constructor
 */
Collectd.prototype.send = function() {
    var prevHostname, prevPlugin, prevInstance, prevType, prevTypeInstance, prevTime, prevInterval;

    var pkt = new Packet(this.write.bind(this));
    var hostname = this.hostname;
    var interval = this.interval;
    var time = Math.floor(new Date().getTime() / 1000);
    doubleHashForEach(this.plugins, function(plugin, instance, p) {
	function addPrelude(type, typeInstance) {
	    if (prevHostname !== hostname) {
		prevHostname = hostname;
		pkt.addStringPart(0, hostname);
	    }
	    if (prevTime !== time) {
		prevTime = time;
		pkt.addNumericPart(1, time);
	    }
	    if (prevInterval !== interval) {
		prevInterval = interval;
		pkt.addNumericPart(7, Math.ceil(interval / 1000));
	    }
	    if (prevPlugin !== plugin) {
		prevPlugin = plugin;
		pkt.addStringPart(2, plugin);
	    }
	    if (prevInstance !== instance) {
		prevInstance = instance;
		pkt.addStringPart(3, instance);
	    }
	    if (prevType !== type) {
		prevType = type;
		pkt.addStringPart(4, type);
	    }
	    if (prevTypeInstance !== typeInstance) {
		prevTypeInstance = typeInstance;
		pkt.addStringPart(5, typeInstance);
	    }
	}
	function resetState() {
	    prevHostname = undefined;
	    prevPlugin = undefined;
	    prevInstance = undefined;
	    prevType = undefined;
	    prevTypeInstance = undefined;
	    prevTime = undefined;
	    prevInterval = undefined;
	}

	doubleHashForEach(p.counters, function(type, typeInstance, values) {
	    pkt.catchOverflow(function() {
		addPrelude(type, typeInstance);
		pkt.addValuesPart('counter', values);
	    }, resetState);
	});
	doubleHashForEach(p.gauges, function(type, typeInstance, gauges) {
	    pkt.catchOverflow(function() {
		addPrelude(type, typeInstance);
		var values = gauges.values.map(function(value) {
		    return value / gauges.samples;
		});
		pkt.addValuesPart('gauge', values);
	    }, resetState);
	});
	p.forgetGauges();
    });
    /* Send last if neccessary */
    pkt.send();
};

/* Define constants */
Collectd.prototype.NOTIF_FAILURE=1;
Collectd.prototype.NOTIF_WARNING=2;
Collectd.prototype.NOTIF_OKAY=4;

/**
 * Users call sendNotif to send notifications
 * notif is an object :
 {
   severity: '<failure|warning|okay>',                    <- mandatory
   message: 'a short string that fit the network packet', <- mandatory
   h  : <hostname>,                                       <- optional
   p  : <plugin>,                                         <- optional
   pi : <plugin instance>,                                <- optional
   t  : <type>,                                           <- optional
   ti : <type instance>                                   <- optional
 }
 *
 * Note : if notif.h is not defined, it will not be sent.
 * Note : if notif.h is defined and its value is false, the default hostname will be sent
 */
Collectd.prototype.sendNotif = function(notif) {

    var pkt = new Packet(this.write.bind(this));
    var hostname = this.hostname;
    var time = Math.floor(new Date().getTime() / 1000);

    try {
        pkt.addNumericPart(1, time);
        pkt.addNumericPart(0x101, notif.severity || this.NOTIF_OKAY);

        if ('h' in notif) { pkt.addStringPart(0, notif.h || hostname); }
        if (('p' in notif  ) && notif.p ) { pkt.addStringPart(2, notif.p ); }
        if (('pi' in notif ) && notif.pi) { pkt.addStringPart(3, notif.pi); }
        if (('t' in notif  ) && notif.t ) { pkt.addStringPart(4, notif.t ); }
        if (('ti' in notif ) && notif.ti) { pkt.addStringPart(5, notif.ti); }
        pkt.addStringPart(0x100, notif.message);
    } catch (e) {
        if (e.constructor === PacketOverflow) {
            // Drop the packet ; maybe we can do something else ?
            console.warn('Dropped packet (message "'+notif.message.substr(0,100)+(notif.message.length >= 100 ? '...':'')+'")');
        } else {
            // Drop the packet ; other event
            throw e;
        }
    }

    pkt.send();
};

Collectd.prototype.write = function(buf) {
    for (var i=0; i < this.serverHosts.length; i++) {
        this.serverHosts[i].sock.send(buf, 0, buf.length, this.serverHosts[i].port, this.serverHosts[i].host);
    }
};


var MAX_PACKET_SIZE = 1024;

function Packet(sendCb) {
    this.sendCb = sendCb;
    this.buf = new Buffer(MAX_PACKET_SIZE);
    this.pos = 0;
}

Packet.prototype = {
    send: function() {
	if (this.pos > 0)
	    this.sendCb(this.buf.slice(0, this.pos));
	this.pos = 0;
    },

    addStringPart: function(id, str) {
	if (!Buffer.isBuffer(str))
	    str = new Buffer(str);
	var len = 5 + str.length;
	if (this.pos + len > this.buf.length)
	    throw new PacketOverflow();

	this.buf.writeUInt16BE(id, this.pos);
	this.pos += 2;
	this.buf.writeUInt16BE(len, this.pos);
	this.pos += 2;
	str.copy(this.buf, this.pos);
	this.pos += str.length;
	this.buf[this.pos++] = 0;
    },

    addNumericPart: function(id, num) {
	var len = 12;
	if (this.pos + len > this.buf.length)
	    throw new PacketOverflow();
	this.buf.writeUInt16BE(id, this.pos);
	this.pos += 2;
	this.buf.writeUInt16BE(len, this.pos);
	this.pos += 2;
	this.writeUInt64BE(num);
    },

    addValuesPart: function(dataType, values) {
	var id = 6;
	var len = 6 + 9 * values.length;
	if (this.pos + len > this.buf.length)
	    throw new PacketOverflow();
	this.buf.writeUInt16BE(id, this.pos);
	this.pos += 2;
	this.buf.writeUInt16BE(len, this.pos);
	this.pos += 2;
	this.buf.writeUInt16BE(values.length, this.pos);
	this.pos += 2;
	for(var i = 0; i < values.length; i++) {
	    switch(dataType) {
		case 'counter':
			this.buf[this.pos++] = 0;
			break;
		case 'gauge':
			this.buf[this.pos++] = 1;
			break;
		default:
			throw "Invalid data type";
	    }
	}
	for(var i = 0; i < values.length; i++) {
	    switch(dataType) {
		case 'counter':
			this.writeUInt64BE(values[i]);
			break;
		case 'gauge':
			this.buf.writeDoubleLE(values[i], this.pos);
			this.pos += 8;
			break;
		default:
			throw "Invalid data type";
	    }
	}
    },

    writeUInt64BE: function(num) {
	num = Math.min(Math.pow(2, 64), Math.max(0, num));
	this.buf.writeUInt32BE(Math.floor(num / Math.pow(2, 32)), this.pos);
	this.pos += 4;
	this.buf.writeUInt32BE(Math.floor(num % Math.pow(2, 32)), this.pos);
	this.pos += 4;
    },

    /* Tries to make it fit in 1024 bytes or starts a new packet */
    catchOverflow: function(cb, resetCb) {
	var tries = 2;
	while(tries > 0) {
	    tries--;

	    var oldPos = this.pos;
	    try {
		/* On success return */
		return cb();
	    } catch (e) {
		if (e.constructor === PacketOverflow) {
		    /* Flush packet so far */
		    this.pos = oldPos;
		    this.send();
		    this.buf = new Buffer(MAX_PACKET_SIZE);
		    /* Clear state */
		    resetCb();
		    /* And retry... */
		} else
		    throw e;
	    }
	}
    }
};

function PacketOverflow() {
    this.message = "Packet size overflow";
}
