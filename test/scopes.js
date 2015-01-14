var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

    describe('Scopes', function () {
        'use strict';
        var store = new hyperstore.Store();
        var schema = new hyperstore.Schema(store, 'Test');
        var librarySchema = new hyperstore.SchemaEntity(schema, 'Library');
        librarySchema.defineProperty('Name', 'string');

        var domain = new hyperstore.DomainModel(store, 'D');

        //Spec - 1
        it('Load a new scope', function () {
            var scope = new DomainModelScope(domain, "xx");

        });

        it("Update a value don't impact domain", function() {
            var lib = librarySchema.create(domain, {Name:"test"});
            var scope = new DomainModelScope(domain, "xx");
            lib.Name = "Test2";
            expect(lib.Name).to.equal("Test2");
        });
    });

