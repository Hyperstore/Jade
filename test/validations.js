var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

'use strict';

describe('Validation tests', function ()
{
 /*   var test = {
        schemas : {
            "name" :{
                library : {
                    properties : {
                        "title" : {
                            type : "email",
                            default : "jdjdjd",
                            constraints : {
                                "$import" : ["required"],
                                "kdoekd dokedd" : function(val) {}
                            }
                        },
                        relationships : {
                            "LibraryHasBooks" : {
                                end : "Book",
                                cardinality : "OneToMany",
                                Embedded : true
                            }
                        }
                    },
                    constraints : {

                    }
                }
            }
        }
    };
    */

    var config =
    {
        schemas: {
            std: {
                // Shared constraints can be referenced with the $ref property name.
                $constraints: {
                    "Property {propertyName} is required": {
                        name: "required", // unique id
                        check: function (val) {
                            return val != undefined;
                        }
                    }
                },

                $types: {
                    enum: {
                        values: [],
                        $constraints: {
                            "Invalid property {propertyName} must be one of {$values}": function (val) {
                                return this.values.indexOf(val) !== -1;
                            }
                        }
                    },
                    range: {
                        $type:"number",
                        min: 0,
                        max: 1,
                        $constraints : {
                            "Invalid {propertyName} value must be between {$min} and {$max}": function (val) {
                                return val >= this.min && val <= this.max;
                            }
                        }
                    },
                    arrayOf: {
                        type: "string",
                        $constraints : {
                            "Invalid {propertyName}. Must be an array of {$type}": function (val) {
                                if (!val) return true;
                                if (!val.length) return false;
                                var ok = true;
                                val.forEach(function (v) {
                                    if (typeof v !== this.type) ok = false;
                                });
                                return ok;
                            }
                        }
                    }
                }
            },
            test: {
                $types : {
                    identity : {
                        $type : "string",
                        $constraints : {
                            "$ref" : "required",
                            "Duplicate value {value} for {propertyName}" : function(val, old, ctx) {
                                var domain = ctx.element.domain;
                                var others = domain.find(ctx.element.schemaElement);
                                var pname = ctx.propertyName;
                                return !others.any( function(e) {return e[pname] === val && e.id !== ctx.element.id});
                            }
                        }
                    }
                },
                Container : {
                    Items : {  Item: "1=>*"}
                },
                Item : {
                    Num : {$type:"number", $constraints: {"$ref":"required"}},
                    Key : "identity",
                    Flag: "boolean",
                    Values : "enum(values:['A', 'B', 'C'])",
                    Range : "range(min:1, max:10)"
                }
            }
        },
        domains : {
            test: {
                "Container" : {
                    Root : {}
                }
            }
        }
    };

    var store;
    var root;

    beforeEach(function() {
        store = new hyperstore.Store();
        store.init(config);
        root = config.domains.test.find("Container").firstOrDefault();
    });

  /*  it('should failed on wrong primitives values', function() {
        var session = store.beginSession();
        var item = config.domains.test.create("Item");
        item.Num = "str";
        session.acceptChanges();
        var r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(true);
        expect(r.messages.length).to.equal(2);
        session = store.beginSession();
        item.Num = 2;
        item.Values = "A";
        session.acceptChanges();
        r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(false);
    });*/

    it('should failed on wrong range values', function() {
        var session = store.beginSession();
        var item = config.domains.test.create("Item");
        item.Values = "A";

        item.Range = "str";
        session.acceptChanges();
        var r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(true);

        session = store.beginSession();
        item.Range = 0;
        session.acceptChanges();
        r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(true);

        session = store.beginSession();
        item.Range = 1;
        session.acceptChanges();
        r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(false);

    });

});
