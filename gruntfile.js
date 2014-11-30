// Test
// compile dans built multi-fichiers
// lance les tests dessus
// Build
// Preprocess fichiers et copies ds built/src

module.exports = function (grunt) {
    var sources = [
        "src/hyperstore/Schema/schema.ts" ,
        "src/hyperstore/Schema/SchemaInfo.ts" ,
        "src/hyperstore/Schema/SchemaElement.ts" ,
        "src/hyperstore/Schema/SchemaEntity.ts" ,
        "src/hyperstore/Schema/SchemaProperty.ts" ,
        "src/hyperstore/Schema/SchemaRelationship.ts" ,
        "src/hyperstore/Schema/SchemaValueObject.ts" ,
        "src/hyperstore/Util/Promise.ts" ,
        "src/hyperstore/Util/Utils.ts" ,
        "src/hyperstore/Session/Session.ts" ,
        "src/hyperstore/Session/SessionResult.ts" ,
        "src/hyperstore/Session/Trackings.ts" ,
        "src/hyperstore/Events/Events.ts" ,
        "src/hyperstore/Events/Dispatcher.ts" ,
        "src/hyperstore/Events/EventDispatcher.ts" ,
        "src/hyperstore/Events/EventManager.ts" ,
        "src/hyperstore/Domains/PropertyValue.ts" ,
        "src/hyperstore/Domains/Store.ts" ,
        "src/hyperstore/Domains/DomainModel.ts" ,
        "src/hyperstore/Domains/ModelElement.ts" ,
        "src/hyperstore/Domains/ModelElementCollection.ts" ,
        "src/hyperstore/Constraints/Constraints.ts" ,
        "src/hyperstore/Constraints/ConstraintContext.ts" ,
        "src/hyperstore/Constraints/ConstraintManager.ts" ,
        "src/hyperstore/Constraints/DiagnosticMessage.ts" ,
        "src/hyperstore/Bus/Message.ts" ,
        "src/hyperstore/Bus/EventBus.ts" ,
        "src/hyperstore/Bus/AbstractChannel.ts" ,
        "src/hyperstore/Adapters/Adapters.ts" ,
        "src/hyperstore/Adapters/IndexedDb.ts" ,
        "src/hyperstore/Adapters/LocalStorage.ts" ,
        "src/hyperstore/Bus/SignalRChannel.ts" ,
        "src/hyperstore/undomanager.ts",
        "src/hyperstore/Domains/Query.ts"
    ];

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // clean working directory
        clean: {
            options: { force: true },
            all: {
                src: ['.built/', 'lib']
            }
        },

        // concat ts files into one file removing module statement before concatenating files.
        // Useful for creating external modules (amd/commonjs)
        concat : {
            options: {
                banner : "/// <reference path='../../scripts/typings/jquery/jquery.d.ts' />\r\n" +
                         "/// <reference path='../../scripts/typings/signalr/signalr.d.ts' />\r\n",
                process : function(src, filepath) {
                    var re = /(\s*\/\/.*)/gm;
                    return src.replace(/module\s*\bHyperstore\b\s*\{([\s\S]*)}/i, '$1')
                              .replace(re, '');
                }
            },
            all : {
                src: sources,
                dest:".built/src/<%= pkg.name %>.ts"
            }
        },

        // execute jasmine tests with code coverage using individual ts files 
        // for more detailed code coverage reports
        jasmine : {
            src : ".built/src/**/*.js",

            options: {
                outfile: ".built/_SpecRunner.html",
                errorReporting:true,
                keepRunner:true,
                //vendor: '<%= jasmine.all.options.vendor %>',
                specs:'.built/specs/*.js'/*,
                template: require('grunt-template-jasmine-istanbul'),
                templateOptions: {
                    coverage: '.built/coverage/json/coverage.json',
                    report: [
                        {type: 'html', options: {dir: '.built/coverage/html'}},
                        {type: 'text-summary'}
                    ]
                }*/
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
                }
            },

            dcl : {
                src: sources,
                out: ".built/src/hyperstore.js",
                options : {
                    declaration:true,
                    comments: true,
                    sourceMap: true
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
                outDir : 'lib',
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