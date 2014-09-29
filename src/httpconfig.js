
var process = require('process');
var md5 = require('MD5');
var os = require('os');
var express = require('express');
var basicAuth = require('connect-basic-auth');
var bodyParser = require('body-parser');
var fs = require('fs');

var httpcfg = {
    cfg: undefined,
    path: undefined,
    configDir: undefined,
    collectwVersion: undefined,
    collectwHTTPUser: undefined,
    collectwHTTPPassword: undefined,
    plugins: undefined
};

function cw_config_write() {
    var failed = 0;
    var outputFilename;
    var hostname;
    var d = new Date();
    var oldFilename;
    var outputObj = {
        'HostnameCase': httpcfg.cfg.get('HostnameCase'),

        'HttpConfig': {
            'enable': httpcfg.cfg.get('HttpConfig.enable'),
            'listenPort': httpcfg.cfg.get('HttpConfig.listenPort'),
            'login': httpcfg.cfg.get('HttpConfig.login'),
            'password': httpcfg.cfg.get('HttpConfig.password'),
        }
    };
    if(httpcfg.cfg.has('Hostname')) {
        outputObj.Hostname = httpcfg.cfg.get('Hostname');
    }

    hostname = os.hostname();
    hostname = hostname ? hostname.split('.')[0] : 'localhost';
    outputFilename = httpcfg.configDir + '/' + hostname + '.json';
    oldFilename = outputFilename + '-' 
        + ('0'+d.getFullYear()).slice(-4)
        + ('0'+(d.getMonth()+1)).slice(-2)
        + ('0'+d.getDate()).slice(-2)
        + '_'
        + ('0'+d.getHours()).slice(-2)
        + ('0'+d.getMinutes()).slice(-2)
        + ('0'+d.getSeconds()).slice(-2)
        ;
    
    fs.rename(outputFilename, oldFilename, function(err) {
        fs.writeFile(outputFilename, JSON.stringify(outputObj), function(err) {
            if(err) failed = 1;
        });
    });
    return(failed);
}

function cw_config_update(newcfg) {
    if(newcfg) {
        httpcfg.cfg.util.extendDeep(httpcfg.cfg, newcfg);
    }
}

exports.start = function() {
    var app = express();
    app.use(bodyParser.urlencoded({extended: true}));
    
    app.use(basicAuth(function(credentials, req, res, next) {
        if (credentials.username != httpcfg.collectwHTTPUser || md5(credentials.password) != httpcfg.collectwHTTPPassword) {
            res.statusCode = 401;
            res.json({error: 'Invalid credential'});
        } else { next(); }
    }, 'Please enter your credentials.'));
    
    app.all('*', function(req, res, next) {
      req.requireAuthorization(req, res, next);
    });
    
    app.get('/', function(req, res) {
        res.set('Content-Type', 'text/html');
        res.send(fs.readFileSync(httpcfg.path + '\\frontend\\index.html'));
    });
    
    app.get('/jquery-2.1.1.min.js', function(req, res) {
        res.set('Content-Type', 'application/javascript');
        res.send(fs.readFileSync(httpcfg.path + '\\frontend\\jquery-2.1.1.min.js'));
    });
    
    app.get('/collectw.css', function(req, res) {
        res.set('Content-Type', 'text/css');
        res.send(fs.readFileSync(httpcfg.path + '\\frontend\\collectw.css'));
    });
    
    app.get('/version', function(req, res) {
        res.set('Content-Type', 'application/json');
        res.json({ version: httpcfg.collectwVersion    });
    });
    
    app.get('/show_config', function(req, res) {
        res.set('Content-Type', 'application/json');
        res.json({ 'config': httpcfg.cfg });
    });
    
    app.get('/collectw_pid', function(req, res) {
        res.set('Content-Type', 'application/json');
        res.json({ collectw_pid: process.pid    });
    });
    
    app.get('/collectd_network', function(req, res) {
        var netconf = [];
        var servers = httpcfg.cfg.get('Network.servers') || [];
        for (var i in servers) {
            netconf[netconf.length] = { 'host': servers[i].hostname, 'port': servers[i].port };
        }
        
        res.set('Content-Type', 'application/json');
        res.json(netconf);
    });
    
    app.post('/process/stop', function(req, res) {
        res.set('Content-Type', 'application/json');
        process.exit();
    });
    
    app.get('/httpconfig/port', function(req, res) {
        res.set('Content-Type', 'application/json');
        res.json({ collectwHTTPPort: (httpcfg.cfg.get('HttpConfig.listenPort') || 25826) });
    });
    
    app.post('/httpconfig/port', function(req, res) {
        var port = 25826;
        res.set('Content-Type', 'application/json');
        if((typeof req.body.port != 'undefined') && (req.body.port !== '')) {
            port = parseInt(req.body.port);
            cw_config_update({ 'HttpConfig': {'listenPort' : port}});
            cw_config_write();
            res.json({message: 'Host and port updated. Will take effect on next start'});
        } else {
            res.json({error: 'Host and port not updated'});
        }
    });
    
    app.post('/httpconfig/account', function(req, res) {
        res.set('Content-Type', 'application/json');
        if(        typeof req.body.user != 'undefined'
            &&    typeof req.body.password != 'undefined' 
            &&    req.body.user !== ''
            &&    req.body.password !== ''
        ) {
            httpcfg.collectwHTTPUser = req.body.user;
            httpcfg.collectwHTTPPassword = md5(req.body.password);
            cw_config_update({ 'HttpConfig': {'login' : httpcfg.collectwHTTPUser }});
            cw_config_update({ 'HttpConfig': {'password' : req.body.password}});
            cw_config_write();
            res.json({message: 'User and password updated'});
        } else {
            res.json({error: 'User and password not updated'});
        }
    });

    app.get('/plugin/perfmon/counters', function(req, res) {
        var i;
        var txt = '';
        var get_perfmon;
        var pc;

        res.set('Content-Type', 'application/json');

        if(httpcfg.plugins.perfmon) {
            pc = httpcfg.plugins.perfmon.configShow();
            // Ugly thing cause a strange bug with res.send(...);
            for (i in pc) {
                if(pc[i].enable) {
                    txt += ', ' + JSON.stringify(pc[i]);
                }
            }
            res.send('[' + txt.substr(1) + ']');
        } else {
            res.send('Perfmon plugin not loaded');
        }
    });
    

    var server = app.listen(httpcfg.cfg.get('HttpConfig.listenPort') || 25826);
};

exports.init = function(c) {
    httpcfg.cfg = c.cfg;
    httpcfg.path = c.path;
    httpcfg.configDir = c.configDir;
    httpcfg.collectwVersion = c.collectwVersion;
    httpcfg.collectwHTTPUser = httpcfg.cfg.get('HttpConfig.login');
    httpcfg.collectwHTTPPassword = md5(httpcfg.cfg.get('HttpConfig.password'));
    httpcfg.plugins = c.plugins;
};

    


// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
