var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

'use strict';

describe('Constructor tests', function ()
{
    var config =
    {
        id: "Test",
        field: {type:"string", defaultValue:"xxx"},
        Container: {
            references: {
                Items: {
                    end: "Item",
                    kind: "1=>*"
                }
            }
        },
        Item: {
            properties: {
                Num: "number",
                Flag: "boolean",
                Str: "string"
            }
        }
    };

    var store;

    beforeEach(function() {
        store = new hyperstore.Store();
        store.loadSchema(config);
    });

    var __extends = this.__extends || function (d, b) {
            for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
            function __() { this.constructor = d; }
            __.prototype = b.prototype;
            d.prototype = new __();
        };


    it('can create an object with new', function() {
        var domain = new hyperstore.Domain(store, "Test", "Test");
        var schema = store.getSchema("Test");

        var c = new schema.Container(domain);
        var id = c.getId();
        expect(c instanceof schema.Container).to.equal(true);
        var f = c.field;
        expect(f).to.equal("xxx");
    });

});
