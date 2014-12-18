/// <reference path="../../scripts/typings/jasmine/jasmine.d.ts" />
/// <reference path="../../.built/src/hyperstore.d.ts" />

    describe('session rollback', function () {
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
                            Books: {Book: "1=>*"}
                        },
                        Book   : {
                            Title: ""
                        }
                    }
                },
                domains : {
                    Test : {
                        Library : {
                            Name : "Lib 1",
                            Books : [
                                {
                                    Title : "Book 1"
                                }
                            ]
                        }
                    }
                }
            };
            store = new Hyperstore.Store();
            store.init(cfg).then(function()
                  {
                      lib = (<any>cfg.domains.Test).createEntity((<any>cfg.schemas.Test).LibrarySchema);
                      lib.Name = "test";
                      done();
                  });
        });

        //Spec - 1
        it('should restore property value', function (done) {
            var session = store.beginSession();
            lib.Name = 'test2';
            session.close();

            expect(lib.Name).toEqual('test');
            done();
        });

        it('should remove relationship', function (done) {
            var session = store.beginSession();
            var b =  (<any>cfg.domains.Test).createEntity((<any>cfg.schemas.Test).BookSchema);
            b.Title = "test";
            lib.Books.add(b);
            session.close();
            expect(lib.Books.items.length).toEqual(1);
            expect(b.disposed).toBeTruthy();
            done();
        });
    });

