
var os = require('os');
var diskspace = require('diskspace');
var perfmon = require('perfmon');
var cpu = require('windows-cpu');

var counters = [];
var client;
var cfg;

var each = function(obj, block) {
  var attr;
  for(attr in obj) {
    if(obj.hasOwnProperty(attr))
      block(attr, obj[attr]);
  }
};

function collectd_sanitize(name) {
    return name.replace(/[ -\/\(\)]/g, '_');
}

function get_cpu() {
    var cpus = os.cpus();
    var user = 0;
    var nice = 0;
    var sys = 0;
    var irq = 0;
    var idle = 0;
    
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
                var regex = /^PhysicalDisk\((.*)\)\\(.*)/;
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
                        results[disk].disk_octet_read = value;
                        if (typeof results[disk].disk_octet_write != 'undefined') {
                            counters['disk-'+disk].addCounter('disk_octets', '', [results[disk].disk_octet_read, results[disk].disk_octet_write]);
                            delete results[disk].disk_octet_write;
                        }
                    break;
                    case 'Disk Write Bytes/sec':
                        results[disk].disk_octet_write = value;
                        if (typeof results[disk].disk_octet_read != 'undefined') {
                            counters['disk-'+disk].addCounter('disk_octets', '', [results[disk].disk_octet_read, results[disk].disk_octet_write]);
                            delete results[disk].disk_octet_read;
                        }
                    break;
                    case '% Disk Read Time':
                        results[disk].disk_read_time = Number(value / 100);
                        if (typeof results[disk].disk_write_time != 'undefined') {
                            counters['disk-'+disk].addCounter('disk_time', '', [results[disk].disk_read_time, results[disk].disk_write_time]);
                            delete results[disk].disk_write_time;
                        }
                    break;
                    case '% Disk Write Time':
                        results[disk].disk_write_time = Number(value / 100);
                        if (typeof results[disk].disk_read_time != 'undefined') {
                            counters['disk-'+disk].addCounter('disk_time', '', [results[disk].disk_read_time, results[disk].disk_write_time]);
                            delete results[disk].disk_read_time;
                        }
                    break;
                    case 'Disk Reads/sec':
                        results[disk].disk_read = value;
                        if (typeof results[disk].disk_write != 'undefined') {
                            counters['disk-'+disk].addCounter('disk_ops', '', [results[disk].disk_read, results[disk].disk_write]);
                            delete results[disk].disk_write;
                        }
                    break;
                    case 'Disk Writes/sec':
                        results[disk].disk_write = value;
                        if (typeof results[disk].disk_read != 'undefined') {
                            counters['disk-'+disk].addCounter('disk_ops', '', [results[disk].disk_read, results[disk].disk_write]);
                            delete results[disk].disk_read;
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
                var regex = /^Network Interface\((.*)\)\\(.*)/;
                var result = metric.match(regex);
                interface_name = collectd_sanitize(result[1]);
                var plugin = client.plugin('interface', interface_name);
                if (typeof results[interface_name] == 'undefined') {
                    results[interface_name] = [];
                }
                switch(result[2]) {
                    case 'Bytes Received/sec':
                        results[interface_name].if_octets_rx = value;
                        if (typeof results[interface_name].if_octets_tx != 'undefined') {
                            plugin.addCounter('if_octets', '', [results[interface_name].if_octets_rx, results[interface_name].if_octets_tx]);
                            delete results[interface_name].if_octets_tx;
                        }
                    break;
                    case 'Bytes Sent/sec':
                        results[interface_name].if_octets_tx = value;
                        if (typeof results[interface_name].if_octets_rx != 'undefined') {
                            plugin.addCounter('if_octets', '', [results[interface_name].if_octets_rx, results[interface_name].if_octets_tx]);
                            delete results[interface_name].if_octets_rx;
                        }
                    break;
                    case 'Packets Received/sec':
                        results[interface_name].if_packets_rx = Number(value / 100);
                        if (typeof results[interface_name].if_packets_tx != 'undefined') {
                            plugin.addCounter('if_packets', '', [results[interface_name].if_packets_rx, results[interface_name].if_packets_tx]);
                            delete results[interface_name].if_packets_tx;
                        }
                    break;
                    case 'Packets Sent/sec':
                        results[interface_name].if_packets_tx = Number(value / 100);
                        if (typeof results[interface_name].if_packets_rx != 'undefined') {
                            plugin.addCounter('if_packets', '', [results[interface_name].if_packets_rx, results[interface_name].if_packets_tx]);
                            delete results[interface_name].if_packets_rx;
                        }
                    break;
                    case 'Packets Received Errors':
                        results[interface_name].if_error_rx = value;
                        if (typeof results[interface_name].if_error_tx != 'undefined') {
                            plugin.addCounter('if_errors', '', [results[interface_name].if_error_rx, results[interface_name].if_error_tx]);
                            delete results[interface_name].if_error_tx;
                        }
                    break;
                    case 'Packets Outbound Errors':
                        results[interface_name].if_error_tx = value;
                        if (typeof results[interface_name].if_error_rx != 'undefined') {
                            plugin.addCounter('if_errors', '', [results[interface_name].if_error_rx, results[interface_name].if_error_tx]);
                            delete results[interface_name].if_error_rx;
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

exports.reInit = function() {

};

exports.reloadConfig = function(c) {
    client = c.client;
    cfg = c.cfg;
    counters = c.counters;
};

exports.monitor = function () {
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
};


// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
