var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

'use strict';

describe('Schema tests', function ()
{
    var config =
    {
        schemas: {
            s: {
                $types : {
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
                                type : "validateElement",
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
                                type:"validateElement",
                                error:false
                            },
                            "Title is required": {
                                condition: function(value, oldValue) {
                                    return value != null;
                                },
                                type : "validateElement",
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
            }
        }
    };

    var store;

    beforeEach(function() {
        store = new hyperstore.Store();
        store.init(config);
    });

    it('should initialize store from the dsl', function() {
        expect(store.getDomain('test')).to.not.be.undefined;
        expect(store.getSchemaElement('Library', false)).to.not.be.undefined;
    });
});
