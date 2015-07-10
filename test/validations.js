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
                Range: {type: "std.range", min: 1, max: 10},
                Name : "string"
            }
        }
    };

    var store;
    var root;
    var domain;

    beforeEach(function() {
        store = new hyperstore.Store();
        store.loadSchema(testSchema);
        domain = store.createDomain("Test", "Test", {
            Container: {
                Items: {
                    Key: "1",
                    Flag: true
                }
            }
        });
        root = domain.getElements("Container").firstOrDefault();
    });

    it('should failed on wrong primitive values', function() {

        var schema = store.getSchema("Test");
      //  schema.constraints.__dump();

        var session = store.beginSession({mode:64/*SessionMode*/}); // Don't throw exception on validation errors
        var item = domain.create("Item");
        item.Name = {test:"str"};
        var r = session.close();
        expect(r.aborted).to.equal(true);
    });

    it('can get constraints on element', function() {
        var sch = store.getSchemaElement("Item");
        expect(sch).to.be.not.null();

        var constraints = sch.getConstraints();
        expect(constraints).to.be.not.null();
    });

    it('should failed on wrong range values', function() {
        var session = store.beginSession({mode:64/*SessionMode*/}); // Don't throw exception on validation errors
        var item = domain.create("Item");
        item.Values = "A";
        item.Num = 0;
        item.Range = "str";
        session.acceptChanges();
        var r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(true);
    });

    it('should failed on wrong range values', function() {
        var session = store.beginSession({mode:64/*SessionMode*/}); // Don't throw exception on validation errors
        var item = domain.create("Item");
        item.Values = "A";
        item.Num=0;
        item.Range = 1;
        item.Name = "str";
        session.acceptChanges();
        var r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(false);

        session = store.beginSession({mode:64/*SessionMode*/}); // Don't throw exception on validation errors
        item.Range = 0;
        session.acceptChanges();
        r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(true);

        session = store.beginSession({mode:64/*SessionMode*/}); // Don't throw exception on validation errors
        item.Range = 1;
        session.acceptChanges();
        r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(false);

    });

    it('on demand validations', function() {
        var session = store.beginSession({mode:64/*SessionMode*/}); // Don't throw exception on validation errors
        var item = domain.create("Item");
        session.acceptChanges();
        var r = session.close();
        expect(r.hasErrorsOrWarnings).to.equal(true);
        var cx = r.messages.length;

        var diags = domain.validate();
        expect(diags.length).to.equal(cx);
    });
});
