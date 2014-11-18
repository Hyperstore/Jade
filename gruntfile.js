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
                src: ['.built/']
            }
        },

        // concat ts files into one file removing module statement before concatenating files.
        // Useful for creating external modules (amd/commonjs)
        concat : {
            options: {
                banner : "/// <reference path='../../scripts/typings/jquery/jquery.d.ts' />\r\n" +
                         "/// <reference path='../../scripts/typings/signalr/signalr.d.ts' />\r\n",
                process : function(src, filepath) {
                    var re = /(\/\/\/\s*<reference\s*path="\S*"\s*\/>)\s*/gi;
                    return src.replace(/module\s*\bHyperstore\b\s*\{([\s\S]*)}/i, '$1')
                              .replace(re, '');
                }
            },
            all : {
                src:"src/**/*.ts",
                dest:".built/src/<%= pkg.name %>.ts"
            }
        },

        // execute jasmine tests with code coverage using individual ts files 
        // for more detailed code coverage reports
        jasmine : {
            src : ".built/src/**/*.js",

            options: {
                errorReporting:true,
                //keepRunner:true,
                //vendor: '<%= jasmine.all.options.vendor %>',
                specs:'.built/specs/*.js',
                template: require('grunt-template-jasmine-istanbul'),
                templateOptions: {
                    coverage: '.built/coverage/json/coverage.json',
                    report: [
                        {type: 'html', options: {dir: '.built/coverage/html'}},
                        {type: 'text-summary'}
                    ]
                }
            }
        },

        // uglify final js files for each module
        uglify : {
            options : {
                sourceMap : true
            },
            amd : {
                src : ['.built/amd/**/*.js'],
                dest : ".built/amd/<%= pkg.name %>.min.js"
            },
            commonjs : {
                src : ['.built/commonjs/**/*.js'],
                dest : ".built/commonjs/<%= pkg.name %>.min.js"
            }
        },

        // Compile typescript files
        ts: {
            options : {
                comments:false,
                sourceMap:false,
                declaration : false,
                target : 'es5',
                watch:'fast'
            },

            // Compilation for jasmine tests (keep individual files)
            test : {
                src: "src/hyperstore/**/*.ts",
                outDir: ".built/src/hyperstore",
                options : {
                    comments: true,
                    sourceMap: true
                }
            },

            dcl : {
                src: "src/hyperstore/**/*.ts",
                out: ".built/<%= pkg.name %>.js",
                options : {
                    declaration:true,
                    module : 'amd'
                }
            },

            specs : {
                src: "tests/specs/**/*.ts",
                outDir: ".built/specs/",
                options : {
                    comments: true,
                    sourceMap: true
                }
            },

            // Amd module compilation from the concatenated ts file
            amd: {
                src: ['.built/src/<%= pkg.name %>.ts'],
                outDir : '.built/amd/',
                singleFile:true,
                options: {
                    module : "amd"
                }
            },

            // Commonjs module compilation from the concatenated ts file
            commonjs: {
                src: ['.built/src/<%= pkg.name %>.ts'],
                outDir : '.built/commonjs/',
                options: {
                    module : "commonjs"
                }
            }
        }
    });

    grunt.registerTask('default', ['build']);
    
    // build create uglify files targeting amd & commonjs modules.
    grunt.registerTask('build', ['clean',  'concat', 'ts', 'jasmine', 'uglify']);

    // execute jasmine test with code coverage
    grunt.registerTask('test', ['ts:specs', 'jasmine']);

    // generate et publish packages
    //grunt.registerTask('release', ['test', 'build']);


    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jasmine');
};