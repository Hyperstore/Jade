/// <reference path="../../.built/dist/hyperstore.d.ts"/>
/// <reference path="../../Scripts/typings/node/node.d.ts" />

import fs = require('fs');


export class FileDomainSerializer  {

    static save(filePath:string, domain:Hyperstore.DomainModel, entities?:Hyperstore.Cursor, relationships?:Hyperstore.Cursor):Q.Promise<any> {
        var txt = Hyperstore.DomainSerializer.save(domain, entities, relationships );
        var defer = Q.defer<any>();
        fs.writeFile(filePath, txt, {encoding:'utf8'}, function(err) {
            if( err )
                defer.reject(err);
            else
                defer.resolve(true);
        })
        return defer.promise;
    }

    static load(filePath:string, domain:Hyperstore.DomainModel) : Q.Promise<any> {
        var defer = Q.defer<any>();
        fs.readFile(filePath, 'utf8', function(err, data) {
          if( err )
            defer.reject(err);
            else {
              domain.loadFromJson(JSON.parse(data));
              defer.resolve(domain);
          }
        });
        return defer.promise;
    }
}
