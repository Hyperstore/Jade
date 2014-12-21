var Hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

describe('Schema inheritance tests', function () {
    'use strict';

    var store;
    var schema;
    var librarySchema;
    var librarySchemaEx;

    beforeEach( function() {
        store = new Hyperstore.Store();
        schema = new Hyperstore.Schema(store, 'Test');
        librarySchema = new Hyperstore.SchemaEntity(schema, 'Library');
        librarySchemaEx = new Hyperstore.SchemaEntity(schema, 'LibraryEx', librarySchema);
        librarySchemaEx.defineProperty('Address', 'string', 'xxxxx');
        librarySchema.defineProperty('Name', 'string', 'abcd');
    });

    it('Properties scope', function()
    {
        expect(librarySchemaEx.getProperty('Name', true)).to.not.be.undefined;
        expect(librarySchemaEx.getProperty('Name', false)).to.be.undefined;
        expect(librarySchemaEx.getProperty('Address', true)).to.not.be.undefined;
    });

    it('Properties count', function()
    {
        expect(librarySchemaEx.getProperties(false).length).to.equal(1);
        expect(librarySchemaEx.getProperties(true).length).to.equal(2);
    });

    it('Found properties', function()
    {
        expect(librarySchemaEx.getProperties(true).some(function (p) {return p.name === 'Name';})).to.be.true;
        expect(librarySchemaEx.getProperties(true).some(function(p) {return p.name === 'Address';})).to.be.true;
    });

    it('assert isA with inheritance', function()
    {
        expect(librarySchemaEx.isA('LibraryEx')).to.be.true;
        expect(librarySchemaEx.isA('Library')).to.be.true;
    });
});