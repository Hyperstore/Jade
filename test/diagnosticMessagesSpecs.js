var hyperstore = require('../lib/hyperstore.js');
var expect = require('chai').expect;

    describe('Diagnostic message formatting tests', function () {
        'use strict';
        var store = new hyperstore.Store();
        var schema = new hyperstore.Schema(store, 'Test');
        var librarySchema = new hyperstore.SchemaEntity(schema, 'Library');
        librarySchema.defineProperty('Name', 'string');

        var domain = new hyperstore.DomainModel(store, 'D');

        //Spec - 1
        it('Checks message formatting with element properties', function () {
            var mel = domain.createEntity(librarySchema, "Test:1");
            mel.Name = 'test';
            var msg = hyperstore.DiagnosticMessage.__format("Name prop {Name} Id={ id }", mel, null);
            expect(msg).to.equal('Name prop test Id=Test:1');
        });

    });

