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

/// <reference path="../../.built/dist/hyperstore.d.ts"/>
/// <reference path="../../Scripts/typings/Q/Q.d.ts" />
    /**
     * Persistence adapter for IndexedDb.
     *
     */
    export class IndexedDbAdapter extends Hyperstore.Adapter
    {
        private static DB_NAME = "_HY$DB";
        private indexedDB;

        /**
         * Create a new instance of IndexedDbAdapter
         */
        constructor()
        {
            super();

            this.indexedDB = indexedDB || this.indexedDB ||
            (<any>window).webkitIndexedDB ||
            (<any>window).mozIndexedDB ||
            (<any>window).OIndexedDB ||
            (<any>window).msIndexedDB;
        }

        // todo a revoir (ouverture une fois ou pas)
        private open(): Q.Promise<any> {
            var self = this;
            var q = Q.defer<any>();

            var request = self.indexedDB.open(self.domain.name, 3);
            request.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(IndexedDbAdapter.DB_NAME)) {
                    db.createObjectStore(IndexedDbAdapter.DB_NAME, {autoIncrement: false, keyPath: "id"});
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

        persistElements(s:Hyperstore.Session, elements:Hyperstore.ITrackedElement[])
        {
            var self = this;
            var r = s.result;

            var q = Q.defer<any>();
            r.addPromise(q);
            this.open().then(function(db) {
                var trx = db.transaction([IndexedDbAdapter.DB_NAME], "readwrite");
                var ostore = trx.objectStore(IndexedDbAdapter.DB_NAME);
                q.resolve(this);
                elements.forEach(
                    function (element:Hyperstore.ITrackedElement) {
                        var key = Hyperstore.Utils.splitIdentity(element.id)[1];
                        switch (element.state) {
                            case Hyperstore.TrackingState.Added:
                                var data:any = {id:key, schema: element.schemaId, version: element.version};
                                if (element.startId) {
                                    data.startId = element.startId;
                                    data.endId = element.endId;
                                    data.endSchemaId = element.endSchemaId;
                                }
                                ;
                                ostore.put(data);

                            case Hyperstore.TrackingState.Updated:
                                if (element.properties) {
                                    var schemaElement = self.domain.store.getSchemaElement(element.schemaId);
                                    for (var pn in element.properties) {
                                        var pv = element.properties[pn];
                                        if (pv && pv.value) {
                                            var ps = schemaElement.getProperty(pn, true);
                                            var data:any = {va: ps.serialize(pv.value), ve: pv.version, id:key + pn};
                                            ostore.put(data);
                                        }
                                    }
                                }
                                break;

                            case Hyperstore.TrackingState.Removed:
                                ostore.delete(key);
                                var schemaElement = self.domain.store.getSchemaElement(element.schemaId);

                                Hyperstore.Utils.forEach(
                                    schemaElement.getProperties(true), function (p:Hyperstore.SchemaProperty) {
                                        ostore.delete(key + p.name);
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
        loadElementsAsync(filter?:(id, schemaId) => boolean):Q.Promise<Hyperstore.SessionResult>
        {
            var self = this;
            var defer = Q.defer<Hyperstore.SessionResult>();
            this.open().then(function(db) {
                var trx = db.transaction([IndexedDbAdapter.DB_NAME]);
                var ostore = trx.objectStore(IndexedDbAdapter.DB_NAME);
                var entities = [];
                var relationships = [];

                var dl = self.domain.name.length;

                ostore.openCursor().onsuccess = function (e) {
                    var cursor = (<any>e.target).result;
                    if (cursor) {
                        var data = cursor.value;
                        if (data.schema) {
                            if (!filter || filter(data.id, data.schema)) {
                                data.id = self.domain.name + Hyperstore.Store.IdSeparator + cursor.key;
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
                        var session = self.domain.store.beginSession({mode: Hyperstore.SessionMode.Loading});
                        try {
                            // entities
                            for (var i = 0; i < entities.length; i++) {
                                var data = entities[i];
                                var s = self.domain.store.getSchemaEntity(data.schema);
                                self.domain.create(s, data.id, data.version);
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

        private loadProperties(id, schema:Hyperstore.SchemaElement, ostore:IDBObjectStore)
        {
            var self = this;
            var ctx = new Hyperstore.SerializationContext(self.domain, id);
            schema.getProperties(true).forEach(
                function (p:Hyperstore.SchemaProperty)
                {
                    var key = Hyperstore.Utils.splitIdentity(id)[1];
                    var rq = ostore.get(key + p.name);
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