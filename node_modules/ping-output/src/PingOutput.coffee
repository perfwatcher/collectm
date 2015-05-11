spawn = require('child_process').spawn
EventEmitter = require('events').EventEmitter

class PingOutput extends EventEmitter
  start: (ip) ->
    @_ping = spawn 'ping', [ip]

    @_ping.stdout.on 'data', (data) =>
      @emit('ping:output', data.toString())

    @_ping.stderr.on 'data', (data) =>
      @emit('ping:output', data.toString())

    @_ping.on 'exit', (code) =>
      @emit('ping:exit_code', code)

  stop: () ->
    @_ping.kill('SIGINT')

module.exports.PingOutput = PingOutput
