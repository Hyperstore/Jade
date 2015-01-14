var Hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

describe('Undo/Redo manager', function () {
        'use strict';

        var store;
        var lib;
        var cfg;
        var meta;

        beforeEach(function()
        {
            cfg = {
                schemas : {
                    Test : {
                        Library: {
                            Name : "string",
                            Books: ["Book"]
                        },
                        Book   : {
                            Title: ""
                        }
                    }
                },
                domains : {
                    Test : {}
                }
            };
            store = new Hyperstore.Store();
            meta = store.init(cfg);
            lib = meta.domains.Test.create(meta.schemas.Test.Library);
            lib.Name = "test";
        });

        it('should perform undo and redo', function () {

            var undoManager = new Hyperstore.UndoManager(store);
            undoManager.registerDomain(meta.domains.Test);

            var session = store.beginSession();
            var domain = meta.domains.Test;
            var b =  domain.create(meta.schemas.Test.Book);
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
            b = domain.get("test:2");
            expect(b.Title).to.equal("test");
        });
    });

