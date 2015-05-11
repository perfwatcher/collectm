var path = require('path');
var perfmon = require('perfmon');
var os = require('os');

var prefix = path.join(path.dirname(require.main.filename), '..');

var cfg;
var collectdClient;

var currentLogicalDisks = [];

var failedAttempts = 0;

var countersPerDisk = [
    '% Disk Read Time',
    '% Disk Write Time',
    'Disk Read Bytes/sec',
    'Disk Write Bytes/sec',
    'Disk Reads/sec',
    'Disk Writes/sec'
];

var collectdMetrics = [
    'disk_octets',
    'disk_time',
    'disk_ops'
];

var collectdMetricsMap = {};
collectdMetricsMap['Disk Read Bytes/sec'] = 'disk_octets';
collectdMetricsMap['Disk Write Bytes/sec'] = 'disk_octets';
collectdMetricsMap['% Disk Read Time'] = 'disk_time';
collectdMetricsMap['% Disk Write Time'] = 'disk_time';
collectdMetricsMap['Disk Reads/sec'] = 'disk_ops';
collectdMetricsMap['Disk Writes/sec'] = 'disk_ops';

var counterTypeToFieldMap = {};
counterTypeToFieldMap['Disk Read Bytes/sec'] = 'read';
counterTypeToFieldMap['Disk Write Bytes/sec'] = 'write';
counterTypeToFieldMap['% Disk Read Time'] = 'read';
counterTypeToFieldMap['% Disk Write Time'] = 'write';
counterTypeToFieldMap['Disk Reads/sec'] = 'read';
counterTypeToFieldMap['Disk Writes/sec'] = 'write';

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
    logger.info('Disk plugin monitoring: ' + diskLetter);
    var i;
    var newCounter;
    for(i in countersPerDisk) {
        newCounter = '\\LogicalDisk(' + diskLetter + ((diskLetter !== '_Total') ? ':)' : ')') + '\\' + countersPerDisk[i];
        counters.push(newCounter);
    }
    counterRepo.disks[diskLetter] = {};
    counterRepo.disks[diskLetter].pluginInstance = collectdClient.plugin('disk', (diskLetter == '_Total') ? 'total' : diskLetter);
    for (i in collectdMetrics) {
        counterRepo.disks[diskLetter][collectdMetrics[i]] = {};
        counterRepo.disks[diskLetter][collectdMetrics[i]].read = 0;
        counterRepo.disks[diskLetter][collectdMetrics[i]].write = 0;
    }
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
                var collectdMetric = collectdMetricsMap[type];
                var readOrWrite = counterTypeToFieldMap[type];
                counterRepo.disks[diskLetter][collectdMetric][readOrWrite] = data.counters[counter];
            }
            failedAttempts = 0;
            flushValues();
        } else {
            logger.info('No values returned to disk plugin');
            failedAttempts++;
            if (failedAttempts == 10) {
                logger.info('It is the 10th failed attempt to get metrics for disks. Restarting perfmon.');
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
        for (var i in collectdMetrics) {
            var collectdMetric = collectdMetrics[i];
            var read = counterRepo.disks[diskLetter][collectdMetric].read;
            var write = counterRepo.disks[diskLetter][collectdMetric].write;
            counterRepo.disks[diskLetter].pluginInstance.addCounter(collectdMetric, '', [read, write]);
            counterRepo.disks[diskLetter][collectdMetric].read = 0;
            counterRepo.disks[diskLetter][collectdMetric].write = 0;
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
        logger.info('Autodiscover is turned on for disk plugin.');
    } else {
        logger.info('Autodiscover is turned off for disk plugin.');
        startMonitoring();
    }
};
