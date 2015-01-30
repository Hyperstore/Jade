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

    export interface IEntityMetadata {
        id:string;
        schemaElement:SchemaElement;
        domain:DomainModel;
        disposed:boolean;
    }

    export interface IRelationshipMetadata extends IEntityMetadata {
        startId:string;
        startSchemaId:string;
        endId:string;
        endSchemaId:string;
    }

    /**
     * Domain element
     */
    export class ModelElement {
        private _info:IEntityMetadata;

        getInfo() {
            return this._info;
        }

        getId() {
            return this._info.id;
        }

        getDomain() {
            var store = this._info.domain.store;
            if( !store.hasDomainExtensions) // optim
                return this._info.domain;

            return Session.current ? Session.current.getDomain(this._info.domain.name) : store.getDomain(this._info.domain.name);
        }

        getSchemaElement() {
            return this._info.schemaElement;
        }

        get isDisposed() : boolean {
            return !this._info || this._info.disposed;
        }

        /**
         *
         */
        dispose() {
            this._info.disposed = true;
            for (var p in this) {
                if (this.hasOwnProperty(p) && p.substr(0, 5) === "__ref") {
                    var prop = this[p];
                    if (prop && prop.dispose) {
                        prop.dispose();
                    }
                }
            }
        }

        /**
         * get the parent container
         * @returns {Hyperstore.ModelElement|ModelElement}
         */
        getParent() : ModelElement {
            var rel = this.getRelationships(undefined, Direction.Incoming).firstOrDefault( r => r.embedded );
            return rel ? rel.getStart() : undefined;
        }

        /**
         *
         * @param property
         * @returns {*}
         */
        getPropertyValue(property:SchemaProperty):any {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (typeof(property) === "string")
                property = this._info.schemaElement.getProperty(<any>property, true);
            if (!property)
                return undefined;

            var pv = this.getDomain().getPropertyValue(this._info.id, property);
            if (!pv) {
                return undefined;
            }
            return pv.value;
        }

        /**
         *
         * @param property
         * @param value
         * @returns {PropertyValue}
         */
        setPropertyValue(property:SchemaProperty, value:any) {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (typeof(property) === "string")
                property = this._info.schemaElement.getProperty(<any>property, true);

            return this.getDomain().setPropertyValue(this._info.id, property, value);
        }

        /**
         *
         * @param domain
         * @param id
         * @param schemaElement
         * @param startId
         * @param startSchemaId
         * @param endId
         * @param endSchemaId
         * @private
         */
        __initialize(domain:DomainModel, id:string, schemaElement:SchemaElement, startId?:string, startSchemaId?:string, endId?:string, endSchemaId?:string) : IEntityMetadata {
            this._info = {
                disposed : false,
                domain : domain,
                schemaElement : schemaElement,
                id : id
                };
            return this._info;
        }

        /**
         *
         * @returns {string}
         */
        /*stringify():string {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }

            var seen = [];
            var self = this;

            var json = JSON.stringify(
                this, function (k, v) {
                    if (k.length === 0 || !isNaN(parseInt(k)) || !v) {
                        return v;
                    }

                    switch (k) {
                        case "_id":
                            if (seen.indexOf(v) !== -1) {
                                return undefined;
                            }
                            seen.push(v);
                            return v;
                        case "_info":
                            return JSON.stringify( this._info.startId ?
                            {
                                id: this._info.id,
                                sch: this._info.schemaElement.id,
                                sid: this._info.startId,
                                ssid: this._info.startSchemaId,
                                eid: this._info.endId,
                                seid: this._info.endSchemaId
                            }:
                            {
                                id: this._info.id,
                                sch: this._info.schemaElement.id
                            });

                        case "startSchemaId":
                        case "endId":
                        case "endSchemaId":
                        case "$id":
                        case "schemaElement":
                        case "domain":
                        case "start":
                        case "end":
                        case "_start":
                        case "_end":
                            return undefined;
                    }

                    var schema = self.getInfo().schemaElement;
                    var p = schema.getProperty(k, true);
                    if (!p) {
                        var r = schema.getReference(k, true);

                        if (r && (
                            !r.opposite && r.schemaRelationship.startProperty ||
                            r.opposite && r.schemaRelationship.endProperty )) {
                            if (r.schemaRelationship.cardinality === Cardinality.ManyToMany ||
                                !r.opposite && r.schemaRelationship.cardinality === Cardinality.OneToMany
                                || r.opposite && r.schemaRelationship.cardinality === Cardinality.ManyToOne) {
                                return Utils.select(
                                    v.items, i => seen.indexOf(i.id) === -1
                                        ? i
                                        : {$id: i.id}
                                );
                            }

                            return seen.indexOf(v.id) === -1
                                ? v
                                : {$id: v.id};
                        }

                        return undefined;
                    }
                    return p.kind === PropertyKind.Calculated ? undefined : p.serialize(v);
                }
            );

            return json;
        }*/

        /**
         *
         * @param schemaElement
         * @param direction
         * @returns {ModelElement[]}
         */
        getRelationships(schemaElement?:SchemaRelationship, direction:Direction = Direction.Outgoing): Cursor {
            var list;
            if ((direction & Direction.Outgoing) !== 0) {
                list = this.getDomain().getRelationships(schemaElement, this);
            }
            if ((direction & Direction.Incoming) !== 0) {
                var list2 = this.getDomain().getRelationships(schemaElement, undefined, this);
                if (list && list.any()) {
                    list =  list.concat(list2);
                }
            }
            return list;
        }
    }

    export class ModelRelationship extends ModelElement {

        private __start:ModelElement;
        private __end:ModelElement;

        getStartId() {
            return (<IRelationshipMetadata>this.getInfo()).startId;
        }

        getStartSchemaElementId() {
            return (<IRelationshipMetadata>this.getInfo()).startSchemaId;
        }

        getEndId() {
            return (<IRelationshipMetadata>this.getInfo()).endId;
        }

        getEndSchemaElementId() {
            return (<IRelationshipMetadata>this.getInfo()).endSchemaId;
        }

        /**
         *
         * @returns {ModelElement}
         */
        getStart():ModelElement {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (this.__start === undefined) {
                var info = <IRelationshipMetadata>this.getInfo();
                if( info.startId )
                    this.__start = this.getDomain().store.get(info.startId);
            }
            return this.__start;
        }

        /**
         *
         * @returns {ModelElement}
         */
        getEnd():ModelElement {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }

            if (this.__end === undefined) {
                var info = <IRelationshipMetadata>this.getInfo();
                if( info.endId )
                    this.__end = this.getDomain().store.get(info.endId);
            }
            return this.__end;
        }

        __initialize(domain:DomainModel, id:string, schemaElement:SchemaElement, startId?:string, startSchemaId?:string, endId?:string, endSchemaId?:string) : IEntityMetadata {
            var info = <IRelationshipMetadata>super.__initialize(domain, id, schemaElement);

            info.startId = startId;
            info.startSchemaId = startSchemaId;
            info.endId = endId;
            info.endSchemaId = endSchemaId;
            return info;
        }
    }

}