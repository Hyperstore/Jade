var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;
var schemaTest = require('./assets/schema_Test.js').schema;
var domain;
var store;

    describe('Scopes', function () {
        'use strict';

        beforeEach(function() {
            store = new hyperstore.Store();
            domain = new hyperstore.Domain(store, 'D', schemaTest);
        });

        //Spec - 1
        it('Remove elements', function () {
            domain.loadFromJson({Name:"My library", Books:[ {Title:"Book1"}, {Title:"Book2"}]}, "Library");

            var scope = new hyperstore.DomainScope(domain, "xx");
            var lib2 = scope.getElements("Library").firstOrDefault();
            var b = scope.create("Book");
            lib2.Books.add(b);

            scope.remove(lib2.getId());
            var changes = scope.getChanges();
            expect(scope.getElements().count()).to.equal(0);
            expect(domain.getEntities().count()).to.equal(3);
            var jsonChanges = hyperstore.DomainSerializer.saveChanges(scope);
            store.unloadDomain(scope);

            scope = new hyperstore.DomainScope(domain, "xx");
            expect(scope.getEntities().count()).to.equal(3);
            scope.loadFromJson(jsonChanges);
            expect(scope.getElements().count()).to.equal(0);
        });

        it("Can get all changes", function() {
            var lib = domain.create("Library");
            lib.Name = "test";

            var scope = new hyperstore.DomainScope(domain, "xx");
            var lib2 = scope.get(lib.getId());
            lib2.Name = "Test2";
            var b = scope.create("Book");
            lib2.Books.add(b);

            var changes = scope.getChanges();
            expect(changes.count()).to.equal(3);
            changes.reset();
            changes.hasNext();
            var chg = changes.next();
            expect(chg.state === hyperstore.TrackingState.Updated);
            expect(chg.properties.length === 1);
            changes.hasNext();
            chg = changes.next();
            expect(chg.state === hyperstore.TrackingState.Added);
            changes.hasNext();
            chg = changes.next();
            expect(chg.state === hyperstore.TrackingState.Added);
            var json = hyperstore.DomainSerializer.save(scope);
            store.unloadDomain(scope);
       });

        it("Update a value don't impact initial domain", function() {
            var lib = domain.create("Library");
            lib.Name = "test";
            expect(lib.Books.count()).to.equal(0);

            var scope = new hyperstore.DomainScope(domain, "xx");
            var lib2 = scope.getElements("Library").firstOrDefault();
            expect(lib).to.not.be.undefined;
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
            var scope = new hyperstore.DomainScope(domain, "xx");
            var lib2 = scope.get(lib.getId());
            lib2.Name = "Test2";
            expect(lib2.Name).to.equal("Test2");
            store.unloadDomain(scope, true); // Commit before unload
            expect(lib.Name).to.equal("Test2");
        });
    });

