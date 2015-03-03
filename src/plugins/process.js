
/* This is an example of a CollectM plugin */

/* Load some utilities */
var cu = require('../lib/collectm_utils.js');
var spawn = require('child_process').spawn;
var util = require('util');

var logger;
var counters;
var client;
var cfg;

var gwmi_filter = '';
var process_list;
var gwmi_is_running = 0;

var currentProcess = { metrics:{}, data:{} };
var process_info = [];

var each = function(obj, block) { // {{{
  var attr;
  for(attr in obj) {
    if(obj.hasOwnProperty(attr))
      block(attr, obj[attr]);
  }
}; // }}}

var parseData = function (str, flush) {
    var line;
    var n;
    var pos;
    var process_line_metrics_regex = /([A-Za-z0-9_]+) *: ([0-9]+)/;
    var process_line_data_regex = /([A-Za-z0-9_]+) *: (.*)/;
    var match;
    
    line = str.split('\r\n');
    n = line.length;

    if(n === 0) {
        return(str);
    }
    if(!flush) {
        n -= 1;
    }

    if(n > 0) {
        for(i=0; i<n; i++) {
            line[i] = line[i].replace(/\r?\n|\r/g, '');
            if(line[i] === '') {
                if(Object.keys(currentProcess.metrics).length > 0) {
                    process_info.push(currentProcess);
                }
                currentProcess = { metrics:{}, data:{} };
            } else {
                if(null !== (match = process_line_metrics_regex.exec(line[i]))) {
                        currentProcess.metrics[match[1]] = match[2];
                } else if(null !== (match = process_line_data_regex.exec(line[i]))) {
                        currentProcess.data[match[1]] = match[2];
                }
            }
        }
    }
    if(flush) {
        if(currentProcess.length > 0) {
            if(Object.keys(currentProcess.metrics).length > 0) {
                process_info.push(currentProcess);
            }
            currentProcess = { metrics:{}, data:{} };
        }
        return('');
    }
    return(line[n]);
};

function processProcesses() {
    console.log('info', 'PROCESS '+util.inspect(process_info.length, { showHidden: true, depth: null}));
    if(process_info.length <= 0) return;

    each(process_info, function(i,p) {
        console.dir(p);
    });

    process_info = [];
}

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
    var processCfg;
    cfg = c.config;
    client = c.client;
    counters = c.counters;
    logger = c.logger;
    /* reload the config here */

    processCfg = cfg.hasOwnProperty('process') ? cfg.process : [];
    process_list = {};
    gwmi_filter = '';

    each(processCfg, function(i, p) {
        var k;

        if(p.hasOwnProperty('plugin') && p.hasOwnProperty('instance') && (p.hasOwnProperty('commandline'))) {
            k = p.plugin+'-'+p.instance;
            process_list[k] = { 'commandline': p.commandline };
            if(gwmi_filter !== '') {
                    gwmi_filter = gwmi_filter + ' -or ';
            }
            gwmi_filter = gwmi_filter + '$_.commandline -match \'' + p.commandline + '\'';
        }
    });
};

/* Start the monitoring defined in the plugin */
exports.monitor = function() {
    /* start the monitoring here */
    var default_interval = cfg.interval || client.interval || 60000;

    var gwmi;
    var prevLine = '';

    if(gwmi_filter === '') return;
    if(gwmi_is_running) return;

    logger.log('info', 'Running process');
    gwmi_is_running = 1;

    currentProcess = { metrics:{}, data:{} };
    process_info = [];

    logger.log('info', 'FILTER : '+gwmi_filter);
    gwmi = spawn('Powershell.exe', [ '-Command', ' &{gwmi -Class win32_process | ?{ ' + gwmi_filter + ' } } ' ]);
    gwmi.stdin.end();
    
    gwmi.stdout.on('data', function (data) {
        prevLine = parseData(prevLine + data.toString(), 0);
    });

    gwmi.stdout.on('end', function () { prevLine = parseData(prevLine, 1); processProcesses(); gwmi_is_running = 0; });
    gwmi.stdout.on('close', function () { prevLine = parseData(prevLine, 1); processProcesses(); gwmi_is_running = 0; });
    gwmi.stdout.on('error', function () { prevLine = parseData(prevLine, 1); processProcesses(); gwmi_is_running = 0; });

    gwmi.stderr.on('data', function (data) {
            logger.log('error', data.toString());
            });

    gwmi.on('close', function (code) { prevLine = parseData(prevLine, 1); processProcesses(); gwmi_is_running = 0; });
    gwmi.on('exit', function (code) { prevLine = parseData(prevLine, 1); processProcesses(); gwmi_is_running = 0;  });
    gwmi.on('error', function (code) { prevLine = parseData(prevLine, 1); processProcesses(); gwmi.kill(); gwmi_is_running = 0; });

};

// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
