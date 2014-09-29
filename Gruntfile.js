module.exports = function(grunt) {
  var pkg = grunt.file.readJSON('package.json');
  // Project configuration.
  grunt.initConfig({
    pkg: pkg,
  clean: ['build/frontend', 'build/plugins', 'build', pkg.name+'-'+pkg.version+'.exe'],
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
      command: 'makensis /NOCD build\\collectw.nsi'
    }
  },
  copy: {
    node: {
      src: 'bin/node-0.10.32-x64.exe',
      dest: 'build/node.exe',
    },
    plugins: {
      expand: true,
      flatten: true,
      src: 'src/plugins/*',
      dest: 'build/plugins/',
      options: {
        process: function (content, srcpath) {
          content = '/*! <%= pkg.name %> - v<%= pkg.version %> - '
                  + '<%= grunt.template.today("yyyy-mm-dd") %> */'
                  + '\n\n'
                  + content;
          return(grunt.template.process(content));
        }
      }
    },
    collectw_nsi: {
      src: 'src/collectw.nsi',
      dest: 'build/collectw.nsi',
      options: {
        process: function (content, srcpath) {
          content = content.replace(/ *Name +".*" */g, 'Name "'+pkg.name+'"');
          content = content.replace(/ *OutFile +".*" */g, 'OutFile "'+pkg.name+'-'+pkg.version+'.exe"');
          return(content);
        }
      }
    },
    frontend: {
      src: 'frontend/*',
      dest: 'build/',
    },
  },
  concat: {
    options: {
      stripBanners: true,
      process: true,
      banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - '
            + '<%= grunt.template.today("yyyy-mm-dd") %> */'
            + '\n\n',
      },
      collectw: { src: ['src/collectw.js'], dest: 'build/collectw.js', },
      httpconfig: { src: ['src/httpconfig.js'], dest: 'build/httpconfig.js', },
      service: { src: ['src/service.js'], dest: 'build/service.js', },
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-shell');

  // Default task(s).
  grunt.registerTask('distexe', ['concat', 'copy:collectw_nsi', 'copy:node', 'copy:plugins', 'shell:makensis']);
  grunt.registerTask('test', ['jshint', 'concat', 'copy:frontend', 'copy:plugins']);
  grunt.registerTask('default', ['jshint']);

};

