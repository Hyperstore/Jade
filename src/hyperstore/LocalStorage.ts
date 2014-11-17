//	Copyright 2013 - 2014, Alain Metge. All rights reserved. 
//
//		This file is part of hyperstore (http://www.hyperstore.org)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/// <reference path="Adapters.ts" />
module Hyperstore
{
    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class LocalStorageAdapter extends Adapter
    {
        private static PREFIX = "HY$:";

        clearAsync()
        {
            var defer = $.Deferred();

            var dl = this.domain.name.length;
            for (var i = 0; i < localStorage.length; i++)
            {
                var key = localStorage.key(i);
                if (!key || key.length < LocalStorageAdapter.PREFIX.length)
                {
                    continue;
                }

                if (key.substr(LocalStorageAdapter.PREFIX.length, dl) !== this.domain.name)
                {
                    continue;
                }
                localStorage.removeItem(key);
            }

            defer.resolve();
            return defer.promise();
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        persistElements(s:Session, elements:Queryable<ITrackedElement>)
        {
            if (!localStorage) return;
            var self = this;

            if (this.reset)
            {
                this.clearAsync();
            }

            elements.forEach(function (element:ITrackedElement)
            {
                switch (element.state)
                {
                    case TrackingState.Added:
                        var data:any = {schema: element.schemaId, version: element.version};
                        if (element.startId)
                        {

                            data.startId = element.startId;
                            data.endId = element.endId;
                            data.endSchemaId = element.endSchemaId;
                        }
                        ;
                        localStorage.setItem(LocalStorageAdapter.PREFIX + element.id, JSON.stringify(data));

                    case TrackingState.Updated:
                        if (element.properties)
                        {
                            var schemaElement = self.domain.store.getSchemaElement(element.schemaId);

                            element.properties.forEach(function (pv, pn)
                            {
                                if (pv && pv.value)
                                {
                                    var ps = schemaElement.getProperty(pn, true);
                                    var data:any = {va: ps.serialize(pv.value), ve: pv.version};
                                    localStorage.setItem(LocalStorageAdapter.PREFIX + element.id + pn, JSON.stringify(data));
                                }
                            });
                        }
                        break;

                    case TrackingState.Removed:
                        localStorage.removeItem(LocalStorageAdapter.PREFIX + element.id);
                        var schemaElement = self.domain.store.getSchemaElement(element.schemaId);

                        Utils.forEach(schemaElement.getProperties(true), function (p:SchemaProperty)
                        {
                            localStorage.removeItem(LocalStorageAdapter.PREFIX + element.id + p.name);
                        });
                        break;
                }
            });
        }

        /**
         *
         * @param filter
         * @returns {Promise<SessionResult>}
         */
        loadElementsAsync(filter?:(id, schemaId) => boolean):Promise
        {
            var promise = new Promise();

            var session = this.domain.store.beginSession({mode: SessionMode.Loading});
            try
            {
                var entities = [];
                var relationships = [];

                var dl = this.domain.name.length;
                for (var i = 0; i < localStorage.length; i++)
                {
                    var key = localStorage.key(i);
                    if (!key || key.length < LocalStorageAdapter.PREFIX.length)
                    {
                        continue;
                    }

                    key = key.substr(LocalStorageAdapter.PREFIX.length);
                    if (key.substr(0, dl) !== this.domain.name)
                    {
                        continue;
                    }

                    var data = JSON.parse(localStorage.getItem(key));
                    if (!data || !data.schema) // property value
                    {
                        continue;
                    }

                    if (filter && !filter(data.id, data.schema))
                    {
                        continue;
                    }

                    data.id = key;
                    if (data.startId)
                    {
                        relationships.push(data);
                    }
                    else
                    {
                        entities.push(data);
                    }
                }

                // entities
                for (var i = 0; i < entities.length; i++)
                {
                    var data = entities[i];
                    var s = this.domain.store.getSchemaEntity(data.schema);
                    this.domain.createEntity(s, data.id, data.version);
                    this.loadProperties(data.id, s);
                }

                for (var i = 0; i < relationships.length; i++)
                {
                    var data = relationships[i];
                    var rs = this.domain.store.getSchemaRelationship(data.schema);
                    var start = this.domain.getElement(data.startId);
                    this.domain.createRelationship(rs, start, data.endId, data.endSchemaId, data.id, data.version);
                    this.loadProperties(data.id, rs);
                }
                session.acceptChanges();
            }
            finally
            {
                promise.resolve(session.close());
            }
            return promise;
        }

        private loadProperties(id, schema:SchemaElement)
        {
            var self = this;
            var ctx = new SerializationContext(self.domain, id);
            Utils.forEach(schema.getProperties(true), function (p:SchemaProperty)
            {
                var data = localStorage.getItem(id + p.name);
                if (data)
                {
                    data = JSON.parse(data);
                    ctx.value = data.va;
                    self.domain.setPropertyValue(id, p, p.deserialize(ctx), data.ve);
                }
            });
        }
    }
}