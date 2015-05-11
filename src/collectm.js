
var process = require('process');
process.env.ALLOW_CONFIG_MUTATIONS = 1;


var os = require('os');
var Collectd = require('collectdout');
var cfg = require('config');
var collectmHTTPConfig = require('./httpconfig.js');

var collectmVersion = '<%= pkg.version %>';

var counters = [];
var client;
var path = require('path');
var fs = require('fs');
var cu = require('./collectm_utils.js');
var prefix = path.join(path.dirname(require.main.filename), '..');
var collectmHostname = 'unknown';
var collectmTimeToLive = 0;
var logdeletiondays = 0;

// Initialize logger
try {
    fs.mkdirSync(path.join(prefix, 'logs'));
} catch(e) {
    if ( e.code != 'EEXIST' ) throw e;
}
var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)(),
        new (winston.transports.DailyRotateFile)({
                filename: path.join(prefix, 'logs', 'collectm.log'),
                handleExceptions: true,
                maxsize: 10000000,
                maxFiles: 10,
                prettyPrint: true,
                json:false,
                datePattern: '.yyyy-MM-dd',
                exitOnError: false })
        ]
});

logger.info('Collectm version %s', collectmVersion);
logger.info('Collectm is starting');

var plugin = {};
var pluginsCfg = [];

// Initialize configuration directory in the same way that node-config does.
var configDir = cfg.util.initParam('NODE_CONFIG_DIR', path.join(prefix,'config'));
if (configDir.indexOf('.') === 0) {
    configDir = path.join(process.cwd(), configDir);
}
logger.info('Using configuration files in '+configDir);
process.env.NODE_CONFIG_DIR=configDir;
cfg = cfg.util.extendDeep({}, cfg, cfg.util.loadFileConfigs());

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
    var h;
    var p;
    for (var i in servers) {
        h = servers[i].hostname;
        p = servers[i].port || 25826;
        res.push( [ h, p ] );
        logger.log('info', 'Sending metrics to Collectd '+h+':'+p+'.');
    }
    return(res);
}

function get_interval() {
    return(cfg.has('Interval') ? (cfg.get('Interval') * 1000) : 60000);
}

function get_security_level() {
    var securityLevel = 0;
    if (cfg.has('Crypto') && cfg.get('Crypto').SecurityLevel !== undefined) {
        securityLevel = cfg.get('Crypto').SecurityLevel;
        if (securityLevel !== 0 && securityLevel !== 1 && securityLevel !== 2) {
            throw new Error('Security level must be in (0, 1, 2).');
        }
    }
    if ((get_username() === '' || get_password() === '') && securityLevel > 0) {
        throw new Error('Security level set greater to 0 but username or password left empty.');
    }
    return securityLevel;
}

function get_username() {
    if (cfg.has('Crypto') && cfg.get('Crypto').Username !== undefined) {
        return cfg.get('Crypto').Username;
    }
    return '';
}

function get_password() {
    if (cfg.has('Crypto') && cfg.get('Crypto').Password !== undefined) {
        return cfg.get('Crypto').Password;
    }
    return '';
}

function get_collectm_ttl() {
    return(cfg.has('CollectmTimeToLive') ? (cfg.get('CollectmTimeToLive') * 1000) : 0);
}

function get_log_deletion_days() {
    return(cfg.has('LogDeletionDays') ? (cfg.get('LogDeletionDays') ) : 0);
}

function remove_old_logs(days) {
    var now = new Date();
    now = now.getTime();

    fs.readdir(path.join(prefix, 'logs'), function(err, files) {
            var filenames;
            if(err) {
                logger.log('error', 'Problem while reading log dir : '+err);
                return;
            }
            filenames = files.map(function (f) {
                return path.join(prefix,'logs',f);
                });

            each(filenames, function(i,f) {
                if(/collectm\.log/.test(f)) {
                    fs.stat(f, function(err, stat) {
                        if(err) {
                            logger.log('error', 'Problem while reading log file '+f+' : '+err);
                            return;
                        }
                        if(stat.isFile()) {
                            if(now - stat.mtime.getTime() > (days * 86400 * 1000)) {
                                logger.log('info', 'Removing old log '+f);
                                fs.unlink(f, function(err) {
                                    if(err) {
                                        logger.log('error', 'Problem while removing log file '+f+' : '+err);
                                    }
                                });
                            }
                        }
                    });
                }
            });

    });
}

