
var process = require('process');
process.env.ALLOW_CONFIG_MUTATIONS = 1;

var os = require('os');
var Collectd = require('collectdout');
var diskspace = require('diskspace');
var perfmon = require('perfmon');
var cpu = require('windows-cpu');
var cfg = require('config');
var collectwHTTPConfig = require('./httpconfig.js');

var collectwVersion = '<%= pkg.version %>';

var counters = [];
var client;
var path = require('path').dirname(require.main.filename);

var get_perfmon = new pluginPerfmon();

var plugin = {};
var pluginsCfg = [];

// Initialize configuration directory in the same way that node-config does.
var configDir = cfg.util.initParam('NODE_CONFIG_DIR', process.cwd() + '/config');
if (configDir.indexOf('.') === 0) {
    configDir = process.cwd() + '/' + CONFIG_DIR;
}

var each = function(obj, block) {
  var attr;
  for(attr in obj) {
    if(obj.hasOwnProperty(attr))
      block(attr, obj[attr]);
  }
};

function get_hostname_with_case() {
    var h = cfg.has('Hostname') ? cfg.get('Hostname') : os.hostname();
    var hcase = cfg.has('HostnameCase') ? cfg.get('HostnameCase') : 'default';
    switch(hcase) {
        case 'upper': h = h.toUpperCase(); break;
        case 'lower': h = h.toLowerCase(); break;
    }
    return(h);
}

function get_collectd_servers_and_ports() {
    var servers = cfg.has('Network.servers') ? cfg.get('Network.servers') : {};
    var res = [];
    for (var i in servers) {
        res.push( [ servers[i].hostname, (servers[i].port || 25826) ] );
    }
    return(res);
}

function get_interval() {
    return(cfg.has('Interval') ? (cfg.get('Interval') * 1000) : 10000);
}

function collectd_sanitize(name) {
    return name.replace(/[ -\/\(\)]/g, '_');
}

function pluginPerfmon() {
    var config = {};

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

    this.configShow = function() {
        return(config);
    };

    this.toString = function() {
        return(JSON.stringify(config));
    };

    this.reloadConfig = function(c) {
        for (var i in c.counters) {
            var pm = c.counters[i];
            if(pm.enable) {
                //FIXME : ensure that pm.* is defined and sanitized
                pm.plugin = collectd_sanitize(pm.plugin);
                pm.plugin_instance = collectd_sanitize(pm.plugin_instance);
                pm.type = collectd_sanitize(pm.type);
                pm.type_instance = collectd_sanitize(pm.type_instance);
                pm.collectdType = 'gauge'; //FIXME : use Collectd Types.db instead of hardcoded gauge.
                config[pm.counter] = pm;
            }
        }
        return(this);
    };

    this.reInit = function() {
        //FIXME : remove all Perfmon counters
        config = {};
        return(this);
    };

    this.monitor = function() {
        for (var i in config) {
            pm = config[i];
            add_counter(pm.counter, pm.collectdType, pm.plugin, pm.plugin_instance, pm.type, pm.type_instance);
        }
        return(this);
    };
}

function start_monitoring() {

    get_perfmon.reInit();
    get_perfmon.reloadConfig(cfg.get('Plugin.perfmon'));
    get_perfmon.monitor();

}

client = new Collectd(get_interval(), get_collectd_servers_and_ports(), 0, get_hostname_with_case());

/* Load the httpconfig User Interface */
if(cfg.get('HttpConfig.enable')) {
    collectwHTTPConfig.init({
            cfg: cfg,
            path: path,
            configDir: configDir,
            collectwVersion: collectwVersion,
            plugins: {
                perfmon: get_perfmon
                }
            });
    collectwHTTPConfig.start();
}

/* Load the plugins */
pluginsCfg = cfg.has('Plugin') ? cfg.get('Plugin') : [];
plugin = {};
each(pluginsCfg, function(p) {
    var enabled;
    try {
        enabled = cfg.has('Plugin.'+p+'.enable') ? cfg.get('Plugin.'+p+'.enable') : 1;
        if(enabled) {
            plugin[p] = require('./plugins/'+p+'.js');
        }
    } catch(e) {
        console.log('Failed to load plugin '+p+'\n');
    }
});

/* Initialize the plugins */
each(plugin, function(p) {
    try {
        plugin[p].reInit();
    } catch(e) {
        console.log('Failed to reInit plugin '+p+' ('+e+')\n');
    }
});

/* Configure the plugins */
each(plugin, function(p) {
    try {
        plugin[p].reloadConfig({
            config: cfg.get('Plugin.'+p),
            client: client,
            counters: counters,
        });
    } catch(e) {
        console.log('Failed to reloadConfig plugin '+p+' ('+e+')\n');
    }
});

/* Start the plugins */
each(plugin, function(p) {
    try {
        plugin[p].monitor();
    } catch(e) {
        console.log('Failed to start plugin '+p+' monitor ('+e+')\n');
    }
});


start_monitoring();

// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
