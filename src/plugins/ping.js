var collectdClient;
var cfg;
var logger;
var counters;

var p = require('ping-output');
var ping = new p.PingOutput();

var hosts;

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
                if (split[i].indexOf("time<") != -1) {
                    pingData.replies.push(split[i].substring(split[i].search("time<") + "time<".length, split[i].search("ms")));

                    hosts[currentElement].plugin.setGauge('ping', 'droprate', 0);

                    hosts[currentElement].plugin.setGauge('ping', 'average',  parseInt(pingData.replies[pingData.replies.length - 1]));
                }
            }
            //check if it is Reply line
            else if (split[i].match(/Reply\sfrom\s([a-z]|.|\s|=|\d|:)+/)) {
                if (split[i].match(/(Destination host unreachable\.)$/)) {
                    pingData.replies.push(0);

                    hosts[currentElement].plugin.setGauge('ping', 'droprate', 100);

                    hosts[currentElement].plugin.setGauge('ping', 'average', 0);
                } else {
                    if (split[i].indexOf("time=") != -1) {
                        pingData.replies.push(split[i].substring(split[i].search("time=") + "time=".length, split[i].search("ms")));

                        hosts[currentElement].plugin.setGauge('ping', 'droprate', 0);

                        hosts[currentElement].plugin.setGauge('ping', 'average',  parseInt(pingData.replies[pingData.replies.length - 1]));
                    }
                }
            }
            //check if it is Packets: line
            else if (split[i].match(/Packets:([a-z]|.|\s|=|\d|:)+/)) {
                pingData.sent = getNumber(split[i], split[i].search("Sent") + "Sent = ".length);
                pingData.received = getNumber(split[i], split[i].search("Received") + "Received = ".length);
                pingData.lost = getNumber(split[i], split[i].search("Lost") + "Lost = ".length);
                pingData['loss%'] = getNumber(split[i], split[i].search(/\(/) + 1);
                if (pingData['loss%'] == 100) {
                    pingData.finished = true;
                    clearTimeout(stopId);
                }
            }
            //check if it is Statistics line
            else if(split[i].match(/Minimum([a-z]|.|\s|=|\d|:)+/)) {
                pingData.minimum = getNumber(split[i], split[i].search("Minimum") + "Minimum = ".length);
                pingData.maximum = getNumber(split[i], split[i].search("Maximum") + "Maximum = ".length);
                pingData.average = getNumber(split[i], split[i].search("Average") + "Average = ".length);
                pingData.finished = true;
                clearTimeout(stopId);
            }
            //request timed out
            else if(split[i] === "Request timed out.") {
                pingData.replies.push(0);

                hosts[currentElement].plugin.setGauge('ping', 'droprate', 100);

                hosts[currentElement].plugin.setGauge('ping', 'average', 0);
            }
        }
    }
});

ping.on('ping:exit_code', function(code) {
    currentElement = ++currentElement % hosts.length;
    runPings();
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
    }, 30000);
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
		hosts = [];
        for (var hostName in cfg.hosts) {
            if (typeof hostName === 'string' &&
                (hostName.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) || hostName.match(/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/))) {
                if (cfg.hosts[hostName] == 1) {
                    var newHost = {};
                    newHost.host = hostName;
                    hosts.push(newHost);
                    logger.info("Will ping host: " + newHost.host);
                }
            }
            else {
                logger.info("Host: " + hostName + " has syntactic issues!It will not be used");
            }
        }
    }
    initHosts();
    runPings();
};