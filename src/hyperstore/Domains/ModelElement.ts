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
        domain:Domain;
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
    export class Element {
        private _info:IEntityMetadata;

        getInfo() {
            return this._info;
        }

        getId() {
            return this._info.id;
        }

        getDomain() {
            return this._info.domain;
        }

        getSchemaElement() {
            return this._info.schemaElement;
        }

        get isDisposed() : boolean {
            return !this._info || this._info.disposed;
        }

        toString() {
            var self = <any>this;
            return self.name || self.Name || self.Id || self._info.id;
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

        getKey(includeParentKey=false) : string {
            var empty = "";
            var keyProperties = this.getSchemaElement().getKeyProperties().toArray();
            if( keyProperties.length === 0) return;
            var keys = [];
            if(includeParentKey) {
                var parent = this.getParent();
                if (parent) {
                    var v = parent.getKey(true);
                    if (v) {
                        keys.push(v);
                        keys.push(".");
                    }
                }
            }
            keyProperties.forEach( p => keys.push(this.get(p)||empty));
            return keys.join("");
        }

        /**
         * get the parent container
         * @returns {Hyperstore.Element|Element}
         */
        getParent() : Element {
            var rel = this.getRelationships(undefined, Direction.Incoming).firstOrDefault( r => r.getSchemaElement().embedded );
            return rel ? rel.getStart() : undefined;
        }

        /**
         *
         * @param property
         * @returns {*}
         */
        get(property:SchemaProperty):any {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (typeof(property) === "string")
                property = this._info.schemaElement.getProperty(<any>property, true);
            if (!property)
                return undefined;

            var pv = this._info.domain.getPropertyValue(this._info.id, property);
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
        set(property:SchemaProperty, value:any) {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (typeof(property) === "string")
                property = this._info.schemaElement.getProperty(<any>property, true);

            return this._info.domain.setPropertyValue(this._info.id, property, value);
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
        __initialize(domain:Domain, id:string, schemaElement:SchemaElement, startId?:string, startSchemaId?:string, endId?:string, endSchemaId?:string) : IEntityMetadata {
            this._info = {
                disposed : false,
                domain : domain,
                schemaElement : schemaElement,
                id : id
                };
            return this._info;
        }

        /**
         * Initialize an element from a json object
         * @param obj - json object
         * @param refs - internal use only
         */
        loadFromJson(obj, refs?) {

            var melInfo = this.getInfo();
            var domain = melInfo.domain;

            if(typeof(obj) !== "object")
                throw "Unable to load a " + melInfo.schemaElement.name + " from data " + obj;

            this.getSchemaElement().onBefore({action:"Load", mel: this});

            refs = refs || {};

            for (var member in obj)
            {
                if (!obj.hasOwnProperty(member))
                    continue;

                var val = obj[member];
                var prop = melInfo.schemaElement.getProperty(member, true);
                if (prop)
                {
                    this.set(prop, prop.deserialize(new SerializationContext(
                                domain, melInfo.id, undefined, undefined, undefined, undefined, val))
                    );
                    continue;
                }

                var rel = melInfo.schemaElement.getReference(member, true);
                if (rel)
                {
                    var endSchema = domain.store.getSchemaEntity(rel.schemaRelationship.endSchemaId);
                    var values = Array.isArray(val) ? val : [val];

                    for (var i in values)
                    {
                        var v = values[i];
                        var elem:Element;
                        if (v.$ref)
                        {
                            elem = refs[v.$ref];
                        }
                        else
                        {
                            if (v.$id)
                            {
                                refs[v.$id] = elem;
                            }
                            if((<any>rel.schemaRelationship).loadFromJson)
                            {
                                var relationShip = (<any>rel.schemaRelationship).loadFromJson(this.getDomain(), this, v);
                                if(relationShip)
                                    continue;
                            }
                            // Loading in three steps
                            // 1) create element
                            // 2 create parent relationship
                            // 3) load element
                            var r = domain.__parseJson(v, endSchema, refs, this); // (step 1)
                            if(!r)
                                continue;
                        }

                        var src : Element = rel.opposite ? r.elem : this;
                        var end = rel.opposite ? this : r.elem;

                        var d = src.getInfo().domain;
                        if (!d.getRelationships(rel.schemaRelationship, src, end).hasNext() && end)
                        {
                            var endInfo = end.getInfo();
                            d.createRelationship(rel.schemaRelationship, src, endInfo.id, endInfo.schemaElement.id); // (step 2)
                        }

                        r.load(); // (step 3)
                    }
                }
            }

            this.getSchemaElement().onAfter({action:"Load", mel: this});
        }

        /**
         *
         * @param schemaElement
         * @param direction
         * @returns {Element[]}
         */
        getRelationships(schemaElement?:SchemaRelationship, direction:Direction = Direction.Outgoing): Cursor {
            var list;
            if ((direction & Direction.Outgoing) !== 0) {
                list = this._info.domain.getRelationships(schemaElement, this);
            }
            if ((direction & Direction.Incoming) !== 0) {
                var list2 = this._info.domain.getRelationships(schemaElement, undefined, this);
                if (list && list.any()) {
                    list =  list.concat(list2);
                }
                else
                    list = list2;
            }
            return list;
        }

        asJsonObject(cfg?)
        {
            var obj = this.getSchemaElement().serialize(this) || {};
            if( cfg && cfg.serializeId)
                (<any>obj).$id = this.getId();

            var self = this;
            this.getSchemaElement().getProperties(true).forEach(prop =>
                {
                    if( prop.kind !== PropertyKind.Normal)
                        return;
                    var val = this.get(prop);
                    if (val)
                    {
                        var value = prop.schemaProperty.serialize(val);
                        if (value)
                        {
                            obj[prop.name] = value;
                        }
                    }
                }
            );

            this.getRelationships().forEach(rel=>
                {
                    var rs = <SchemaRelationship>rel.getSchemaElement();
                    if (rs.startProperty)
                    {
                        var end = rel.getEnd();
                        if (!end || (end.getDomain().name !== self.getDomain().name && (cfg && cfg.localDomainOnly)))
                            return;

                        if (rs.embedded && self.getId() !== end.getId())
                        {
                            if (rs.cardinality === Cardinality.OneToOne)
                            {
                                obj[rs.startProperty] = end.asJsonObject(cfg);
                                return;
                            }
                            if (!obj[rs.startProperty]) obj[rs.startProperty] = [];
                            obj[rs.startProperty].push(end.asJsonObject(cfg));
                        }
                        else
                        {
                            if(!cfg || !cfg.serializeId)
                                throw "You must set 'serializedId' option to true to reference not embedded element.";

                            var id = end.getId();
                            if (rs.cardinality === Cardinality.OneToOne)
                            {
                                obj[rs.startProperty] = {$ref: id};
                                return;
                            }
                            if (!obj[rs.startProperty]) obj[rs.startProperty] = [];
                            obj[rs.startProperty].push({$ref: id});
                        }
                    }
                }
            );
            return obj;
        }

        dump(writer=console.log, indent:number=0) {
            var tab = "";
            for(var i=0;i<indent;i++)
                tab += " ";
            writer(tab + this._info.schemaElement.id + " " + this._info.id + " --------------");
            this.getSchemaElement().getProperties(true).forEach( prop => {
                if( prop.kind === PropertyKind.Normal)
                    writer(tab + " " + prop.name + " = " + this.get(prop));
            });

            var lastRelSchema;
            this.getRelationships().filter( rel=> rel.getSchemaElement().embedded).forEach( rel => {
                if( !lastRelSchema || lastRelSchema !== rel.getSchemaElement().id) {
                    lastRelSchema = rel.getSchemaElement().id;
                    writer(tab + " [" + rel.getSchemaElement().startProperty + "] :");
                }
                rel.getEnd().dump(writer, indent+2);
            });
        }
    }

    export class Entity extends Element {
        constructor(domain:Domain, schemaElement:SchemaEntity, id?:string, version?:number) {
            super();
            if(!domain)
                throw "Invalid domain argument on element ctor.";
            domain.create(schemaElement, id, version, this);
        }
    }

    export class Relationship extends Element {

        private __start:Element;
        private __end:Element;

        constructor(domain:Domain, schemaElement:SchemaRelationship, start:Element, end:Element, id?:string, version?:number) {
            super();
            if(!domain)
                throw "Invalid domain argument on element ctor.";
            domain.createRelationship(schemaElement, start, end.getId(), end.getSchemaElement().id, id, version, this);
        }

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
         * @returns {Element}
         */
        getStart():Element {
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
         * @returns {Element}
         */
        getEnd():Element {
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

        __initialize(domain:Domain, id:string, schemaElement:SchemaElement, startId?:string, startSchemaId?:string, endId?:string, endSchemaId?:string) : IEntityMetadata {
            var info = <IRelationshipMetadata>super.__initialize(domain, id, schemaElement);

            info.startId = startId;
            info.startSchemaId = startSchemaId;
            info.endId = endId;
            info.endSchemaId = endSchemaId;
            return info;
        }
    }

}