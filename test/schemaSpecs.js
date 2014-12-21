var Hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

describe('Schema tests', function () {
    'use strict';

    var store;
    var schema;
    var librarySchema;

    beforeEach( function() {
         store = new Hyperstore.Store();
         schema = new Hyperstore.Schema(store, 'Test');
         librarySchema = new Hyperstore.SchemaEntity(schema, 'Library');
    });

    it('should exists', function ()
    {
        expect(librarySchema).to.not.be.undefined;
    });

    it('should have a valid id', function()
    {
        expect(librarySchema.id).to.equal('Test:Library');
    });

    it('can be found with its simple name', function()
    {
        expect(store.getSchemaEntity('Library')).to.not.be.undefined;
        expect(store.getSchemaElement('Library')).to.not.be.undefined;
        expect(store.getSchemaElement('Test:Library')).to.not.be.undefined;
    });

    it('assert is library', function()
    {
        expect(librarySchema.isA('Library')).to.be.true;
    });

    it('define schema properties', function() {
        librarySchema.defineProperty('Name', 'string', 'abcd');

        expect(librarySchema.getProperty('Name', true)).to.not.be.undefined;
        expect(librarySchema.getProperties(false).some(function(p) {return p.name==='Name';})).to.be.true;
        expect(librarySchema.getProperties(false).length).to.equal(1);
        expect(librarySchema.getProperty('Name', true).defaultValue).to.equal('abcd');
    });
});