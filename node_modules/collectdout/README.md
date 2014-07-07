# Synopsis

Periodically send values out to a [Collectd](http://collectd.org/) server for statistics.

# Installation

```javascript
npm i collectdout
```

# Usage

Spawn a client that sends the data every 60s to myserver:
```javascript
var Collectd = require('collectdout');
var client = new Collectd(60000, "myserver", 25826);
```

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
