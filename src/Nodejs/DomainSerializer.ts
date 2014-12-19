/// <reference path="../../Scripts/typings/node/node.d.ts" />

import fs = require('fs');


export class FileDomainSerializer  {

    static save(domain:DomainModel, entities?:ICursor, relationships?:ICursor):Q.Promise<void> {
        var txt = DomainSerializer.save(domain, entities, relationships );
        return null;
    }

}
