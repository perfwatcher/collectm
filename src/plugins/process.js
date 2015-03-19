
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
var check_lock = 0; /* 0=free, 1=gwmi running 2=processing data */

var currentProcess = { metrics:{}, data:{} };
var process_info = [];

var each = function(obj, block) { // {{{
  var attr;
  for(attr in obj) {
    if(obj.hasOwnProperty(attr))
      block(attr, obj[attr]);
  }
}; // }}}

function parseData(str, flush) {  // {{{
    var line;
    var n;
    var pos;
    var process_line_metrics_regex = /([A-Za-z0-9_]+) *: ([0-9]+)/;
    var process_line_id_regex = /([A-Za-z0-9_]+[Ii][Dd]) *: (.*)/;
    var process_line_version_regex = /([A-Za-z0-9_]+[Vv][Ee][Rr][Ss][Ii][Oo][Nn]) *: (.*)/;
    var process_line_data_regex = /([A-Za-z0-9_]+) *: (.*)/;
    var objects_not_metrics = {
            '__GENUS' : 1,
            '__PROPERTY_COUNT': 1,
            'CreationDate': 1
            };
    var match;

    if(str === null) {
        return(null);
    }
    
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
                if(null !== (match = process_line_id_regex.exec(line[i]))) {
                        currentProcess.data[match[1]] = match[2];
                } else if(null !== (match = process_line_version_regex.exec(line[i]))) {
                        currentProcess.data[match[1]] = match[2];
                } else if(null !== (match = process_line_metrics_regex.exec(line[i]))) {
                    if(objects_not_metrics[match[1]]) {
                        currentProcess.data[match[1]] = match[2];
                    } else {
                        currentProcess.metrics[match[1]] = match[2];
                    }
                } else if(null !== (match = process_line_data_regex.exec(line[i]))) {
                        currentProcess.data[match[1]] = match[2];
                }
            }
            match = null;
        }
    }
    if(flush) {
        if(currentProcess.length > 0) {
            if(Object.keys(currentProcess.metrics).length > 0) {
                process_info.push(currentProcess);
            }
        }
        currentProcess = { metrics:{}, data:{} };
        return('');
    }
    return(line[n]);
} // }}}

function processProcesses(ev) {
    var pm = {};
//    logger.log('info', 'Event : '+util.inspect(ev, { showHidden: true, depth: null}));
    if(check_lock != 1) return;

    check_lock = 2;
//    logger.log('info', 'PROCESS '+util.inspect(process_info.length, { showHidden: true, depth: null}));
    if(process_info.length <= 0) {
        check_lock = 0;
        return;
    }

    each(process_list, function(p_pi, p_info) {
        each(process_info, function(i,p) {
            if(p_info.commandline_re.test(p.data.CommandLine)) {
                if(pm.hasOwnProperty(p_pi)) {
                    pm[p_pi].valid=0;
                    logger.log('warn', 'Found more than one process matching "'+p_info.commandline+'". No metric will be recorded for "'+p_pi+'".');
                } else {
                    pm[p_pi] = { 'metrics': p.metrics, 'valid': 1}; 
                }
            }
        });

    });

    each(pm, function(p_pi, data) {
        if(data.valid) {
            each(data.metrics, function(k, v) {
                var ti = cu.collectd_sanitize(k);
//                logger.log('info', 'DEBUG : '+p_pi+'/gauge-'+ti+' = '+v);
                process_list[p_pi].client.setGauge('gauge', ti, v);
            });
        }
    });

    /* Free the process info */
    process_info = [];
    check_lock = 0;

}

function checkOnce() { // {{{
    var gwmi;
    var prevLine = '';
    var setconsolesize = '$b = $host.UI.RawUI.BufferSize; $b.width=32000; $b.height=200; $host.UI.RawUI.BufferSize = $b;';

    if(gwmi_filter === '') return;
    if(check_lock) return;

//    logger.log('info', 'Running process');
    check_lock = 1;

    currentProcess = { metrics:{}, data:{} };
    process_info = [];

//    logger.log('info', 'FILTER : '+gwmi_filter);
    gwmi = spawn('Powershell.exe', [ '-Command', ' &{ ' + setconsolesize + ' gwmi -Class win32_process | ?{ ' + gwmi_filter + ' } | ?{ $_.ConvertToDateTime($_.CreationDate) -lt (Get-Date).addSeconds(-30) }} ' ]);
    gwmi.stdin.end();
    
    gwmi.stdout.on('data', function (data) {
        prevLine = parseData(prevLine + data.toString(), 0);
    });

    gwmi.stdout.on('end', function () { parseData(prevLine, 1); prevLine = null; processProcesses('stdout/end'); check_lock = 0; });
    gwmi.stdout.on('close', function () { parseData(prevLine, 1); prevLine = null; processProcesses('stdout/close'); check_lock = 0; });
    gwmi.stdout.on('error', function () { parseData(prevLine, 1); prevLine = null; processProcesses('stdout/error'); gwmi.kill(); check_lock = 0; });

    gwmi.stderr.on('data', function (data) {
            logger.log('error', data.toString());
            });

    gwmi.on('close', function (code) { parseData(prevLine, 1); prevLine = null; processProcesses('close'); check_lock = 0; });
    gwmi.on('exit', function (code) { parseData(prevLine, 1); prevLine = null; processProcesses('exit'); check_lock = 0;  });
    gwmi.on('error', function (code) { parseData(prevLine, 1); prevLine = null; processProcesses('error'); gwmi.kill(); check_lock = 0; });

} // }}}

/* configShow : returns the current configuration.
 * Note : JSON.stringify( configShow ) should be exportable "as is" to the configuration file.
 */
exports.configShow = function() { // {{{
    return({});
}; // }}}

/* reInit : clean and initialize the plugin */
exports.reInit = function() { // {{{
    /* reinitialize the plugin here */
    process_list = {};
    return(0);
}; // }}}

/* reloadConfig : clean and reload the configuration */
exports.reloadConfig = function(c) { // {{{
    var processCfg;
    var rc = 0;
    cfg = c.config;
    client = c.client;
    counters = c.counters;
    logger = c.logger;
    /* reload the config here */

    processCfg = cfg.hasOwnProperty('process') ? cfg.process : [];
    gwmi_filter = '';

    each(processCfg, function(i, p) {
        var k;

        if(p.hasOwnProperty('plugin') && p.hasOwnProperty('instance') && (p.hasOwnProperty('commandline'))) {
            k = p.plugin+'-'+p.instance;
            if(process_list.hasOwnProperty(k)) {
                    logger.log('error', 'Plugin instance defined twice ('+k+').');
                    rc = 1;
                    return;
            }
            process_list[k] = { 'commandline': p.commandline, 'commandline_re': new RegExp(p.commandline), 'p': p.plugin, 'pi': p.instance };
            if(gwmi_filter !== '') {
                    gwmi_filter = gwmi_filter + ' -or ';
            }
            gwmi_filter = gwmi_filter + '$_.commandline -match \'' + p.commandline + '\'';
        }
    });
    if(rc) return(rc);

    each(process_list, function(p_pi, p_info) {
        process_list[p_pi].client = client.plugin(process_list[p_pi].p, process_list[p_pi].pi);
    });
    return(rc);
}; // }}}

/* Start the monitoring defined in the plugin */
exports.monitor = function() { // {{{
    /* start the monitoring here */
    var default_interval = cfg.interval || client.interval || 60000;

    checkOnce();
    setInterval(checkOnce, default_interval);
}; // }}}

// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
