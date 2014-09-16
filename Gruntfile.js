module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
	clean: ['build', 'release'],
	jshint: {
      options: {
		'node': true,
		'esnext': true,
		'curly': false,
		'smarttabs': true,
		'indent': 2,
		'quotmark': 'single',
		'laxbreak': true,
		'globals': {
			'jQuery': true
		}
      },
      all: ['Gruntfile.js', 'src/*.js']
    },
    concat: {
      options: {
        stripBanners: true,
		process: true,
        banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - '
        + '<%= grunt.template.today("yyyy-mm-dd") %> */'
		+ '\n\n',
      },
      collectw: {
        src: ['src/collectw.js'],
        dest: 'build/collectw.js',
      },
      service: {
        src: ['src/service.js'],
        dest: 'build/service.js',
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task(s).
  grunt.registerTask('default', ['concat']);

};

