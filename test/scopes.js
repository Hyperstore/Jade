var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

var cfg = {
    schemas : {
        Lib : {
            Library :
            {
                Name : {$type:"string"},
                Books : {Book : "1=>*"}
            },
            Book : {
                Title : "string",
                Copies : "number"
            }
        }
    }
};
var meta;
var domain;
var store;

    describe('Scopes', function () {
        'use strict';

        beforeEach(function() {
            store = new hyperstore.Store();
            meta = store.init(cfg);
            domain = new hyperstore.DomainModel(store, 'D');
        });

        //Spec - 1
        it('Load a new scope', function () {
           // var scope = new hyperstore.DomainModelScope(domain, "xx");

        });

        it("Update a value don't impact initial domain", function() {
            var lib = meta.schemas.Lib.Library.create(domain);
            lib.Name = "test";
            expect(lib.Books.count()).to.equal(0);

            var scope = new hyperstore.DomainModelScope(domain, "xx");
            var lib2 = scope.get(lib.getId());
            expect(lib2.Name).to.equal("test");
            lib2.Name = "Test2";
            expect(lib2.Name).to.equal("Test2");
            var b = meta.schemas.Lib.Book.create(scope);
            lib2.Books.add(b);
            expect(lib2.Books.count()).to.equal(1);
            store.unloadDomain(scope);

            expect(lib.Books.count()).to.equal(0);
            expect(lib.Name).to.equal("test");
        });

        it("Extension changes commit", function() {
            var lib = meta.schemas.Lib.Library.create(domain);
            lib.Name = "test";
            var scope = new hyperstore.DomainModelScope(domain, "xx");
            var lib2 = scope.get(lib.getId());
            lib2.Name = "Test2";
            expect(lib2.Name).to.equal("Test2");
            store.unloadDomain(scope, true); // Commit before unload
            expect(lib.Name).to.equal("Test2");
        });
    });

