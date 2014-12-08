/// <reference path="../../scripts/typings/jasmine/jasmine.d.ts" />
/// <reference path="../../.built/src/hyperstore.d.ts" />

    describe('Undo/Redo manager', function () {
        'use strict';

        var store;
        var lib;
        var cfg;

        beforeEach(function(done)
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
            store.initAsync(cfg).then(function()
                  {
                      lib = (<any>cfg.domains.Test).createEntity((<any>cfg.schemas.Test).LibrarySchema);
                      lib.Name = "test";
                      done();
                  });
        });

        it('should perform undo and redo', function (done) {

            var undoManager = new Hyperstore.UndoManager(store);
            undoManager.registerDomain(cfg.domains.Test);

            var session = store.beginSession();
            var domain = <Hyperstore.DomainModel>cfg.domains.Test;
            var b =  <any>domain.createEntity((<any>cfg.schemas.Test).BookSchema);
            b.Title = "test";
            lib.Books.add(b);
            session.acceptChanges();
            session.close();

            expect(lib.Books.count).toEqual(1);
            expect(b.disposed).toBeFalsy();
            expect(undoManager.canRedo).toBeFalsy();
            expect(undoManager.canUndo).toBeTruthy();

            undoManager.undo(); // remove all

            expect(lib.Books.count).toEqual(0);
            expect(b.disposed).toBeTruthy();
            expect(undoManager.canUndo).toBeFalsy();
            expect(undoManager.canRedo).toBeTruthy();

            undoManager.redo(); // re create

            expect(lib.Books.count).toEqual(1);
            b = <any>domain.getElement("test:2");
            expect(b.Title).toEqual("test");
            done();
        });
    });

