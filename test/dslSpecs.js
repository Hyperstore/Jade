var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;
var schemaTest = require('./assets/schema_Test.js').schema;

'use strict';

describe('Dsl specs tests', function ()
{
    var store;

    beforeEach(function() {
        store = new hyperstore.Store();
        store.loadSchema(schemaTest);
    });

    it('should initialize store from the dsl', function() {
        store.createDomain({name:"test", data: {Library:{Name:"MyLibrary"}}});
        expect(store.getDomain('test')).to.not.be.undefined;
        expect(store.getSchemaElement('Library', false)).to.not.be.undefined;
    });

    it('should detect inheritance', function() {
        var domain = store.createDomain({name:"test", data: {Library:{Name:"MyLibrary", Books:[ {Title:"Book1"}, {Title:"SuperBook", isSuperBook:true}]}}});

        var lib = domain.root;
        expect(lib.Books.items.length).to.equal(2);
        expect(lib.Books.items[0].getSchemaElement().name).to.equal("Book");
        expect(lib.Books.items[1].getSchemaElement().name).to.equal("SuperBook");
    });
});
