
/* Load some utilities */
var cu = require('../lib/collectm_utils.js');
var os = require('os');

var logger;
var counters;
var client;
var cfg;

function get_sysconfig() {
    var msg = os.type()+';'
        +os.platform()+';'
        +os.arch()+';'
        +os.release()+';'
        +'\n';

    client.sendNotif({
        h: undefined,
        p: 'sysconfig',
        t: 'distrib',
        severity: client.NOTIF_OK,
        message: msg
    });

    msg = 'Package=<%= pkg.name %>\n'
        +'Version=<%= pkg.version %>\n'
        +'Built=<%= grunt.template.today("yyyy-mm-dd HH:MM:ss") %>\n';

    client.sendNotif({
        h: undefined,
        p: 'sysconfig',
        t: 'collectm_version_info',
        severity: client.NOTIF_OK,
        message: msg
    });
}

/* configShow : returns the current configuration.
 * Note : JSON.stringify( configShow ) should be exportable "as is" to the configuration file.
 */
exports.configShow = function() {
    return({});
};

/* reInit : clean and initialize the plugin */
exports.reInit = function() {
   
};

/* reloadConfig : clean and reload the configuration */
exports.reloadConfig = function(c) {
    cfg = c.config;
    client = c.client;
    counters = c.counters;
    logger = c.logger;
};

/* Start the monitoring defined in the plugin */
exports.monitor = function() {
    get_sysconfig();
    setInterval(get_sysconfig, 86400000);
    /* start the monitoring here */
};

// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
