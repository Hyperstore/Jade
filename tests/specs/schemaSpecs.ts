/// <reference path="../../scripts/typings/jasmine/jasmine.d.ts" />
/// <reference path="../../.built/hyperstore.d.ts" />

describe('Schema tests', function () {
    'use strict';

    var store = new Hyperstore.Store();
    var schema = new Hyperstore.Schema(store, 'Test');
    var librarySchema = new Hyperstore.SchemaEntity(schema, 'Library');

    it('create schema element', function () {

        expect(librarySchema).not.toBeNull();
        expect(librarySchema.id).toEqual('Test:Library');

        expect(store.getSchemaEntity('Library')).not.toBeNull();
        expect(store.getSchemaElement('Library')).not.toBeNull();
        expect(store.getSchemaElement('Test:Library')).not.toBeNull();

        expect(librarySchema.isA('Library')).toBeTruthy();
    });

    it('define schema properties', function() {

        librarySchema.defineProperty('Name', 'string', 'abcd');
        expect(librarySchema.getProperty('Name', true)).not.toBeNull();
        expect(librarySchema.getProperties(false).some(p=>p.name==='Name')).toBeTruthy();
        expect(librarySchema.getProperties(false).length).toEqual(1);
    });

    it('Schema inheritance', function() {

        var librarySchemaEx = new Hyperstore.SchemaEntity(schema, 'LibraryEx', librarySchema );

        librarySchemaEx.defineProperty('Address', 'string', 'xxxxx');
        expect(librarySchema.getProperty('Name', true)).not.toBeNull();
        expect(librarySchema.getProperty('Name', false)).toBeNull();
        expect(librarySchema.getProperty('Address', true)).not.toBeNull();

        expect(librarySchema.getProperties(true).some(p=>p.name==='Name')).toBeTruthy();
        expect(librarySchema.getProperties(true).some(p=>p.name==='Address')).toBeTruthy();
        expect(librarySchema.getProperties(false).length).toEqual(1);
        expect(librarySchema.getProperties(true).length).toEqual(2);

        expect(librarySchemaEx.isA('LibraryEx')).toBeTruthy();
        expect(librarySchemaEx.isA('Library')).toBeTruthy();
    });

});