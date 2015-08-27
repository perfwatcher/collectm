# PingOutput

Realtime ping output for node, inherits from EventEmitter.

## Usage

```coffee

p = require('ping-output')

ping = new p.PingOutput()

ping.on 'ping:output', (data) ->
  process.stdout.write data.toString()

ping.start('127.0.0.1')

setTimeout (->
  ping.stop()
), 5000
```

This will ping localhost, send output to stdout and stop after 5 seconds.
