var md5 = require('MD5');
var os = require('os');
var Collectd = require('collectdout');
var diskspace = require('diskspace');
var perfmon = require('perfmon');
var cpu = require('windows-cpu');
var Winreg = require('winreg');
var express = require('express');
var basicAuth = require('connect-basic-auth');
var bodyParser = require('body-parser')
var process = require('process');
var fs = require('fs');

var collectdHost = 'localhost';
var collectdPort = 25826;
var collectwVersion = "<%= pkg.version %>";
var collectwUser = 'admin';
var collectwPassword = md5(collectwUser);
var plugins = [];
var counters = [];
var client;
var path = require('path').dirname(require.main.filename);

var regPlugins = new Winreg({
      hive: Winreg.HKLM,
      key:  '\\Software\\Perfwatcher\\CollectW\\Plugins'
});

regPlugins.values(function (err, items) {
	if (err) {
		for (i in plugins) {
			regPlugins.set(i, 'REG_SZ', JSON.stringify(plugins[i]), function () {});
		}
	} else {
		for (var i in items) {
			plugins[items[i].name] = JSON.parse(items[i].value);
		}
	}
	for (i in plugins) {
		add_counter(plugins[i].counter, plugins[i].type, plugins[i].p, plugins[i].pi, plugins[i].t, plugins[i].ti);
	}

});


var regServer = new Winreg({
      hive: Winreg.HKLM,
      key:  '\\Software\\Perfwatcher\\CollectW\\Server'
});

regServer.values(function (err, items) {
	if (err) {
		regServer.set('host', 'REG_SZ', collectdHost, function () {});
		regServer.set('port', 'REG_SZ', collectdPort, function () {});
	} else {
		for (var i in items) {
			switch(items[i].name) {
				case 'host': 
					collectdHost = items[i].value;
				break;
				case 'port': 
					collectdPort = items[i].value;
				break;
			}
		}
	}
	client = new Collectd(1000, collectdHost, collectdPort);
	start_monitoring();
});

var regAccount = new Winreg({
      hive: Winreg.HKLM,
      key:  '\\Software\\Perfwatcher\\CollectW\\Account'
});

regAccount.values(function (err, items) {
	if (err) {
		regAccount.set('user', 'REG_SZ', collectwUser, function () {});
		regAccount.set('password', 'REG_SZ', collectwPassword, function () {});
	} else {
		for (var i in items) {
			switch(items[i].name) {
				case 'user': 
					collectwUser = items[i].value;
				break;
				case 'password': 
					collectwPassword = items[i].value;
				break;
			}
		}
	}
});

var cnts = ['Memory', 'Processor', 'PhysicalDisk', 'Server', 'Cache', 'Process'];

var each = function(obj, block) {
  for(attr in obj) {
    if(obj.hasOwnProperty(attr))
      block(attr, obj[attr]);
  }
}

function rename(name) {
	return name.replace(/[ -\/]/g, '_');
}

function get_cpu() {
	var cpus = os.cpus();
	var user = nice = sys = irq = idle = 0;
	each(cpus, function (cpu) {
		if (typeof counters['cpu-'+cpu] == 'undefined') {
			counters['cpu-'+cpu] = client.plugin('cpu', cpu);
		}
		counters['cpu-'+cpu].setCounter('cpu', 'user', parseInt(cpus[cpu].times.user) / 10);
		user += parseInt(cpus[cpu].times.user);
		counters['cpu-'+cpu].setCounter('cpu', 'nice', parseInt(cpus[cpu].times.nice) / 10);
		nice += parseInt(cpus[cpu].times.nice);
		counters['cpu-'+cpu].setCounter('cpu', 'system', parseInt(cpus[cpu].times.sys) / 10);
		sys += parseInt(cpus[cpu].times.sys);
		counters['cpu-'+cpu].setCounter('cpu', 'irq', parseInt(cpus[cpu].times.irq) / 10);
		irq += parseInt(cpus[cpu].times.irq);
		counters['cpu-'+cpu].setCounter('cpu', 'idle', parseInt(cpus[cpu].times.idle) / 10);
		idle += parseInt(cpus[cpu].times.idle);
	});
	if (typeof counters['cpu-total'] == 'undefined') {
		counters['cpu-total'] = client.plugin('cpu', 'total');
	}
	counters['cpu-total'].setCounter('cpu', 'user', user / 10 / cpus.length);
	counters['cpu-total'].setCounter('cpu', 'nice', nice / 10 / cpus.length);
	counters['cpu-total'].setCounter('cpu', 'system', sys / 10 / cpus.length);
	counters['cpu-total'].setCounter('cpu', 'irq', irq / 10 / cpus.length);
	counters['cpu-total'].setCounter('cpu', 'idle', idle / 10 / cpus.length);
	counters['cpu-total'].setGauge('nbcpu', '', cpus.length);
}


