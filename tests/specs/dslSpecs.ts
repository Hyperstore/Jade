/// <reference path="../../scripts/typings/jasmine/jasmine.d.ts" />
/// <reference path="../../.built/src/hyperstore.d.ts" />
'use strict';

describe('Schema tests', function ()
{
    var config =
    {
        schemas: {
            s: {
                valueObjects : {
                    Email : {
                        $type: "string",
                        serialize : function(val) {
                            return val;
                        },
                        $constraints : {
                            "Malformed email " : {
                                condition: function(value, oldValue) {
                                    return value != null;
                                },
                                type : "validate",
                                error : false
                            }
                        }
                        //deserialize
                    }
                },
                Library : {
                    Name : "",
                    Books : {  Book: "1=>*"}
                },
                Book : {
                    Copies : 0,
                    Title : {
                        $type : "string",
                        $default : undefined,
                        $constraints : {
                            $default : {
                                type:"validate",
                                error:false
                            },
                            "Title is required": {
                                condition: function(value, oldValue) {
                                    return value != null;
                                },
                                type : "validate",
                                error : false
                            }
                        }
                    },
                    AsString : function(self) {
                        return self.Title + " Copies : " + self.Copies;
                    },
                    Library : {  Library : "*<=1"}
                },
                LibraryHasBooks : {
                    $source : "Library",
                    $end : "Book",
                    $kind : "1=>*"
                }
            }
        },
        domains : {
            test: {
                seed : {
                    always:true
                }
            }
        }
    };

    var store;

 /*   it('should initialize store from the dsl', function(done) {
        store = new Hyperstore.Store();
        store.initAsync(config).then( function()
            {
                expect(store.getDomain('test')).not.toBeUndefined();
                expect(store.getSchemaElement('Library', false)).not.toBeUndefined();
                done();
            });
    });*/
});
