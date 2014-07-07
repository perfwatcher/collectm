'use strict';
var os = require('os');
var child_process = require('child_process');

function check(drive, callback)
{
	var total = 0;
	var free = 0;
	var status = null;

	if (!drive)
	{
		status = 'NOTFOUND';
		return callback(total, free, status);
	}

	if (os.type() == 'Windows_NT') //Windows
	{
		child_process.exec('"' + __dirname + '\\drivespace.exe" drive-' + drive, function(error, stdout, stderr)
		{
			if (error)
			{
				status = 'STDERR';
				console.log(stderr);
				callback(total, free, status);
			}
			else
			{
				var disk_info = stdout.split(',');

				total = disk_info[0];
				free = disk_info[1];
				status = disk_info[2];

				callback(total, free, status);
			}
		});
	}
	else
	{
		child_process.exec("df -k '" + drive.replace(/'/g,"'\\''") + "'", function(error, stdout, stderr)
		{
			if (error)
			{
				if (stderr.indexOf("No such file or directory") != -1)
				{
					status = 'NOTFOUND';
					callback(total, free, status);
				}
				else
				{
					status = 'STDERR';
					console.log(stderr);
					callback(total, free, status);
				}
			}
			else
			{
				var lines = stdout.trim().split("\n");

				var str_disk_info = lines[lines.length - 1].replace( /[\s\n\r]+/g,' ');
				var disk_info = str_disk_info.split(' ');

				total = disk_info[1] * 1024;
				free = disk_info[3] * 1024;
				status = 'READY';

				callback(total, free, status);
			}
		});
	}
}

// Export public API
module.exports = {
	check: check,
};
