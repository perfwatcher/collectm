
/* This is an example of a CollectM plugin */

/* Load some utilities */
var cu = require('../lib/collectm_utils.js');

var logger;
var counters;
var client;
var cfg;

/* configShow : returns the current configuration.
 * Note : JSON.stringify( configShow ) should be exportable "as is" to the configuration file.
 */
exports.configShow = function() {
    return({});
};

/* reInit : clean and initialize the plugin */
exports.reInit = function() {
    /* reinitialize the plugin here */
};

/* reloadConfig : clean and reload the configuration */
exports.reloadConfig = function(c) {
    cfg = c.config;
    client = c.client;
    counters = c.counters;
    logger = c.logger;
    /* reload the config here */
};

/* Start the monitoring defined in the plugin */
exports.monitor = function() {
    /* start the monitoring here */
};

// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
