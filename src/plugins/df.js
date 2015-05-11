var path = require('path');
var perfmon = require('perfmon');
var os = require('os');

var prefix = path.join(path.dirname(require.main.filename), '..');

var cfg;
var collectdClient;
var previousTotal;

var currentLogicalDisks = [];

var failedAttempts = 0;

var countersPerDisk = [
    '% Free Space',
    'Free Megabytes'
];

var counterRepo = {};
counterRepo.disks = {};

var counters = [];

//get the letter of disk the counter is for e.g C
function getLetterOfCounter(counter) {
    var start;
    var end;
    for (var i = counter.length - 1 ; i >= 0 ; i--) {
        if (counter.charAt(i) == '(') {
            start = i + 1;
            break;
        } else if (counter.charAt(i) == ')') {
            end = i;
            if (counter.charAt(i - 1) == ':') {
                end--;
            }
        }
    }
    return counter.substring(start, end);
}
//get the type of counter e.g. Disk Read Bytes/sec
function getTypeOfCounter(counter) {
    var start;
    var end = counter.length;
    for (var i = counter.length - 1 ; i >= 0 ; i--) {
        if (counter.charAt(i) == '\\') {
            start = i + 1;
            break;
        }
    }
    return counter.substring(start, end);
}
//add the hardcoded letters and the disk letters given by the configuration to the counters
function initializeDiskLetters(disks) {
    for (var diskLetter in disks) {
        if (typeof diskLetter === 'string' && (diskLetter.match(/^([a-z])$/i) || diskLetter.match(/^(total|_total)$/i)) && disks[diskLetter] == 1) {
            if (diskLetter.match(/^([a-z])$/)) {
                diskLetter = diskLetter.toUpperCase();
            } else if (diskLetter.match(/^(total|_total|Total)$/i)){
                diskLetter = '_Total';
            }
            if (currentLogicalDisks.indexOf(diskLetter) == -1) {
                currentLogicalDisks.push(diskLetter);
                addDiskCounters(diskLetter);
            }
        }
        else {
            logger.info('Df not monitoring ' + diskLetter);
        }
    }
}
//find all the disks currently on the system
function discoverDisks(forceMonitor) {
    perfmon.list('logicaldisk', function (err, data) {
        if (typeof data == 'undefined' || typeof data.counters == 'undefined') {
            logger.info('Data.counters is undefined. Trying again.');
            discoverDisks();
        } else {
            var list = data.counters;
            var i;
            var diskLetter;
            var foundNewDisks = false;
            for (i = 0; i < list.length; i++) {
                if (/logicaldisk\([A-Z]:\)\\%\sFree\sSpace/.test(list[i]) === true) {
                    diskLetter = list[i].charAt(12);
                    if (currentLogicalDisks.indexOf(diskLetter) == -1) {
                        currentLogicalDisks.push(diskLetter);
                        addDiskCounters(diskLetter);
                        foundNewDisks = true;
                    }
                }
            }
            if (forceMonitor === true || foundNewDisks === true) {
                startMonitoring();
            }
        }
    });
}
//for each disk letter initialize the appropriate fields
function addDiskCounters(diskLetter) {
    logger.info('Df plugin monitoring: ' + diskLetter);
    var i;
    var newCounter;
    for(i in countersPerDisk) {
        newCounter = '\\LogicalDisk(' + diskLetter + ((diskLetter !== '_Total') ? ':)' : ')') + '\\' + countersPerDisk[i];
        counters.push(newCounter);
    }
    counterRepo.disks[diskLetter] = {};
    counterRepo.disks[diskLetter].pluginInstance = collectdClient.plugin('df', (diskLetter == '_Total') ? 'total' : diskLetter);
    counterRepo.disks[diskLetter].free = 0;
    counterRepo.disks[diskLetter]['free%'] = 0;
    counterRepo.disks[diskLetter].used = 0;
    counterRepo.disks[diskLetter].reserved = 0;
    counterRepo.disks[diskLetter].total = 0;
}
//gets the values returned from perfmon and sets them in the repo
function startMonitoring() {
    if (counters.length === 0) {
        return;
    }
    perfmon(counters, function(err, data) {
        if (typeof data !== 'undefined' && typeof data.counters !== 'undefined') {
            for (var counter in data.counters) {
                var diskLetter = getLetterOfCounter(counter);
                var type = getTypeOfCounter(counter);
                if (type == '% Free Space') {
                    counterRepo.disks[diskLetter]['free%'] = parseInt(data.counters[counter]);
                } else if (type == 'Free Megabytes') {
                    counterRepo.disks[diskLetter].free = parseInt(data.counters[counter]) / 1024;
                }
            }
            failedAttempts = 0;
            flushValues();
        } else {
            logger.info('No values returned to df plugin');
            failedAttempts++;
            if (failedAttempts == 10) {
                logger.info('It is the 10th failed attempt to get metrics for df. Restarting perfmon.');
                perfmon.stop();
                failedAttempts = 0;
                setTimeout(startMonitoring, 1000);
            }
        }
    });
}
//sends the values to the collectd client
function flushValues() {
    for(var diskLetter in counterRepo.disks) {
        if (counterRepo.disks[diskLetter].free !== 0 && counterRepo.disks[diskLetter]['free%'] !== 0) {
            counterRepo.disks[diskLetter].used = (100 - counterRepo.disks[diskLetter]['free%']) * (counterRepo.disks[diskLetter].free / counterRepo.disks[diskLetter]['free%']);
            counterRepo.disks[diskLetter].pluginInstance.setGauge('df_complex', 'reserved', 0 );
            counterRepo.disks[diskLetter].pluginInstance.setGauge('df_complex', 'free', counterRepo.disks[diskLetter].free);
            counterRepo.disks[diskLetter].pluginInstance.setGauge('df_complex', 'used', counterRepo.disks[diskLetter].used);
            var new_total = 100 * (counterRepo.disks[diskLetter].free / counterRepo.disks[diskLetter]['free%']);
            if (counterRepo.disks[diskLetter].total === 0) {
                counterRepo.disks[diskLetter].total = new_total;
            } else if (new_total - counterRepo.disks[diskLetter].total  > 1 || new_total - counterRepo.disks[diskLetter].total < -1) {
                counterRepo.disks[diskLetter].total = new_total;
            }
        } else if (counterRepo.disks[diskLetter].free !== 0 && counterRepo.disks[diskLetter]['free%'] === 0) {
            counterRepo.disks[diskLetter].pluginInstance.setGauge('df_complex', 'reserved', 0);
            counterRepo.disks[diskLetter].pluginInstance.setGauge('df_complex', 'free', 0);
            counterRepo.disks[diskLetter].pluginInstance.setGauge('df_complex', 'used', counterRepo.disks[diskLetter].total);
        }
    }
}

exports.configShow = function () {
    return ({});
};

exports.reInit = function () {
    return (0);
};

exports.reloadConfig = function (c) {
    collectdClient = c.client;
    cfg = c.config;
    logger = c.logger;
    return (0);
};

exports.monitor = function () {
    var default_interval = cfg.interval || collectdClient.interval || 60000;
    if (typeof cfg.disks !== 'undefined') {
        initializeDiskLetters(cfg.disks);
    }
    if (typeof cfg.autodiscover == 'undefined' || cfg.autodiscover == 1) {
        discoverDisks(true);
        setInterval(function () { discoverDisks(false); }, default_interval);
        logger.info('Autodiscover is turned on for df plugin.');
    } else {
        logger.info('Autodiscover is turned off for df plugin.');
        startMonitoring();
    }
};
