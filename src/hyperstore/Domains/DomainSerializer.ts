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
        pushElement(name:string, id:string, schemaId:string, startId?:string, endStartId?:string, endId?:string, endSchemaId?:string);
        pushProperty(tag:string, name:string, value:any);
        reduceScope();
        save(domain:DomainModel, monikers:MonikerEntry[]):string;
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

        pushElement(name:string, id:string, schemaId:string, startId?:string, endStartId?:string, endId?:string, endSchemaId?:string) {

            var scope = this.stackHead();
            var node:any = {id:id, schema:schemaId};
            if( startId) {
                node.startId=startId;
                node.endStartId = endStartId;
                node.endId = endId;
                node.endSchemaId = endSchemaId;
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

        save(domain:DomainModel, monikers:MonikerEntry[]):string {
            var scope = this.stackHead();
            scope.domain = domain.name;
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
        private _domain:DomainModel;
        private _monikerSeq : number;

        constructor(domain:DomainModel) {
            this._writer = new JSONWriter();
            this._domain = domain;
            this._monikerSeq=0;
            this._monikers = new HashTable<string,MonikerEntry>();
        }

        static save(domain:DomainModel, entities?:ICursor, relationships?:ICursor):string {
            var ser = new DomainSerializer(domain);
            return ser.saveInternal( entities, relationships );
        }

        private saveInternal(entities?:ICursor, relationships?:ICursor):string {
            try {
                this.serializeEntities(entities || this._domain.getEntities());
                this.serializeRelationships(relationships || this._domain.getRelationships());
                return this._writer.save(this._domain, this._monikers.values);
            }
            finally {
                this._monikers = null;
            }
        }

        private serializeEntities(entities:ICursor) {
            this._writer.newScope("entities");
            while (entities.hasNext()) {
                var e = entities.next();
                var info = e.getInfo();
                this._writer.pushElement("entity", this.getId(info.id), this.getSchemaMoniker(info.schemaElement.id));
                this.serializeProperties(e);
            }
            this._writer.reduceScope();
        }

        private serializeRelationships(relationships:ICursor) {
            this._writer.newScope("relationships");
            while (relationships.hasNext()) {
                var relationship = relationships.next();
                var info = <IRelationshipMetadata>relationship.getInfo();
                var startSchema =
                this._writer.pushElement("relationship",
                    this.getId(info.id), this.getSchemaMoniker(info.schemaElement.id),
                    this.getId(info.startId), this.getSchemaMoniker(info.startSchemaId),
                    this.getId(info.endId), this.getSchemaMoniker(info.endSchemaId));
                this.serializeProperties(relationship);
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

        private serializeProperties(elem:ModelElement) {
            var schema = elem.getInfo().schemaElement;
            var properties = schema.getProperties(true);
            properties.forEach( (p:SchemaProperty) => {
                if( p.kind === PropertyKind.Calculated)
                    return;
                var v = elem.getPropertyValue(p);
                if( v )
                    this._writer.pushProperty("property", p.name, JSON.stringify(p.serialize(v)));
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