function get_memory() {
	var plugin = client.plugin('memory', '');
	var free = os.freemem();
	plugin.setGauge('memory', 'free', parseInt(free));
	plugin.setGauge('memory', 'used', parseInt(os.totalmem()) - parseInt(free));
}

function get_df() {
	var disks = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];
	each(disks, function (disk) {
		if (typeof counters['df-'+disks[disk]] == 'undefined') {
			counters['df-'+disks[disk]] = client.plugin('df', disks[disk]);
		}
		diskspace.check(disks[disk], function (total, free, status) {
			if (typeof status != 'undefined' && total > 0) {
				counters['df-'+disks[disk]].setGauge('df_complex', 'reserved', 0 );
				counters['df-'+disks[disk]].setGauge('df_complex', 'free', parseInt(free));
				counters['df-'+disks[disk]].setGauge('df_complex', 'used', (parseInt(total) - parseInt(free)));
			}
		});
	});

}

function get_disk() {
	perfmon.list('PhysicalDisk', function(err, datas) {
		perfmon(datas.counters, function(err, data) {
			var results = [];
			each(data.counters, function (metric, value) {
				var regex = /^PhysicalDisk\((.*)\)\\(.*)/
				var result = metric.match(regex);
				if (result[1] == '_Total') {
					disk = 'total';
				} else {
					disk = result[1].substr(2,1);
				}
				if (typeof results[disk] == 'undefined') {
					results[disk] = [];
				}
				if (typeof counters['disk-'+disk] == 'undefined') {
					counters['disk-'+disk] = client.plugin('disk', disk);
				}
				switch(result[2]) {
					case 'Disk Read Bytes/sec':
						results[disk]['disk_octet_read'] = value;
						if (typeof results[disk]['disk_octet_write'] != 'undefined') {
							counters['disk-'+disk].addCounter('disk_octets', '', [results[disk]['disk_octet_read'], results[disk]['disk_octet_write']]);
							delete results[disk]['disk_octet_write'];
						}
					break;
					case 'Disk Write Bytes/sec':
						results[disk]['disk_octet_write'] = value;
						if (typeof results[disk]['disk_octet_read'] != 'undefined') {
							counters['disk-'+disk].addCounter('disk_octets', '', [results[disk]['disk_octet_read'], results[disk]['disk_octet_write']]);
							delete results[disk]['disk_octet_read'];
						}
					break;
					case '% Disk Read Time':
						results[disk]['disk_read_time'] = Number(value / 100);
						if (typeof results[disk]['disk_write_time'] != 'undefined') {
							counters['disk-'+disk].addCounter('disk_time', '', [results[disk]['disk_read_time'], results[disk]['disk_write_time']]);
							delete results[disk]['disk_write_time'];
						}
					break;
					case '% Disk Write Time':
						results[disk]['disk_write_time'] = Number(value / 100);
						if (typeof results[disk]['disk_read_time'] != 'undefined') {
							counters['disk-'+disk].addCounter('disk_time', '', [results[disk]['disk_read_time'], results[disk]['disk_write_time']]);
							delete results[disk]['disk_read_time'];
						}
					break;
					case 'Disk Reads/sec':
						results[disk]['disk_read'] = value;
						if (typeof results[disk]['disk_write'] != 'undefined') {
							counters['disk-'+disk].addCounter('disk_ops', '', [results[disk]['disk_read'], results[disk]['disk_write']]);
							delete results[disk]['disk_write'];
						}
					break;
					case 'Disk Writes/sec':
						results[disk]['disk_write'] = value;
						if (typeof results[disk]['disk_read'] != 'undefined') {
							counters['disk-'+disk].addCounter('disk_ops', '', [results[disk]['disk_read'], results[disk]['disk_write']]);
							delete results[disk]['disk_read'];
						}
					break;
				}
			});
		});
	});
}

