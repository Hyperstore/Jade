var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;
var schemaTest = require('./schema_Test.js').schema;

'use strict';

describe('Schema tests', function ()
{
    var store;

    beforeEach(function() {
        store = new hyperstore.Store();
        store.loadSchemas(schemaTest);
        store.createDomain({name:"test", data: {Library:{Name:"MyLibrary"}}});
    });

    it('should initialize store from the dsl', function() {
        expect(store.getDomain('test')).to.not.be.undefined;
        expect(store.getSchemaElement('Library', false)).to.not.be.undefined;
    });
});
