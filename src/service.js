/*! CollectM - v1.2.1-20140926 - 2014-09-26 */

var runcmd = require('child_process').execSync;
var path = require('path');
var prefix = path.join(path.dirname(require.main.filename), '..');
var svcpath = prefix;
var nssm_exe = path.join(prefix,'bin','nssm.exe');
var node_exe = path.join(prefix,'bin','node.exe');

if(process.argv[3]) {
	svcpath = process.argv[3];
}

var svc = {
  name:'CollectM',
  description: 'Collectd agent for Windows',
  script: path.join(prefix, 'lib', 'collectm.js')
};

function svc_install() {
    var cmd = '"'+nssm_exe+'" install '+svc.name+' "'+node_exe+'" "\\"'+svc.script+'\\""';
    runcmd(cmd, function (error, stdout, stderr) {
        console.log(stderr);
        console.log(stdout);
    });

    cmd = '"'+nssm_exe+'" set '+svc.name+' Description "'+svc.description+'"';
    runcmd(cmd, function (error, stdout, stderr) {
        console.log(stderr);
        console.log(stdout);
    });
}

function svc_start() {
    var cmd = '"'+nssm_exe+'" start '+svc.name;
    runcmd(cmd, function (error, stdout, stderr) {
        console.log(stderr);
        console.log(stdout);
    });
}

function svc_stop() {
    var cmd = '"'+nssm_exe+'" stop '+svc.name;
    runcmd(cmd, function (error, stdout, stderr) {
        console.log(stderr);
        console.log(stdout);
    });
}

function svc_uninstall() {
    var cmd = '"'+nssm_exe+'" remove '+svc.name+' confirm';
    runcmd(cmd, function (error, stdout, stderr) {
        console.log(stderr);
        console.log(stdout);
    });
}


process.argv.forEach(function(val, index, array) {
  if(index == 2) {
	switch (val) {
		case 'install':
			svc_install();
		break;
		case 'installAndStart':
			svc_install();
			svc_start();
		break;
		case 'uninstall':
			svc_uninstall();
		break;
		case 'stopAndUninstall':
			svc_stop();
			svc_uninstall();
		break;
		case 'start':
			svc_start();
		break;
		case 'stop':
			svc_stop();
		break;
	}
  }
});

if (process.argv.length < 3) {
	console.log('Usage :' + process.argv[0] + ' ' + process.argv[1] + ' [install|installAndStart|uninstall|stopAndUninstall|start|stop]');
}
