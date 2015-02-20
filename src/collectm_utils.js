
exports.collectd_sanitize = function (name) {
    return name.replace(/[ -\/\(\)]/g, '_');
};

exports.collectd_log_init = function(prefix) {
    var path = require('path');
    var fs = require('fs');
    fs.mkdir(path.join(prefix, 'logs'));

    var stdoutFile = path.join(prefix,'logs', 'stdout.log');
    var stderrFile = path.join(prefix,'logs', 'stderr.log');


    //create a new stdout file stream
    var stdoutFS = fs.createWriteStream(stdoutFile, {
        encoding: 'utf8',
        flags   : 'a+'
    });

    //create a new stderr file stream
    var stderrFS = fs.createWriteStream(stderrFile, {
        encoding: 'utf8',
        flags   : 'a+'
    });

    //pipe stdout to a worker file
    var unhookStdout = hookWriteStream(process.stdout, function(string, encoding, fd) {
        stdoutFS.write(string, encoding || 'utf8');
    });

    //pipe stderr to a worker file
    var unhookStderr = hookWriteStream(process.stderr, function(string, encoding, fd) {
        stderrFS.write(string, encoding || 'utf8');
    });

    //unhook when things go wrong
    stdoutFS.once('close', function() {
        unhookStdout();
    });
    stdoutFS.once('error', function(err) {
        unhookStdout();
        console.error('Error: Unhooked stdout due to error %j.', err);
    });
    stderrFS.once('close', function() {
        unhookStderr();
        console.log('Unhooked stderr.');
    });
    stderrFS.once('error', function(err) {
        unhookStderr();
        console.error('Error: Unhooked stderr due to error %j.', err);
    });


    function hookWriteStream(stream, callback) {
        var oldWrite = stream.write;

        stream.write = (function(write) {
            return function(string, encoding, fd) {
                write.apply(stream, arguments);
                callback(string, encoding, fd);
            };
        })(stream.write);

        return function() {
            stream.write = oldWrite;
        };
    }
};


// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