function get_interface() {
	perfmon.list('Network Interface', function(err, datas) {
		perfmon(datas.counters, function(err, data) {
			var results = [];
			each(data.counters, function (metric, value) {
				var regex = /^Network Interface\((.*)\)\\(.*)/
				var result = metric.match(regex);
				interface_name = rename(result[1]);
				var plugin = client.plugin('interface', interface_name);
				if (typeof results[interface_name] == 'undefined') {
					results[interface_name] = [];
				}
				switch(result[2]) {
					case 'Bytes Received/sec':
						results[interface_name]['if_octets_rx'] = value;
						if (typeof results[interface_name]['if_octets_tx'] != 'undefined') {
							plugin.addCounter('if_octets', '', [results[interface_name]['if_octets_rx'], results[interface_name]['if_octets_tx']]);
							delete results[interface_name]['if_octets_tx'];
						}
					break;
					case 'Bytes Sent/sec':
						results[interface_name]['if_octets_tx'] = value;
						if (typeof results[interface_name]['if_octets_rx'] != 'undefined') {
							plugin.addCounter('if_octets', '', [results[interface_name]['if_octets_rx'], results[interface_name]['if_octets_tx']]);
							delete results[interface_name]['if_octets_rx'];
						}
					break;
					case 'Packets Received/sec':
						results[interface_name]['if_packets_rx'] = Number(value / 100);
						if (typeof results[interface_name]['if_packets_tx'] != 'undefined') {
							plugin.addCounter('if_packets', '', [results[interface_name]['if_packets_rx'], results[interface_name]['if_packets_tx']]);
							delete results[interface_name]['if_packets_tx'];
						}
					break;
					case 'Packets Sent/sec':
						results[interface_name]['if_packets_tx'] = Number(value / 100);
						if (typeof results[interface_name]['if_packets_rx'] != 'undefined') {
							plugin.addCounter('if_packets', '', [results[interface_name]['if_packets_rx'], results[interface_name]['if_packets_tx']]);
							delete results[interface_name]['if_packets_rx'];
						}
					break;
					case 'Packets Received Errors':
						results[interface_name]['if_error_rx'] = value;
						if (typeof results[interface_name]['if_error_tx'] != 'undefined') {
							plugin.addCounter('if_errors', '', [results[interface_name]['if_error_rx'], results[interface_name]['if_error_tx']]);
							delete results[interface_name]['if_error_tx'];
						}
					break;
					case 'Packets Outbound Errors':
						results[interface_name]['if_error_tx'] = value;
						if (typeof results[interface_name]['if_error_rx'] != 'undefined') {
							plugin.addCounter('if_errors', '', [results[interface_name]['if_error_rx'], results[interface_name]['if_error_tx']]);
							delete results[interface_name]['if_error_rx'];
						}
					break;
				}
			});
		});
	});
}

function get_load() {
	var plugin = client.plugin('load', '');
	cpu.totalLoad(function (error, results) {
		if (error) { return; }
		var total = 0;
		each(results ,function(cpunb) {
			total += parseInt(results[cpunb]);
		});
		plugin.setGauge('percent', '', total/results.length);
	});
}

function get_uptime() {
	var plugin = client.plugin('uptime', '');
	plugin.setGauge('uptime', '', os.uptime());
}

function get_process() {
	var plugin = client.plugin('processes', '');
	perfmon('\\Thread(_Total/_Total)\\Context Switches/sec', function(err, data) {
		plugin.addCounter('contextswitch', '', data.counters['\\Thread(_Total/_Total)\\Context Switches/sec']);
	});
}

function get_swap() {
	var plugin = client.plugin('swap', '');
	perfmon('\\Paging File(_Total)\\% Usage', function(err, data) {
		plugin.setGauge('percent', '', data.counters['\\Paging File(_Total)\\% Usage']);
	});
}

function start_monitoring() {
	get_cpu();
	setInterval(get_cpu, 10000);
	get_memory();
	setInterval(get_memory, 10000);
	get_df();
	setInterval(get_df, 10000);
	get_disk();
	get_interface();
	get_load();
	setInterval(get_load, 10000);
	get_uptime();
	setInterval(get_uptime, 60000);
	get_process();
	get_swap();
}

function add_counter(counter, type, p, pi, t, ti) {
	counter = counter.replace(/\\\\/g, "\\");
	if (typeof pi == 'undefined') { pi = ''; }
	if (typeof ti == 'undefined') { ti = ''; }
	if (typeof counters[p+'-'+pi] == 'undefined') {
		counters[p+'-'+pi] = client.plugin(p, pi);
	}
	perfmon(counter, function(err, data) {
		if (typeof data === 'undefined' || typeof data.counters === 'undefined') { return; }
		switch (type) {
			case 'counter':
				counters[p+'-'+pi].addCounter(t, ti, data.counters[counter]);
			break;
			case 'gauge':
				counters[p+'-'+pi].setGauge(t, ti, data.counters[counter]);
			break;
		}
	});
}

var app = express();
app.use(bodyParser.urlencoded({extended: true}));

