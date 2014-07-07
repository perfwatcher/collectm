var perfmon = require('perfmon');

var counters = [
	'\\processor(_total)\\% processor time',
	'\\Memory\\Available bytes'
];

perfmon(counters, function(err, data) {
	console.log(data);	
});