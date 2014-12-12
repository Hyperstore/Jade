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

/// <reference path="../_references.ts" />
/// <reference path="../../../Scripts/typings/Q/Q.d.ts" />
module Hyperstore
{

    /**
     * Persistence adapter for IndexedDb.
     *
     */
    export class IndexedDbAdapter extends Adapter
    {
        private static DB_NAME = "HY$DB";
        private indexedDB;

        /**
         * Create a new instance of IndexedDbAdapter
         */
        constructor()
        {
            super();

            this.indexedDB = indexedDB || this.indexedDB || (
                <any>window).webkitIndexedDB ||
            (
                <any>window).mozIndexedDB || (
                <any>window).OIndexedDB ||
            (
                <any>window).msIndexedDB;
        }

        // todo a revoir (ouverture une fois ou pas)
        private open(): Q.Promise<any> {
            var self = this;
            var q = Q.defer<any>();

            var request = self.indexedDB.open(self.domain.name, 2);
            request.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(IndexedDbAdapter.DB_NAME)) {
                    db.createObjectStore(IndexedDbAdapter.DB_NAME, {autoIncrement: false});
                }
                // https://groups.google.com/a/chromium.org/forum/?fromgroups=#!topic/chromium-html5/VlWI87JFKMk[1-25-false]
                e.target.transaction.oncomplete = function (e) {
                    q.resolve( db );
                };
            };
            request.onsuccess = function (e) {
                var db = e.target.result;
                if (self.reset) {
                    var trx = db.transaction([IndexedDbAdapter.DB_NAME], "readwrite");
                    var ostore = trx.objectStore(IndexedDbAdapter.DB_NAME);
                    var rq = ostore.clear();
                    rq.onsuccess = e => q.resolve(self);
                    rq.onerror = e => q.reject(e);
                }
                else {
                    q.resolve(db);
                }
            };
            request.onerror = function (e) {
                q.reject(e);
            }

            return q.promise;
        }

        persistElements(s:Session, elements:ITrackedElement[])
        {
            var self = this;
            var r = Session.current.result;

            var q = Q.defer<any>();
            r.addPromise(q);
            this.open().then(function(db) {
                var trx = db.transaction([IndexedDbAdapter.DB_NAME], "readwrite");
                var ostore = trx.objectStore(IndexedDbAdapter.DB_NAME);
                q.resolve(this);
                elements.forEach(
                    function (element:ITrackedElement) {
                        switch (element.state) {
                            case TrackingState.Added:
                                var data:any = {schema: element.schemaId, version: element.version};
                                if (element.startId) {
                                    data.startId = element.startId;
                                    data.endId = element.endId;
                                    data.endSchemaId = element.endSchemaId;
                                }
                                ;
                                ostore.add(data, element.id);

                            case TrackingState.Updated:
                                if (element.properties) {
                                    var schemaElement = self.domain.store.getSchemaElement(element.schemaId);
                                    for (var pn in element.properties) {
                                        var pv = element.properties[pn];
                                        if (pv && pv.value) {
                                            var ps = schemaElement.getProperty(pn, true);
                                            var data:any = {va: ps.serialize(pv.value), ve: pv.version};
                                            ostore.put(data, element.id + pn);
                                        }
                                    }
                                }
                                break;

                            case TrackingState.Removed:
                                ostore.delete(element.id);
                                var schemaElement = self.domain.store.getSchemaElement(element.schemaId);

                                Utils.forEach(
                                    schemaElement.getProperties(true), function (p:SchemaProperty) {
                                        ostore.delete(element.id + p.name);
                                    }
                                );
                                break;
                        }
                    }
                );
            });
        }

        /**
         * load elements from the IndexedDb database
         * @param filter - function to filter element
         * @returns - a promise returning a [[SessionResult]]
         */
        loadElementsAsync(filter?:(id, schemaId) => boolean):Q.Promise<SessionResult>
        {
            var self = this;
            var defer = Q.defer<SessionResult>();
            this.open().then(function(db) {
                var trx = db.transaction([IndexedDbAdapter.DB_NAME]);
                var ostore = trx.objectStore(IndexedDbAdapter.DB_NAME);
                var entities = [];
                var relationships = [];

                var dl = this.domain.name.length;

                ostore.openCursor().onsuccess = function (e) {
                    var cursor = (<any>e.target).result;
                    if (cursor) {
                        var data = cursor.value;
                        if (data.schema) {
                            if (!filter || filter(data.id, data.schema)) {
                                data.id = cursor.key;
                                if (data.startId) {
                                    relationships.push(data);
                                }
                                else {
                                    entities.push(data);
                                }
                            }
                        }
                        cursor.continue();
                    }
                    else {
                        var session = self.domain.store.beginSession({mode: SessionMode.Loading});
                        try {
                            // entities
                            for (var i = 0; i < entities.length; i++) {
                                var data = entities[i];
                                var s = self.domain.store.getSchemaEntity(data.schema);
                                self.domain.createEntity(s, data.id, data.version);
                                self.loadProperties(data.id, s, ostore);
                            }

                            for (var i = 0; i < relationships.length; i++) {
                                var data = relationships[i];
                                var rs = self.domain.store.getSchemaRelationship(data.schema);
                                var start = self.domain.get(data.startId);
                                if (start) {
                                    self.domain.createRelationship(
                                        rs, start, data.endId, data.endSchemaId, data.id, data.version
                                    );
                                    self.loadProperties(data.id, rs, ostore);
                                }
                            }
                            session.acceptChanges();
                        }
                        finally {
                            defer.resolve(session.close());
                        }
                    }
                }
            }
            );
            return defer.promise;
        }

        private loadProperties(id, schema:SchemaElement, ostore:IDBObjectStore)
        {
            var self = this;
            var ctx = new SerializationContext(self.domain, id);
            schema.getProperties(true).forEach(
                function (p:SchemaProperty)
                {
                    var rq = ostore.get(id + p.name);
                    rq.onsuccess = r =>
                    {
                        var data = rq.result;
                        if (data)
                        {
                            ctx.value = data.va;
                            self.domain.setPropertyValue(id, p, p.deserialize(ctx), data.ve);
                        }
                    };
                }
            );
        }
    }
}