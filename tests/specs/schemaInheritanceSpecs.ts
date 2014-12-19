/// <reference path="../../scripts/typings/jasmine/jasmine.d.ts" />
/// <reference path="../../lib/hyperstore.d.ts" />

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
        expect(librarySchemaEx.getProperty('Name', true)).not.toBeUndefined();
        expect(librarySchemaEx.getProperty('Name', false)).toBeUndefined();
        expect(librarySchemaEx.getProperty('Address', true)).not.toBeUndefined();
    });

    it('Properties count', function()
    {
        expect(librarySchemaEx.getProperties(false).length).toEqual(1);
        expect(librarySchemaEx.getProperties(true).length).toEqual(2);
    });

    it('Found properties', function()
    {
        expect(librarySchemaEx.getProperties(true).some(function (p) {return p.name === 'Name';})).toBeTruthy();
        expect(librarySchemaEx.getProperties(true).some(function(p) {return p.name === 'Address';})).toBeTruthy();
    });

    it('assert isA with inheritance', function()
    {
        expect(librarySchemaEx.isA('LibraryEx')).toBeTruthy();
        expect(librarySchemaEx.isA('Library')).toBeTruthy();
    });
});