app.use(basicAuth(function(credentials, req, res, next) {
	if (credentials.username != collectwUser || md5(credentials.password) != collectwPassword) {
		res.statusCode = 401;
		res.json({error: 'Invalid credential'})
	} else { next(); }
}, 'Please enter your credentials.'));

app.all('*', function(req, res, next) {
  req.requireAuthorization(req, res, next);
});

app.get('/', function(req, res) {
	res.set('Content-Type', 'text/html');
	res.send(fs.readFileSync(path + '\\frontend\\index.html'));
});

app.get('/jquery-2.1.1.min.js', function(req, res) {
	res.set('Content-Type', 'application/javascript');
	res.send(fs.readFileSync(path + '\\frontend\\jquery-2.1.1.min.js'));
});

app.get('/version', function(req, res) {
	res.set('Content-Type', 'application/json');
	res.json({ version: collectwVersion	});
});

app.get('/collectw_pid', function(req, res) {
	res.set('Content-Type', 'application/json');
	res.json({ collectw_pid: process.pid	});
});

app.get('/allCounters', function(req, res) {
	res.set('Content-Type', 'application/json');
	perfmon.list('', function(err, datas) {
		res.json(datas.counters);
	});
});

app.get('/counters', function(req, res) {
	res.set('Content-Type', 'application/json');
	// Ugly thing cause a strange bug with res.send(plugins);
	var txt = "";
	for (i in plugins) {
		txt += ",\"" + i + "\": " + JSON.stringify(plugins[i]);
	}
	res.send("{" + txt.substr(1) + "}");
});

app.delete('/counters/:name', function(req, res) {
	res.set('Content-Type', 'application/json');
	regPlugins.remove(req.params.name, function () {
		delete plugins[req.params.name];
		res.json({message: "Counter deleted. Will take effect on next start"});
		res.send();
	});
});

app.put('/counters', function(req, res) {
	res.set('Content-Type', 'application/json');
	if(		typeof req.body.counter != 'undefined'
		&&	typeof req.body.type != 'undefined' 
		&&	typeof req.body.p != 'undefined' 
		&&	typeof req.body.t != 'undefined' 
		&&	req.body.counter != ''
		&&	req.body.type != ''
		&&	req.body.p != ''
		&&	req.body.t != ''
	) {
		if (typeof req.body.pi == 'undefined') { req.body.pi = ''; }
		if (typeof req.body.ti == 'undefined') { req.body.ti = ''; }
		var md5name = md5(req.body.p+'-'+req.body.pi+'/'+req.body.t+'-'+req.body.ti);
		plugins[md5name] = {counter: req.body.counter, p: req.body.p, pi: req.body.pi, t: req.body.t, ti: req.body.ti, type: req.body.type};
		regPlugins.set(md5name, 'REG_SZ', JSON.stringify(plugins[md5name]), function () {
			add_counter(req.body.counter, req.body.type, req.body.p, req.body.pi, req.body.t, req.body.ti);
			res.json({message: "Counter added"});
		});
	} else {
		res.json({error: "Counter " + md5name + " not added. Some parameter is/are missing"});
	}
});

app.get('/server', function(req, res) {
	res.set('Content-Type', 'application/json');
	res.json({ 
		serverHost: collectdHost, serverPort: collectdPort 
	});
});

app.post('/process/stop', function(req, res) {
	res.set('Content-Type', 'application/json');
	process.exit();
});

app.post('/server', function(req, res) {
	res.set('Content-Type', 'application/json');
	if(		typeof req.body.host != 'undefined'
		&&	typeof req.body.port != 'undefined' 
		&&	req.body.host != ''
		&&	req.body.port != ''
	) {
		collectdHost = req.body.host;
		collectdPort = req.body.port;
		regServer.set('host', 'REG_SZ', collectdHost, function () {});
		regServer.set('port', 'REG_SZ', collectdPort, function () {});
		res.json({message: "Host and port updated. Will take effect on next start"});
	} else {
		res.json({error: "Host and port not updated"});
	}
});

app.post('/account', function(req, res) {
	res.set('Content-Type', 'application/json');
	if(		typeof req.body.user != 'undefined'
		&&	typeof req.body.password != 'undefined' 
		&&	req.body.user != ''
		&&	req.body.password != ''
	) {
		collectwUser = req.body.user;
		collectwPassword = md5(req.body.password);
		regAccount.set('user', 'REG_SZ', collectwUser, function () {});
		regAccount.set('password', 'REG_SZ', collectwPassword, function () {});
		res.json({message: "User and password updated"});
	} else {
		res.json({error: "User and password not updated"});
	}
});

var server = app.listen(collectdPort);


