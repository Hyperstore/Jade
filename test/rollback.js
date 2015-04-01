var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;
var schemaTest = require('./assets/schema_Test.js').schema;

describe('session rollback', function () {
        'use strict';

        var store;
        var lib;
        var domain;

        beforeEach(function()
        {
            store = new hyperstore.Store();
            var schema = store.loadSchema(schemaTest);
            domain = store.createDomain("test", schema, {Name:"MyLibrary",
                    Books : [
                        {
                            Title : "Book 1"
                        }
                    ]
                }
            );
            lib = domain.root;
            lib.Name = "test";
        });

        //Spec - 1
        it('should restore property value', function () {
            var session = store.beginSession();
            lib.Name = 'test2';
            session.close();

            expect(lib.Name).to.equal('test');
        });

        it('should remove relationship', function () {
            var session = store.beginSession();
            var b =  domain.create("Book");
            b.Title = "test";
            lib.Books.add(b);
            session.close();
            expect(lib.Books.items.length).to.equal(1);
            expect(b.isDisposed).to.be.true;
        });
    });

