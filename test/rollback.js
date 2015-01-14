var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

describe('session rollback', function () {
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
                            Books: {Book: "1=>*"}
                        },
                        Book   : {
                            Title: ""
                        }
                    }
                },
                momo:{},
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
            store = new hyperstore.Store();
            meta = store.init(cfg);
            lib = meta.domains.Test.getElements(meta.schemas.Test.Library).firstOrDefault();
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
            var b =  meta.domains.Test.create(meta.schemas.Test.Book);
            b.Title = "test";
            lib.Books.add(b);
            session.close();
            expect(lib.Books.items.length).to.equal(1);
            expect(b.isDisposed).to.be.true;
        });
    });

