var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;
var standard = require('../lib/standards.js').Schemas.Standards;

'use strict';

describe('Validation tests', function ()
{
    var testSchema =
    {
        $import : {
            std: standard
        },
        id:"Test",
        constraints: {
            "required": {
                message: "Property {propertyName} is required",
                check: function (val) {
                    return val != undefined;
                }
            }
        },
        Container : {
            references: {
                Items: {
                    end: "Item",
                    kind : "1=>*"
                }
            }
        },
        Item : {
            properties: {
                Num: {type: "number", constraints: {"$ref": "std.required"}},
                Key: "std.identity",
                Flag: "boolean",
                Values: {type: "std.enum", values: ['A', 'B', 'C']},
                Range: {type: "std.range", min: 1, max: 10}
            }
        }
    };

    var store;
    var root;
    var domain;

    beforeEach(function() {
        store = new hyperstore.Store();
        store.loadSchema([testSchema, standard]);
        domain = store.createDomain({name:"Test", root : {
            Container : {
                Items : {
                    Key : "1",
                    Flag:true
                }
            }
        } });
        root = domain.getElements("Container").firstOrDefault();
    });

    it('should failed on wrong primitives values', function() {

        var schema = store.getSchema("Test");
      //  schema.constraints.__dump();

        var session = store.beginSession();
        var item = domain.create("Item");
        item.Num = "str";
        session.acceptChanges();
        var r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(true);
        expect(r.messages.length).to.equal(3); // Num : str is not a number, Values, range
        session = store.beginSession();
        item.Num = 2;
        item.Values = "A";
        item.Range = 1;
        session.acceptChanges();
        r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(false);
    });

    it('should failed on wrong range values', function() {
        var session = store.beginSession();
        var item = domain.create("Item");
        item.Values = "A";
        item.Num=0;
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

    it('on demand validations', function() {
        var session = store.beginSession();
        var item = domain.create("Item");
        session.acceptChanges();
        var r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(true);
        var cx = r.messages.length;

        var diags = domain.validate();
        expect(diags.length).to.equal(cx);
    });
});