collectmHostname = get_hostname_with_case();
logger.log('info', 'Sending metrics to Collectd with hostname '+collectmHostname+' (case sensitive).');
client = new Collectd(get_interval(), get_collectd_servers_and_ports(), 0, collectmHostname,
                      get_security_level(), get_username(), get_password());

/* Load the plugins */
pluginsCfg = cfg.has('Plugin') ? cfg.get('Plugin') : [];
plugin = {};
each(pluginsCfg, function(p) {
    var enabled;
    plugin[p] = { 'enabled': 0 };
    try {
        enabled = cfg.has('Plugin.'+p+'.enable') ? cfg.get('Plugin.'+p+'.enable') : 1;
        if(enabled) {
            plugin[p].plugin = require(path.join(prefix,'plugins', p+'.js'));
            plugin[p].enabled = 1;
        }
    } catch(e) {
        logger.error('Failed to load plugin '+p+' ('+e+')\n');
        plugin[p].enabled = 0;
    }
});

/* Initialize the plugins */
each(plugin, function(p) {
    if(plugin[p].enabled) {
        try {
            plugin[p].plugin.reInit();
            logger.info('Plugin %s : reInit done', p);
        } catch(e) {
            logger.error('Failed to reInit plugin '+p+' ('+e+')\n');
        }
    }
});

/* Configure the plugins */
each(plugin, function(p) {
    if(plugin[p].enabled) {
        try {
            rc = plugin[p].plugin.reloadConfig({
                config: cfg.get('Plugin.'+p),
               client: client,
               counters: counters,
               logger: logger
            });
            if(rc) {
                logger.info('Plugin %s : reloadConfig failed. Disabling plugin.', p);
                plugin[p].enabled = 0;

            } else {
                logger.info('Plugin %s : reloadConfig done', p);
            }
        } catch(e) {
            logger.error('Failed to reloadConfig plugin '+p+' ('+e+')\n');
            plugin[p].enabled = 0;
        }
    }
});

/* Start the plugins */
each(plugin, function(p) {
    if(plugin[p].enabled) {
        try {
            plugin[p].plugin.monitor();
            logger.info('Plugin %s : monitoring enabled', p);
        } catch(e) {
            logger.error('Failed to start plugin '+p+' monitor ('+e+')\n');
        }
    }
});

/* Load the httpconfig User Interface */
if(cfg.get('HttpConfig.enable')) {
    collectmHTTPConfig.init({
            cfg: cfg,
            path: prefix,
            configDir: configDir,
            collectmVersion: collectmVersion,
            plugins: plugin,
            });
    collectmHTTPConfig.start();
    logger.info('Enabled httpconfig server');
}

/* Set Time To Live for this process (prevent memory leak impact) */
collectmTimeToLive = get_collectm_ttl();
if(collectmTimeToLive > 60) {
    logger.info('TTL configured : will gracefully stop after '+parseInt(collectmTimeToLive/1000)+' seconds');
    setTimeout(function() {
            logger.error('Gracefully stopped after configured TTL');
            process.exit();
            }, collectmTimeToLive);
}

/* Remove old logs */
logdeletiondays = get_log_deletion_days();
if(logdeletiondays > 0) {
    logger.info('Log files will be deleted after '+parseInt(logdeletiondays)+' days');
    remove_old_logs(logdeletiondays);
    setInterval(function() { remove_old_logs(logdeletiondays); }, 86400 * 1000);
}

// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
