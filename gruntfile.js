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
        "src/hyperstore/Schema/Loader.ts" ,
        "src/hyperstore/Util/Promise.ts" ,
        "src/hyperstore/Session/Session.ts" ,
        "src/hyperstore/Session/SessionResult.ts" ,
        "src/hyperstore/Session/Trackings.ts" ,
        "src/hyperstore/Events/Events.ts" ,
        "src/hyperstore/Events/Dispatcher.ts" ,
        "src/hyperstore/Events/EventDispatcher.ts" ,
        "src/hyperstore/Events/EventManager.ts" ,
        "src/hyperstore/Domains/PropertyValue.ts" ,
        "src/hyperstore/Domains/DomainModel.ts" ,
        "src/hyperstore/Domains/Store.ts" ,
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
        "src/Nodejs/DomainSerializer.ts",
        "src/Nodejs/MongoDbAdapter.ts"
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

        copy : {
            commonjs : {
                options: {
                    process : function(content, path) {
                        return content + "exports.schema=domain;";
                    }
                },
                expand: "true", cwd: 'src/Domains/', src:'*', dest: 'lib/', filter:"isFile", flatten:true
            },
            amd : {
                options: {
                    process : function(content, path) {
                        return "define(['require', 'exports'], function(require, exports) {\r\n" +
                                content + "exports.schema=domain;});";
                    }
                },
                expand: "true", cwd: 'src/Domains/', src:'*', dest: '.built/amd/', filter:"isFile", flatten:true
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
                        var re = /^(\s*\/\/.*)/gm;
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
                    "/// <reference path='../../../scripts/typings/mongodb/mongodb.d.ts' />\r\n" +
                    "import Q = require('q');\r\n",
                    process : function(src, filepath) {
                        var re = /^(\s*\/\/.*)/gm;
                        return src.replace(/module\s*\bHyperstore\b\s*\{([\s\S]*)}/i, '$1')
                            .replace(re, '');
                    }
                },
                src: commonjsSources,
                dest:".built/src/commonjs/hyperstore.ts"
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
                outDir : '.built/commonjs/',
                singleFile:true,
                options: {
                    module : "commonjs",
                    declaration:true,
                    comments: false,
                    sourceMap: true
                }
            }
        }
    });

    grunt.registerTask('default', ['build']);
    
    // build create uglify files targeting amd & commonjs modules.
    grunt.registerTask('build', ['clean', 'concat', 'ts', "copy", 'mochaTest', 'uglify']);

    // execute jasmine test with code coverage
    grunt.registerTask('test', ['ts:specs', 'mochaTest']);

    // generate et publish packages
    //grunt.registerTask('release', ['test', 'build']);

    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-mocha-test');
};