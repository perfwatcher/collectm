var collectdClient;
var cfg;
var logger;
var counters;

var p = require('ping-output');
var ping = new p.PingOutput();

var hosts = [
    {
        host: "8.8.8.8"
    }
];

var pingData;
var stopId;
var currentElement = 0;

ping.on('ping:output', function (data) {
    var i;
    var split = data.toString().split("\n");

    for (i=0 ; i<split.length ; i++) {
        split[i] = split[i].trim();
    }

    for (i=0 ; i<split.length ; i++) {
        if (split[i].length > 0) {
            //check if it is Reply line from 'localhost'
            if (split[i].match(/Reply\sfrom\s::1([a-z]|.|\s|=|\d|:)+/)) {
                pingData.replies.push(split[i].substring(split[i].search("time<") + "time<".length, split[i].search("ms")));
            }
            //check if it is Reply line
            else if (split[i].match(/Reply\sfrom\s([a-z]|.|\s|=|\d|:)+/)) {
                pingData.replies.push(split[i].substring(split[i].search("time=") + "time=".length, split[i].search("ms")));
            }
            //check if it is Packets: line
            else if (split[i].match(/Packets:([a-z]|.|\s|=|\d|:)+/)) {
                pingData.sent = getNumber(split[i], split[i].search("Sent") + "Sent = ".length);
                pingData.received = getNumber(split[i], split[i].search("Received") + "Received = ".length);
                pingData.lost = getNumber(split[i], split[i].search("Lost") + "Lost = ".length);
                pingData['loss%'] = getNumber(split[i], split[i].search(/\(/) + 1);
            }
            //check if it is Statistics line
            else if(split[i].match(/Minimum([a-z]|.|\s|=|\d|:)+/)) {
                pingData.minimum = getNumber(split[i], split[i].search("Minimum") + "Minimum = ".length);
                pingData.maximum = getNumber(split[i], split[i].search("Maximum") + "Maximum = ".length);
                pingData.average = getNumber(split[i], split[i].search("Average") + "Average = ".length);
                pingData.finished = true;
                clearTimeout(stopId);
                hosts[currentElement].plugin.setGauge('ping', 'droprate', pingData['loss%']);
                hosts[currentElement].plugin.setGauge('ping', 'average', pingData['average']);
                currentElement = ++currentElement % hosts.length;
                runPings();
            }
            //request timed out
            else if(split[i].match(/Request\stimed([a-z]|.|\s|=|\d)+/)) {
                pingData.replies.push(-1);
            }
        }
    }
});

function getNumber(str, start) {
    var i;
    var end;
    for (i=start + 1 ; i<str.length ; i++) {
        if (str.charAt(i) == ' ' || str.charAt(i) == ',' || str.charAt(i) == '%' || str.charAt(i) == 'm') {
            end = i;
            break;
        }
    }
    return parseInt(str.substring(start, end));
}

function initHosts() {
    for (var i=0 ; i<hosts.length ; i++) {
        if (hosts[i].host.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) || hosts[i].host.match(/^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/) || hosts[i].host.indexOf(".") != -1) {
            var temp = hosts[i].host;
            while(temp.indexOf(".") != -1) {
                temp = temp.replace(".", "_");
            }
            hosts[i].pluginInstance = temp;
        } else {
            hosts[i].pluginInstance = hosts[i].host;
        }
        hosts[i].plugin = collectdClient.plugin('ping', hosts[i].pluginInstance);
    }
}

function initPingData(host) {
    var pingData = {};
    pingData['host'] = host;
    pingData['replies'] = [];
    pingData['sent'] = 0;
    pingData['received'] = 0;
    pingData['lost'] = 0;
    pingData['loss%'] = 100;
    pingData['minimum'] = 0;
    pingData['maximum'] = 0;
    pingData['average'] = 0;
    pingData['finished'] = false;
    return pingData;
}

function runPings() {
    pingData = initPingData(hosts[currentElement].host);
    ping.start(pingData.host);
    stopId = setTimeout(function() {
        ping.stop();
        currentElement = ++currentElement % hosts.length;
    }, 5000);
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
    if (typeof cfg.hosts !== 'undefined') {
        for (var i=0 ; i<cfg.hosts.length ; i++) {
            var newHost = {};
            newHost.host = cfg.hosts[i];
            hosts.push(newHost);
        }
    }
    initHosts();
    runPings();
};