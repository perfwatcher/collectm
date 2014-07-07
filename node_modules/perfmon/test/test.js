// todo: switch to vows
var perfmon = require('../perfmon');
var assert = require('assert');

var cpu = 'processor(_total)\\% processor time'
var mem = 'memory\\Committed Bytes';

perfmon.list('processor', function(err, data) {
	assert.ok(data);
	console.log('SUCCESS: List processor counters');
});

perfmon('badcounter', function(err, data) {
	// console.log('badcounter', (err) ? 'error' : 'success', err || data);
	assert.ok(err);
	console.log('SUCCESS: Invalid counter test');
});

perfmon([cpu, mem], function(err, data) {
	// console.log('cpu AND mem', (err) ? 'error' : 'success', err || data);
	assert.ok(data);
	console.log('SUCCESS: CPU and Memory counters');
	perfmon.stop();
});
