/*! CollectM - v1.5.1 - Built 2015-04-15 */


var os = require('os');
var diskspace = require('diskspace');
var perfmon = require('perfmon');
var cu = require('../lib/collectm_utils.js');

var logger;
var counters = {};
var known_disks = [];
var known_disks_letters = [];
var known_interfaces = [];
var client;
var cfg;

var each = function(obj, block) { // {{{
  var attr;
  for(attr in obj) {
    if(obj.hasOwnProperty(attr))
      block(attr, obj[attr]);
  }
}; // }}}

var perfmonCounterToPlugin = function(pm, p, pi, t, ti) { // {{{
    // Note : do not use this function if you have more than one pm for the same (p,pi)
    var plugin = client.plugin(p, pi);
    perfmon(pm, function(err, data) {
        plugin.addCounter(t, ti, data.counters[pm]);
    });
}; // }}}

var perfmonGaugeToPlugin = function(pm, p, pi, t, ti) { // {{{
    // Note : do not use this function if you have more than one pm for the same (p,pi)
    var plugin = client.plugin(p, pi);
    perfmon(pm, function(err, data) {
        if(typeof(data) !== 'undefined' && data.hasOwnProperty('counters') && data.counters.hasOwnProperty(pm)) {
            plugin.setGauge(t, ti, data.counters[pm]);
        } else {
            logger.log('warn', 'What\'s happening ? No counter for '+p+(pi?('-'+pi):'')+'/'+t+(ti?('-'+ti):''));
        }
    });
}; // }}}

function get_cpu() { // {{{
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
} // }}}
function launch_collector_cpu(interval) { // {{{
    get_cpu();
    setInterval(get_cpu, interval);
} // }}}

function get_memory() { // {{{
    var plugin = client.plugin('memory', '');
    var free = os.freemem();
    plugin.setGauge('memory', 'free', parseInt(free));
    plugin.setGauge('memory', 'used', parseInt(os.totalmem()) - parseInt(free));
} // }}}
function launch_collector_memory(interval) { // {{{
    get_memory();
    setInterval(get_memory, interval);

    perfmonGaugeToPlugin('\\Memory\\Pool Nonpaged Allocs', 'memory', '', 'memory', 'pool_nonpaged_allocs');
    perfmonCounterToPlugin('\\Server\\Pool Paged Failures', 'memory', '', 'swap_io', 'pool_paged_failures');
} // }}}

function get_interface() { // {{{
    perfmon.list('Network Interface', function(err, datas) {
        var newcounters = datas.counters.sort();
        if((newcounters.length!=known_interfaces.length)
                || ! (newcounters.every(function(v,i) { return (v === known_interfaces[i]); } ))) {
            known_interfaces = newcounters;

            perfmon(known_interfaces, function(err, data) {
                var results = {};
                each(data.counters, function (metric, value) {
                    var regex = /^Network Interface\((.*)\)\\(.*)/;
                    var result = metric.match(regex);
                    var interface_name = cu.collectd_sanitize(result[1]);
                    var plugin = client.plugin('interface', interface_name);
                    if (typeof results[interface_name] == 'undefined') {
                        results[interface_name] = {};
                    }
                    switch(result[2]) {
                        case 'Bytes Received/sec':
                            results[interface_name].if_octets_rx = value;
                            if (typeof results[interface_name].if_octets_tx != 'undefined') {
                                plugin.addCounter('if_octets', '', [results[interface_name].if_octets_rx, results[interface_name].if_octets_tx]);
                                delete results[interface_name].if_octets_rx;
                                delete results[interface_name].if_octets_tx;
                            }
                        break;
                        case 'Bytes Sent/sec':
                            results[interface_name].if_octets_tx = value;
                            if (typeof results[interface_name].if_octets_rx != 'undefined') {
                                plugin.addCounter('if_octets', '', [results[interface_name].if_octets_rx, results[interface_name].if_octets_tx]);
                                delete results[interface_name].if_octets_rx;
                                delete results[interface_name].if_octets_tx;
                            }
                        break;
                        case 'Packets Received/sec':
                            results[interface_name].if_packets_rx = Number(value / 100);
                            if (typeof results[interface_name].if_packets_tx != 'undefined') {
                                plugin.addCounter('if_packets', '', [results[interface_name].if_packets_rx, results[interface_name].if_packets_tx]);
                                delete results[interface_name].if_packets_rx;
                                delete results[interface_name].if_packets_tx;
                            }
                        break;
                        case 'Packets Sent/sec':
                            results[interface_name].if_packets_tx = Number(value / 100);
                            if (typeof results[interface_name].if_packets_rx != 'undefined') {
                                plugin.addCounter('if_packets', '', [results[interface_name].if_packets_rx, results[interface_name].if_packets_tx]);
                                delete results[interface_name].if_packets_rx;
                                delete results[interface_name].if_packets_tx;
                            }
                        break;
                        case 'Packets Received Errors':
                            results[interface_name].if_error_rx = value;
                            if (typeof results[interface_name].if_error_tx != 'undefined') {
                                plugin.addCounter('if_errors', '', [results[interface_name].if_error_rx, results[interface_name].if_error_tx]);
                                delete results[interface_name].if_error_rx;
                                delete results[interface_name].if_error_tx;
                            }
                        break;
                        case 'Packets Outbound Errors':
                            results[interface_name].if_error_tx = value;
                            if (typeof results[interface_name].if_error_rx != 'undefined') {
                                plugin.addCounter('if_errors', '', [results[interface_name].if_error_rx, results[interface_name].if_error_tx]);
                                delete results[interface_name].if_error_rx;
                                delete results[interface_name].if_error_tx;
                            }
                        break;
                    }
                });
            });
        }
    });
} // }}}
function launch_collector_interface(interval) { // {{{
    get_interface();
    setInterval(get_interface, interval);
} // }}}

