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
module Hyperstore {

    interface ISerializerWriter {
        newScope(tag:string);
        pushElement(name:string, state:TrackingState, id:string, schemaId:string, startId?:string, endStartId?:string, endId?:string, endSchemaId?:string);
        pushProperty(tag:string, name:string, value:any);
        reduceScope();
        save(domain:Domain, monikers:MonikerEntry[]):string;
    }

    interface MonikerEntry {
        moniker:string;
        key:string;
        schemaName:string;
    }

    class JSONWriter implements ISerializerWriter {
        private _obj;
        private _stack;
        private _current;

        constructor() {
            this._stack=[];
            this._obj = {};
            this._stack.push(this._obj);
        }

        private stackHead() {
            return this._stack[this._stack.length-1];
        }

        newScope(tag:string) {
            var scope = this.stackHead()[tag] = [];
            this._stack.push(scope);
        }

        pushElement(name:string, state:TrackingState, id:string, schemaId:string, startId?:string, endStartId?:string, endId?:string, endSchemaId?:string) {

            var scope = this.stackHead();
            var node:any = {id:id, schema:schemaId};
            if(state === TrackingState.Removed) {
                node.state = "deleted";
            }
            else
            {
                if (startId)
                {
                    node.startId = startId;
                    node.endStartId = endStartId;
                    node.endId = endId;
                    node.endSchemaId = endSchemaId;
                }
            }
            scope.push(node);
            this._current = node;
        }

        pushProperty(tag:string, name:string, value:any) {
            var node:any = {name:name, value:value};
            if( !this._current.properties) {
                this._current.properties = [];
            }
            this._current.properties.push(node);
        }

        reduceScope() {
            this._stack.pop();
            this._current=null;
        }

        save(domain:Domain, monikers:MonikerEntry[]):string {
            var scope = this.stackHead();
            scope.domain = domain.name;
            scope.mode = "HY";
            var schemas = [];
            scope.schemas = schemas;
            var group = new HashTable<string,MonikerEntry[]>();
            Utils.forEach(monikers, m=> {
               var g = group.get(m.schemaName);
                if( !g) {
                    g = [];
                    group.add(m.schemaName,g);
                }
                g.push(m);
            });

            Utils.forEach(group.keys, schemaName=> {
                var elements = [];
                var s = {name:schemaName, elements:elements};
                schemas.push(s);
                var list = group.get(schemaName);
                Utils.forEach(list, m=> {
                    elements.push({id:m.moniker, name:m.key})
                });
            });

            return JSON.stringify(scope);
        }
    }

    export class DomainSerializer {
        private _monikers:HashTable<string,MonikerEntry>;
        private _writer:ISerializerWriter;
        private _domain:Domain;
        private _monikerSeq : number;

        /**
         * do not use directly - Use the static method save
         * @param domain
         */
        constructor(domain:Domain) {
            this._writer = new JSONWriter();
            this._domain = domain;
            this._monikerSeq=0;
            this._monikers = new HashTable<string,MonikerEntry>();
        }

        static save(domain:Domain, entities?:Cursor, relationships?:Cursor):string
        {
            if (!domain || !(
                domain instanceof Domain))
                throw "domain must be a valid instance of Domain";
            var ser = new DomainSerializer(domain);
            return ser.saveDomain(entities, relationships);
        }

        private saveDomain( entities?:Cursor, relationships?:Cursor) {
            var that = this;
            return this.saveInternal(
                (entities || this._domain.getEntities()).map(function(e) {
                    var info = e.getInfo();
                    return {
                        id:info.id,
                        schemaId :info.schemaElement.id,
                        properties: that.getPropertyValues(info.id, info.schemaElement)
                    }
                }),
                (relationships  || this._domain.getRelationships()).map(function(r) {
                    var info = <IRelationshipMetadata>r.getInfo();
                    return {
                        id:info.id,
                        schemaId :info.schemaElement.id,
                        startId:info.startId, startSchemaId:info.startSchemaId,
                        endId:info.endId, endSchemaId:info.endSchemaId,
                        properties: that.getPropertyValues(info.id, info.schemaElement)
                    }
                })
            );
        }

