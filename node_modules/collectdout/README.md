# Synopsis

Periodically send values out to a [Collectd](http://collectd.org/) server for statistics.

This piece of code has been sponsored by [Superfeedr](http://superfeedr.com/). They are awesome and you should really consider their service if you process RSS feeds!

# Installation

```javascript
npm i collectdout
```

# Usage

Spawn a client that sends the data every 60s to myserver:
```javascript
var Collectd = require('collectdout');
var client = new Collectd(60000, "collectd_server", 25826, "my_server");
```
Fourth argument is optional, default is os.hostname()

Create your plugin instance:
```javascript
var plugin = client.plugin('myapp', 'worker13');
```

Set gauges, they are averaged within a sampling period:
```javascript
plugin.setGauge('users', 'total', 23);
plugin.setGauge('load', '0', [1.0, 0.85, 0.7]);
```

Manipulate counters:
```javascript
plugin.setCounter('if_octets', 'eth0', [0, 0]);
plugin.addCounter('uptime', '0', 1);
```

# Change log
- v0.0.6
  * Possibility to send notification
- v0.0.5
  * Add this changelog
  * Possibility to send data to more than one server
- v0.0.4
  * Fix interval issue
  * Add optionnal parameter to set hostname
- v0.0.3
  * Fix multiple value sending
