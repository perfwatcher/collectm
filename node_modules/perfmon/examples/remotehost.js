var perfmon = require('perfmon');
var cpu = '\\processor(_total)\\% processor time';
var mem = '\\Memory\\Available bytes';

// single machine
perfmon(
	cpu, 
	'someothermachine.local', 
	function(err, data) {
		console.log(err || data);	
	}
);

// multiple machines
perfmon(
	cpu, 
	['someothermachine.local', 'anothermachine.local'], 
	function(err, data) {
		console.log(err || data);	
	}
);

// multiple metrics, multiple machines
perfmon(
	[cpu, mem],
	['someothermachine.local', 'anothermachine.local'], 
	function(err, data) {
		console.log(err || data);	
	}
);