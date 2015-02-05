var Hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;
var schemaTest = require('./schema_Test.js').schema;

describe('Undo/Redo manager', function () {
        'use strict';

        var store;
        var lib;
        var domain;

        beforeEach(function()
        {
            store = new Hyperstore.Store();
            store.loadSchemas(schemaTest);
            domain = new Hyperstore.DomainModel(store, 'D');
            lib = domain.create("Library");
            lib.Name = "test";
        });

        it('should perform undo and redo', function () {

            var undoManager = new Hyperstore.UndoManager(store);
            undoManager.registerDomain(domain);

            var session = store.beginSession();
            var b =  domain.create("Book");
            b.Title = "test";
            lib.Books.add(b);
            session.acceptChanges();
            session.close();

            expect(lib.Books.items.length).to.equal(1);
            expect(b.isDisposed).to.be.false;
            expect(undoManager.canRedo).to.be.false;
            expect(undoManager.canUndo).to.be.true;

            undoManager.undo(); // remove all

            expect(lib.Books.items.length).to.equal(0);
            expect(b.isDisposed).to.be.true;
            expect(undoManager.canUndo).to.be.false;
            expect(undoManager.canRedo).to.be.true;

            undoManager.redo(); // re create

            expect(lib.Books.items.length).to.equal(1);
            b = domain.get(b.getId());
            expect(b.Title).to.equal("test");
        });
    });

