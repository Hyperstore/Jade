var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;
var schemaTest = require('./schema_Test.js').schema;
var domain;
var store;

    describe('Scopes', function () {
        'use strict';

        beforeEach(function() {
            store = new hyperstore.Store();
            store.loadSchemas(schemaTest);
            domain = new hyperstore.DomainModel(store, 'D');
        });

        //Spec - 1
        it('Load a new scope', function () {
           // var scope = new hyperstore.DomainModelScope(domain, "xx");

        });

        it("Update a value don't impact initial domain", function() {
            var lib = domain.create("Library");
            lib.Name = "test";
            expect(lib.Books.count()).to.equal(0);

            var scope = new hyperstore.DomainModelScope(domain, "xx");
            var lib2 = scope.get(lib.getId());
            expect(lib2.Name).to.equal("test");
            lib2.Name = "Test2";
            expect(lib2.Name).to.equal("Test2");
            var b = scope.create("Book");
            lib2.Books.add(b);
            expect(lib2.Books.count()).to.equal(1);
            store.unloadDomain(scope);

            expect(lib.Books.count()).to.equal(0);
            expect(lib.Name).to.equal("test");
        });

        it("Extension changes commit", function() {
            var lib = domain.create("Library");
            lib.Name = "test";
            var scope = new hyperstore.DomainModelScope(domain, "xx");
            var lib2 = scope.get(lib.getId());
            lib2.Name = "Test2";
            expect(lib2.Name).to.equal("Test2");
            store.unloadDomain(scope, true); // Commit before unload
            expect(lib.Name).to.equal("Test2");
        });
    });

