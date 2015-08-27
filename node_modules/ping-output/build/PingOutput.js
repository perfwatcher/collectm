(function() {
  var EventEmitter, PingOutput, spawn,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  spawn = require('child_process').spawn;

  EventEmitter = require('events').EventEmitter;

  PingOutput = (function(_super) {
    __extends(PingOutput, _super);

    function PingOutput() {
      return PingOutput.__super__.constructor.apply(this, arguments);
    }

    PingOutput.prototype.start = function(ip) {
      this._ping = spawn('ping', [ip]);
      this._ping.stdout.on('data', (function(_this) {
        return function(data) {
          return _this.emit('ping:output', data.toString());
        };
      })(this));
      this._ping.stderr.on('data', (function(_this) {
        return function(data) {
          return _this.emit('ping:output', data.toString());
        };
      })(this));
      return this._ping.on('exit', (function(_this) {
        return function(code) {
          return _this.emit('ping:exit_code', code);
        };
      })(this));
    };

    PingOutput.prototype.stop = function() {
      return this._ping.kill('SIGINT');
    };

    return PingOutput;

  })(EventEmitter);

  module.exports.PingOutput = PingOutput;

}).call(this);