function launch_collector_load() { // {{{
    perfmonGaugeToPlugin('\\processor(_total)\\% processor time', 'load', '', 'percent', '');
} // }}}
function get_uptime() { // {{{
    var plugin = client.plugin('uptime', '');
    plugin.setGauge('uptime', '', os.uptime());
} // }}}

function launch_collector_uptime(interval) { // {{{
    get_uptime();
    setInterval(get_uptime, interval);
} // }}}

function launch_collector_process() { // {{{
    perfmonCounterToPlugin('\\Thread(_Total/_Total)\\Context Switches/sec', 'processes', '', 'contextswitch', '');
    perfmonGaugeToPlugin('\\Process(_Total)\\Pool Nonpaged Bytes', 'processes', '', 'bytes', 'pool_nonpaged');
    perfmonGaugeToPlugin('\\Process(services)\\% Privileged Time', 'processes', 'services', 'percent', 'privileged_time');
    perfmonGaugeToPlugin('\\Process(csrss)\\% Privileged Time', 'processes', 'csrss', 'percent', 'privileged_time');
} // }}}

function launch_collector_swap() { // {{{
    perfmonGaugeToPlugin('\\Paging File(_Total)\\% Usage', 'swap', '', 'percent', '');
} // }}}

exports.configShow = function() { // {{{
    return({});
}; // }}}

exports.reInit = function() { // {{{
    return(0);
}; // }}}

exports.reloadConfig = function(c) { // {{{
    client = c.client;
    cfg = c.config;
    counters = c.counters;
    logger = c.logger;
    return(0);
}; // }}}

exports.monitor = function () {
    var default_interval = cfg.interval || client.interval || 60000;

    if (typeof cfg.modules === 'undefined' || typeof cfg.modules.cpu === 'undefined' || cfg.modules.cpu == 1) {
        launch_collector_cpu(default_interval);
        logger.info('Enabling CollectdCompat cpu module');
    }
    if (typeof cfg.modules === 'undefined' || typeof cfg.modules.memory === 'undefined' || cfg.modules.memory == 1) {
        launch_collector_memory(default_interval);
        logger.info('Enabling CollectdCompat memory module');
    }
    if (typeof cfg.modules === 'undefined' || typeof cfg.modules.interface === 'undefined' || cfg.modules.interface == 1) {
        launch_collector_interface(default_interval);
        logger.info('Enabling CollectdCompat interface module');
    }
    if (typeof cfg.modules === 'undefined' || typeof cfg.modules.uptime === 'undefined' || cfg.modules.uptime == 1) {
        launch_collector_uptime(default_interval);
        logger.info('Enabling CollectdCompat uptime module');
    }
    if (typeof cfg.modules === 'undefined' || typeof cfg.modules.process === 'undefined' || cfg.modules.process == 1) {
        launch_collector_process(default_interval);
        logger.info('Enabling CollectdCompat process module');
    }
    if (typeof cfg.modules === 'undefined' || typeof cfg.modules.swap === 'undefined' || cfg.modules.swap == 1) {
        launch_collector_swap(default_interval);
        logger.info('Enabling CollectdCompat module');
    }
};


// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
