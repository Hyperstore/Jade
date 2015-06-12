var hyperstore = require('hyperstore');

var store = new hyperstore.Store();

var jsdataSchema = require('./schemas/data.jade.js').schema;
var schema = store.loadSchema(jsdataSchema);

var domain = store.createDomain("MyDomain", schema);
var data = require('./data/data.json');
var elements = domain.loadFromJson(data);

var jsdataChanceSchema = require('./schemas/chance.jade.js').schema;
var chanceSchema = store.loadSchema(jsdataChanceSchema);

var scope = new hyperstore.DomainScope(domain, "ChanceScope");
var data = require('./data/data.chance.json');
scope.loadFromJson(data);

var entities = {};
scope.root.Data.Entities.forEach(function (x) {
    
    var entityName_s = x.name + 's';
    entities[entityName_s] = [];
    
    for (var i = 0; i < x.repeat; i++) {
        var json = {};
        
        x.Properties.forEach(function (y) {
            
            var qualifier = y.qualifier;
            if (!qualifier)
                return;
            
            json[y.name] = qualifier.qualify;
        });
        
        entities[entityName_s].push(json);
    }
});

console.log(JSON.stringify(entities, null, 2));

console.log("That\'s all folks !");
