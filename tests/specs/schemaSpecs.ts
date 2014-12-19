/// <reference path="../../scripts/typings/jasmine/jasmine.d.ts" />
/// <reference path="../../lib/hyperstore.d.ts" />


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
        expect(librarySchema).not.toBeUndefined();
    });

    it('should have a valid id', function()
    {
        expect(librarySchema.id).toEqual('Test:Library');
    });

    it('can be found with its simple name', function()
    {
        expect(store.getSchemaEntity('Library')).not.toBeUndefined();
        expect(store.getSchemaElement('Library')).not.toBeUndefined();
        expect(store.getSchemaElement('Test:Library')).not.toBeUndefined();
    });

    it('assert is library', function()
    {
        expect(librarySchema.isA('Library')).toBeTruthy();
    });

    it('define schema properties', function() {
        librarySchema.defineProperty('Name', 'string', 'abcd');

        expect(librarySchema.getProperty('Name', true)).not.toBeUndefined();
        expect(librarySchema.getProperties(false).some(function(p) {return p.name==='Name';})).toBeTruthy();
        expect(librarySchema.getProperties(false).length).toEqual(1);
        expect(librarySchema.getProperty('Name', true).defaultValue).toEqual('abcd');
    });
});