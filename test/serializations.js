var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

'use strict';

describe('Serialization tests', function ()
{
    var config =
    {
        id: "Test",
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


    it('serialize a simple element', function() {
        var domain = new hyperstore.DomainModel(store,"Test");

        var session = store.beginSession();
        var item = domain.create("Item");
        item.Num = 1000000000.5;
        item.Str = "a string with \t escape character like \' and \"";
        item.Flag = true;
        session.acceptChanges();
        var r = session.close();
        var txt = hyperstore.DomainSerializer.save(domain);
        expect(txt).to.not.be.undefined;

        var domain2 = new hyperstore.DomainModel(store,"Test2");
        domain2.loadFromJson(JSON.parse(txt));
    });

});
