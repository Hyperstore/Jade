/// <reference path="../../Scripts/typings/node/node.d.ts" />

import fs = require('fs');


export class FileDomainSerializer  {

    static save(filePath:string, domain:DomainModel, entities?:ICursor, relationships?:ICursor):Q.Promise<any> {
        var txt = DomainSerializer.save(domain, entities, relationships );
        var defer = Q.defer<any>();
        fs.writeFile(filePath, txt, {encoding:'utf8'}, function(err) {
            if( err )
                defer.reject(err);
            else
                defer.resolve(true);
        })
        return defer.promise;
    }

    static load(filePath:string, domain:DomainModel) : Q.Promise<any> {
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
