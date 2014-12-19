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
        "src/hyperstore/Domains/DomainSerializer.ts" ,
        "src/hyperstore/undomanager.ts",
        "src/hyperstore/Util/Utils.ts" ,
        "src/hyperstore/Domains/Query.ts"
    ];

    var amdSources = sources.concat([
        "src/hyperstore/Bus/SignalRChannel.ts"
    ]);

    var commonjsSources = sources.concat([
        "src/Nodejs/DomainSerializer.ts"
    ]);

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
            amd : {
                options: {
                    banner : "/// <reference path='../../../scripts/typings/q/q.d.ts' />\r\n" +
                    "/// <reference path='../../../scripts/typings/signalr/signalr.d.ts' />\r\n" +
                    "import Q = require('q');\r\n",
                    process : function(src, filepath) {
                        var re = /(\/\/.*)/gm;
                        return src.replace(/module\s*\bHyperstore\b\s*\{([\s\S]*)}/i, '$1')
                            .replace(re, '');
                    }
                },
                src: amdSources,
                dest:".built/src/amd/hyperstore.ts"
            },
            commonjs : {
                options: {
                    banner : "/// <reference path='../../../scripts/typings/q/q.d.ts' />\r\n" +
                    "/// <reference path='../../../scripts/typings/node/node.d.ts' />\r\n" +
                    "import Q = require('q');\r\n",
                    process : function(src, filepath) {
                        var re = /(\/\/.*)/gm;
                        return src.replace(/module\s*\bHyperstore\b\s*\{([\s\S]*)}/i, '$1')
                            .replace(re, '');
                    }
                },
                src: commonjsSources,
                dest:".built/src/commonjs/hyperstore.ts"
            }
        },

        // execute jasmine tests with code coverage using individual ts files 
        // for more detailed code coverage reports
        jasmine : {
            src : ".built/src/hyperstore/**/*.js",
            options: {
                outfile: ".built/_SpecRunner.html",
                errorReporting:true,
                keepRunner:true,
                vendor: ["node_modules/q/q.js"],
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

            // Amd module compilation from the concatenated ts file
            amd: {
                src: ['.built/src/amd/hyperstore.ts'],
                outDir : '.built/amd/',
                singleFile:true,
                options: {
                    module : "amd"
                }
            },

            // Commonjs module compilation from the concatenated ts file
            commonjs: {
                src: ['.built/src/commonjs/hyperstore.ts'],
                outDir : 'lib',
                singleFile:true,
                options: {
                    module : "commonjs",
                    declaration:true,
                    comments: false,
                    sourceMap: true
                }
            },

            // Tests after commonjs (used the generated hyperstore.d.ts)
            specs : {
                src: "tests/specs/**/*.ts",
                outDir: ".built/specs/",
                options : {
                    comments: true,
                    sourceMap: true
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