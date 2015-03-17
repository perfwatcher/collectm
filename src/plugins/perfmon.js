
var perfmon = require('perfmon');
var cu = require('../lib/collectm_utils.js');

var logger;
var counters;
var client;
var pmCfg = {};

function add_counter(counter, type, p, pi, t, ti) {
    counter = counter.replace(/\\\\/g, '\\');
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

exports.configShow = function() {
    return(pmCfg);
};

exports.reloadConfig = function(c) {
    var cfg = c.config;
    client = c.client;
    counters = c.counters;
    logger = c.logger;

    for (var i in cfg.counters) {
        var pm = cfg.counters[i];
        if(pm.enable) {
            //FIXME : ensure that pm.* is defined and sanitized
            pm.plugin = cu.collectd_sanitize(pm.plugin);
            pm.plugin_instance = cu.collectd_sanitize(pm.plugin_instance);
            pm.type = cu.collectd_sanitize(pm.type);
            pm.type_instance = cu.collectd_sanitize(pm.type_instance);
            pm.collectdType = 'gauge'; //FIXME : use Collectd Types.db instead of hardcoded gauge.
            pmCfg[pm.counter] = pm;
        }
    }
    return(0);
};

exports.reInit = function() {
    //FIXME : remove all Perfmon counters
    pmCfg = {};
    return(0);
};

exports.monitor = function() {
    for (var i in pmCfg) {
        pm = pmCfg[i];
        add_counter(pm.counter, pm.collectdType, pm.plugin, pm.plugin_instance, pm.type, pm.type_instance);
    }
};

// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
