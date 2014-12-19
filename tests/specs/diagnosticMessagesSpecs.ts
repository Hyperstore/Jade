/// <reference path="../../scripts/typings/jasmine/jasmine.d.ts" />
/// <reference path="../../lib/hyperstore.d.ts" />

    describe('Diagnostic message formatting tests', function () {
        'use strict';
        var store = new Store();
        var schema = new Hyperstore.Schema(store, 'Test');
        var librarySchema = new Hyperstore.SchemaEntity(schema, 'Library');
        librarySchema.defineProperty('Name', 'string');

        var domain = new Hyperstore.DomainModel(store, 'D');

        //Spec - 1
        it('Checks message formatting with element properties', function () {
            var mel = <any>domain.createEntity(librarySchema, "Test:1");
            mel.Name = 'test';
            var msg = Hyperstore.DiagnosticMessage.__format("Name prop {Name} Id={ id }", mel, null);
            expect(msg).toEqual('Name prop test Id=Test:1');
        });

    });

