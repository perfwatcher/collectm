var winston = require('winston');
var path = require('path');
var perfmon = require('perfmon');
var os = require('os');

var prefix = path.join(path.dirname(require.main.filename), '..');
var cpus = os.cpus().length;
var currentLogicalDisks = [];
var currentInterfaces;

var cfg;
var collectdClient;

var avgLoadCounters = [
    '\\processor(_total)\\% processor time',
    '\\System\\Processor Queue Length'
];

var counter_repo = {};

var logger;

function getAvgLoad(num_of_turns, timeframe) {
    //division by zero === 'very bad idea'
    if (counter_repo.turns == 0) {
        return 0.0;
    }
    var actual_turns;
    var length;
    var i;
    var totalLoad;
    var totalProcesses;
    var newestValuePos;
    if (counter_repo.turns < num_of_turns) {
        if (!counter_repo.currentCounters['\\processor(_total)\\% processor time'].hasOwnProperty(timeframe)) {
            counter_repo.currentCounters['\\processor(_total)\\% processor time'][timeframe] = {};
        }
        if (!counter_repo.currentCounters['\\System\\Processor Queue Length'].hasOwnProperty(timeframe)) {
            counter_repo.currentCounters['\\System\\Processor Queue Length'][timeframe] = {};
        }

        actual_turns =  counter_repo.turns;

        if (!counter_repo.currentCounters['\\processor(_total)\\% processor time'][timeframe].hasOwnProperty('earliestValue')) {
            counter_repo.currentCounters['\\processor(_total)\\% processor time'][timeframe]['earliestValue'] =
                counter_repo.currentCounters['\\processor(_total)\\% processor time'].values[0];
            counter_repo.currentCounters['\\processor(_total)\\% processor time'][timeframe]['value'] = 0;
        }

        if (!counter_repo.currentCounters['\\System\\Processor Queue Length'][timeframe].hasOwnProperty('earliestValue')) {
            counter_repo.currentCounters['\\System\\Processor Queue Length'][timeframe]['earliestValue'] =
                counter_repo.currentCounters['\\System\\Processor Queue Length'].values[0];
            counter_repo.currentCounters['\\System\\Processor Queue Length'][timeframe]['value'] = 0;
        }

        //add newest value to already existing sum
        newestValuePos = counter_repo.currentCounters['\\processor(_total)\\% processor time'].values.length - 1;
    }
    else {
        actual_turns = num_of_turns;

        newestValuePos = counter_repo.currentCounters['\\processor(_total)\\% processor time'].values.length - 1;

        //subtracting earliest value of previous sum
        counter_repo.currentCounters['\\processor(_total)\\% processor time'][timeframe]['value'] -=
            counter_repo.currentCounters['\\processor(_total)\\% processor time'][timeframe]['earliestValue'];
        counter_repo.currentCounters['\\System\\Processor Queue Length'][timeframe]['value'] -=
            counter_repo.currentCounters['\\System\\Processor Queue Length'][timeframe]['earliestValue'];
    }

    //adding newest value
    counter_repo.currentCounters['\\processor(_total)\\% processor time'][timeframe]['value'] +=
        counter_repo.currentCounters['\\processor(_total)\\% processor time'].values[newestValuePos];

    counter_repo.currentCounters['\\System\\Processor Queue Length'][timeframe]['value'] +=
        counter_repo.currentCounters['\\System\\Processor Queue Length'].values[newestValuePos];

    if (counter_repo.turns >= num_of_turns) {
        var earliestValuePos = counter_repo.currentCounters['\\processor(_total)\\% processor time'].values.length - num_of_turns;

        //updating earliest value
        counter_repo.currentCounters['\\processor(_total)\\% processor time'][timeframe]['earliestValue'] =
            counter_repo.currentCounters['\\processor(_total)\\% processor time'].values[earliestValuePos];
        counter_repo.currentCounters['\\System\\Processor Queue Length'][timeframe]['earliestValue'] =
            counter_repo.currentCounters['\\System\\Processor Queue Length'].values[earliestValuePos];
    }

    totalLoad = cpus * ((counter_repo.currentCounters['\\processor(_total)\\% processor time'][timeframe]['value'] / actual_turns) / 100);
    totalProcesses = counter_repo.currentCounters['\\System\\Processor Queue Length'][timeframe]['value'] / actual_turns;

    return (totalLoad + totalProcesses);
}

function getUnixLoad() {
    var plugin = collectdClient.plugin('load', '');
    perfmon(avgLoadCounters, function (err, data) {
        for (var i = 0; i < avgLoadCounters.length; i++) {
            if (typeof counter_repo.currentCounters[avgLoadCounters[i]] != 'undefined') {
                counter_repo.currentCounters[avgLoadCounters[i]]["values"].push(data.counters[avgLoadCounters[i]]);
            } else {
                logger.info("Problem with counter: " + avgLoadCounters[i]);
                counter_repo.currentCounters[avgLoadCounters[i]]["values"].push(0);
            }
        }
        counter_repo.turns++;
        var shortterm = parseFloat(getAvgLoad(60, '1m').toFixed(2));
        var midterm = parseFloat(getAvgLoad(300, '5m').toFixed(2));
        var longterm = parseFloat(getAvgLoad(900, '15m').toFixed(2));
        plugin.setGauge('load', '', [shortterm, midterm, longterm]);
    });
}

function initializeCounterRepo() {
    counter_repo.currentCounters = {};
    for (var i = 0; i < avgLoadCounters.length; i++) {
        counter_repo.currentCounters[avgLoadCounters[i]] = {};
        counter_repo.currentCounters[avgLoadCounters[i]]["values"] = [];
        counter_repo.currentCounters[avgLoadCounters[i]]["final_value"] = 0;
    }
    counter_repo.turns = 0;
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
    counters = c.counters;
    logger = c.logger;
    return (0);
};

exports.monitor = function () {
    var default_interval = cfg.interval || collectdClient.interval || 60000;

    initializeCounterRepo();

    getUnixLoad();
};
