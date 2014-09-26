/*! CollectW - v1.2.1-20140926 - 2014-09-26 */

var Service = require('node-windows').Service;
var svcpath = require('path').dirname(require.main.filename);

if(process.argv[3]) {
	svcpath = process.argv[3];
}

var svc = new Service({
  name:'CollectW',
  description: 'Collectd agent for Windows',
  script: svcpath + '\\collectw.js',
  env: {
    name: 'NODE_CONFIG_DIR',
    value: svcpath + '\\config'
  },
  grow: 0,
  wait: 10,
  maxRestarts: 30,
  maxRetries: 3
});

svc.on('install', function() {
  console.log('Service installed.');
  if (process.argv[2] == 'installAndStart') {
	svc.start();
  }
});

svc.on('start', function() {
	console.log('Service started');
});

svc.on('stop', function() {
	console.log('Service stopped');
});

svc.on('uninstall', function() {
  console.log('Service uninstalled.');
  console.log('The service exists: ', svc.exists);
});


svc.on('alreadyinstalled',function(){
  console.log('This service is already installed.');
});

//svc.uninstall();
process.argv.forEach(function(val, index, array) {
  if(index == 2) {
	switch (val) {
		case 'install':
		case 'installAndStart':
			svc.install();
		break;
		case 'uninstall':
			svc.uninstall();
		break;
		case 'stopAndUninstall':
			svc.uninstall();
		break;
		case 'start':
			svc.start();
		break;
		case 'stop':
			svc.stop();
		break;
	}
  }
});

if (process.argv.length < 3) {
	console.log('Usage :' + process.argv[0] + ' ' + process.argv[1] + ' [install|installAndStart|uninstall|stopAndUninstall|start|stop]');
}
