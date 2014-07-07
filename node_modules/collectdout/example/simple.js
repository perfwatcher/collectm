var Collectd = require('../lib');

var plugin = new Collectd().plugin('collectd_out', 'test');
setInterval(function() {
    plugin.setGauge('users', 'fun', 42 + Math.sin(new Date().getTime() / 60000) * 23.5);
    plugin.setGauge('load', '0', [1.0, 0.85, 0.7]);
    plugin.addCounter('cpu', 'time', 1);
    plugin.addCounter('if_octets', 'tap0', [3 * 1024 * 1024, (2 + Math.sin(new Date().getTime() / 60000) * 42) * 1024 * 1024]);
}, 1000);

