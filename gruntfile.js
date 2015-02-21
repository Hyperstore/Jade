// Test
// compile dans built multi-fichiers
// lance les tests dessus
// Build
// Preprocess fichiers et copies ds built/src

module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // clean working directory
        clean: {
            options: { force: true },
            all: {
                src: ['.built/', 'lib']
            }
        },

        copy : {
            core : {
                options: {
                    process : function(content, path) {
                        return "(function(global, name, definition) {" +
                        "if (typeof module != 'undefined')  definition(module.exports, require('q'));"+
                        "else if (typeof define == 'function' && typeof define.amd == 'object') define(['exports', 'require'], definition(exports));"+
                        "else {var namespace = {};global[name] = namespace;definition(namespace, Q);}" +
                    "}(this, 'Hyperstore', function(Hyperstore, Q) {" + content + "}));";
                    }
                },
                src:'.built/dist/hyperstore.js', dest: 'lib/hyperstore.js'
            },

            schemas : {
                options: {
                },
                expand: "true", cwd: 'src/Domains/', src:'*', dest: 'lib/', filter:"isFile", flatten:true
            },

            browser : {
                options: {
                    process : function(content, path) {
                        return "(function(definition) {" +
                            "if (typeof define == 'function' && typeof define.amd == 'object') define(['exports', 'require'], definition(exports));"+
                            "else { definition(Hyperstore, Hyperstore); }" +
                            "}(function(exports, Hyperstore) {" + content + "}));";
                    }
                },
                expand: "true", cwd: '.built/src/Browser/', src:'*', dest: 'lib/', filter:"isFile", flatten:true
            }
        },

        mochaTest: {
            all : {
                src: "test/**/*.js",
                options: {
                //    reporter: "bdd"
                }
            }
        },

        // uglify final js files for each module
        uglify : {
            options : {
                sourceMap : true
            },
            core : {
                src : ['lib/hyperstore.js'],
                dest : "lib/<%= pkg.name %>.min.js"
            }
        },

        // Compile typescript files
        typescript: {
            options : {
                comments:false,
                sourceMap:false,
                declaration : false,
                target : 'es5',
                noEmitOnError:true,
                removeComments:true
            },

            core: {
                src: ['src/hyperstore/**/*.ts'],
                dest : '.built/dist/hyperstore.js',
                options: {
                    declaration:true,
                    comments: false
                }
            },

            // Compilation for jasmine tests (keep individual files)
            test : {
                src: "src/hyperstore/**/*.ts",
                dest: ".built/",
                options : {
                    declaration : false,
                    target : 'es5',
                    noEmitOnError:true,
                    removeComments:true
                }
            },

            browser : {
                src: ['src/Browser/**/*.ts'],
                dest : '.built/',
                options: {
                    declaration : false,
                    target : 'es5',
                    noEmitOnError:true,
                    removeComments:true,
                    module : "commonjs"
                }
            },

            nodejs : {
                src: ['src/Nodejs/**/*.ts'],
                dest : '.built/',
                options: {
                    declaration : false,
                    target : 'es5',
                    noEmitOnError:true,
                    removeComments:true,
                    module : "commonjs",
                    comments: false
                }
            }
        }
    });

    grunt.registerTask('default', ['build']);
    
    // build create uglify files targeting amd & commonjs modules.
    grunt.registerTask('build', ['clean', 'typescript', "copy", 'mochaTest', 'uglify']);

    // execute jasmine test with code coverage
    grunt.registerTask('test', ['ts:specs', 'mochaTest']);

    // generate et publish packages
    //grunt.registerTask('release', ['test', 'build']);

    grunt.loadNpmTasks('grunt-typescript');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-mocha-test');
};