        private getPropertyValues(id:string, schema:SchemaElement) {
            var props = [];
            var properties = schema.getProperties(true);
            properties.forEach( (p:SchemaProperty) =>
                {
                    if (p.kind !== PropertyKind.Calculated)
                    {
                        var v = this._domain.getPropertyValue(id, p);
                        if (v)
                            props.push({name: p.name, value: JSON.stringify(p.serialize(v.value)), version:v.version});
                    }
                }
            );
            return props;
        }

        /**
         * Save only changes from a DomainScope
         * @param domain
         * @returns {string}
         */
        static saveChanges(domain:DomainScope) {
            if(!domain || !(domain instanceof DomainScope))
                throw "domain must be a valid instance of DomainScope";
            var ser = new DomainSerializer(domain);
            var changes = domain.getChanges();
            var that = this;
            var entities = changes.map(c=> {
                if(c.startId)
                    return;
                return {
                    id:c.id,
                    schemaId :c.schemaId,
                    state:c.state,
                    properties: DomainSerializer.preparePropertyValues(c.properties)
                }
            });
            var relationships = changes.map(c=> {
                if(!c.startId)
                    return;
                return {
                    id:c.id,
                    schemaId :c.schemaId,
                    state:c.state,
                    startId:c.startId,
                    startSchemaId:c.startSchemaId,
                    endId:c.endId,
                    endSchemaId:c.endSchemaId,
                    properties: DomainSerializer.preparePropertyValues(c.properties)
                }
            });
            return ser.saveInternal( entities, relationships );
        }

        private static preparePropertyValues(properties) {
            var props = [];
            for(var p in properties)
            {
                var pv = properties[p];
                props.push({name: p, value: pv.value, version:pv.version});
            }
            return props;
        }

        private saveInternal(entities?:Cursor, relationships?:Cursor):string {
            try {
                this.serializeEntities(entities );
                this.serializeRelationships(relationships);
                return this._writer.save(this._domain, this._monikers.values);
            }
            finally {
                this._monikers = null;
            }
        }

        private serializeEntities(entities:Cursor) {
            this._writer.newScope("entities");
            entities.reset();
            while (entities.hasNext()) {
                var e = entities.next();
                this._writer.pushElement("entity", e.state, this.getId(e.id), this.getSchemaMoniker(e.schemaId));
                this.serializeProperties(e);
            }
            this._writer.reduceScope();
        }

        private serializeRelationships(relationships:Cursor) {
            this._writer.newScope("relationships");
            relationships.reset();
            while (relationships.hasNext()) {
                var r = relationships.next();
                this._writer.pushElement("relationship", r.state,
                    this.getId(r.id), this.getSchemaMoniker(r.schemaId),
                    this.getId(r.startId), this.getSchemaMoniker(r.startSchemaId),
                    this.getId(r.endId), this.getSchemaMoniker(r.endSchemaId));
                this.serializeProperties(r);
            }
            this._writer.reduceScope();
        }

        private getSchemaMoniker(id:string) : string {
            var moniker = this._monikers.get(id);
            if( moniker ) return moniker.moniker;
            this._monikerSeq++;
            var parts = id.split(':');
            var monikerId = "" + this._monikerSeq;
            this._monikers.add(id, {moniker: monikerId, key:parts[1], schemaName:parts[0]});
            return monikerId;
        }

        private serializeProperties(elem) {
            elem.properties.forEach( p => {
                    this._writer.pushProperty("property", p.name, p.value);
            });
        }

        private getId(id:string) {
            var parts = id.split(':');
            if (parts[0] === this._domain.name)
                return parts[1];

            return id;
        }
    }
}