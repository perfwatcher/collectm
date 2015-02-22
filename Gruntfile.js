
module.exports = function(grunt) {
  var appendGenericBanner = function (content, srcpath) {
    content = '/*! <%= pkg.name %> - v<%= pkg.version %> - '
            + 'Built <%= grunt.template.today("yyyy-mm-dd") %> */'
            + '\n\n'
            + content;
    return(grunt.template.process(content));
  };

  var pkg = grunt.file.readJSON('package.json');
  // Project configuration.
  grunt.initConfig({
    pkg: pkg,
  clean: ['build/frontend', 'build/plugins', 'build/lib', 'build', pkg.name+'-'+pkg.version+'.exe'],
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
      all: ['Gruntfile.js', 'src/*.js', 'src/plugins/*.js']
    },
  shell: {
    makensis: {
      command: 'makensis /NOCD build\\collectm.nsi'
    }
  },
  copy: {
    node: {
      files: [
          { src: 'bin/node-0.12.0-x64.exe', dest: 'build/bin/node.exe', },
          { src: 'bin/node-0.12.0-x86.exe', dest: 'build/bin/node32.exe', },
          { src: 'bin/node-0.12.0-x64.exe', dest: 'build/bin/node64.exe', },
          { src: 'bin/nssm-2.24-x64.exe', dest: 'build/bin/nssm.exe', },
          { src: 'bin/nssm-2.24-x86.exe', dest: 'build/bin/nssm32.exe', },
          { src: 'bin/nssm-2.24-x64.exe', dest: 'build/bin/nssm64.exe', },
        ]
    },
    sources: {
      options: {
        process: appendGenericBanner,
      },
      files: [
          { src: 'src/collectm.js', dest: 'build/lib/collectm.js', },
          { src: 'src/collectm_utils.js', dest: 'build/lib/collectm_utils.js', },
          { src: 'src/httpconfig.js', dest: 'build/lib/httpconfig.js', },
          { src: 'src/service.js', dest: 'build/lib/service.js', },
        ]
    },
    plugins: {
      expand: true,
      flatten: true,
      src: 'src/plugins/*',
      dest: 'build/plugins/',
      options: {
        process: appendGenericBanner,
      }
    },
    collectm_nsi: {
      src: 'src/collectm.nsi',
      dest: 'build/collectm.nsi',
      options: {
        process: function (content, srcpath) {
		  content = content.replace(/ *\!define PROJECTNAME +".*" */g, '!define PROJECTNAME "'+pkg.name+'"');
		  content = content.replace(/ *\!define VERSION +".*" */g, '!define VERSION "'+pkg.version+'"');
          return(content);
        }
      }
    },
    frontend: {
      src: 'frontend/*',
      dest: 'build/',
    },
  },
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-shell');

  // Default task(s).
  grunt.registerTask('distexe', ['copy:collectm_nsi', 'copy:sources', 'copy:node', 'copy:plugins', 'shell:makensis']);
  grunt.registerTask('test', ['jshint', 'copy:node', 'copy:sources', 'copy:frontend', 'copy:plugins']);
  grunt.registerTask('default', ['jshint']);

};

