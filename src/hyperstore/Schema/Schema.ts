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

module Hyperstore
{
    /**
     * interface for schema definition
     */
    export interface ISchemaDefinition
    {
        /**
         * create all schema elements with theirs constraints
         * @param schema - current schema
         */
        defineSchema(schema:Schema);
    }

    /**
     * Property constraint condition signature
     */
    export interface ICheckValueObjectConstraint
    {
        /**
         *
         * @param value - new value
         * @param oldValue - old value
         * @param ctx - [[ConstraintContext]]
         */
        check(value, oldValue, ctx:ConstraintContext);
    }

    /**
     * Property constraint condition signature
     */
    export interface IValidateValueObjectConstraint
    {
        /**
         *
         * @param value - new value
         * @param oldValue - old value
         * @param ctx - [[ConstraintContext]]
         */
        validate(value, oldValue, ctx:ConstraintContext);
    }

    /**
     * Kind of schema element
     */
    export enum SchemaKind
    {
        Entity,
        Relationship,
        ValueObject,
        Primitive
    }

    /**
     * Relationship cardinality
     */
    export enum Cardinality
    {
        OneToOne = 0,
        OneToMany = 1,
        ManyToOne = 2,
        ManyToMany = 3
    }

    /**
     * Serialization context
     */
    export class SerializationContext
    {
        /**
         *
         * @param domain
         * @param id
         * @param startId
         * @param startSchemaId
         * @param endId
         * @param endSchemaId
         * @param value
         */
        constructor(
            public domain:Domain, public id:string, public startId?:string, public startSchemaId?:string,
            public endId?:string, public endSchemaId?:string, public value?:any)
        {
        }

    }

    /**
     * Property kind. See [[SchemaElement.defineProperty]]
     */
    export enum PropertyKind
    {
        Normal,
        Calculated
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export interface IReference
    {
        name: string;
        opposite: boolean;
        schemaRelationship: SchemaRelationship;
        isCollection: boolean;
    }

    /**
     *
     */
    export class Schema
    {
        public constraints:ConstraintsManager;

        private _elements: HashTable<string,SchemaInfo>;
        public root : SchemaEntity;

        constructor(public store:Store, public name?:string, def?:ISchemaDefinition)
        {
            this._elements = new HashTable<string,SchemaInfo>();
            this.constraints = new ConstraintsManager(this);
            if (def && def.defineSchema)
            {
                def.defineSchema(this);
            }
            store.__addSchema(name, this);
        }

        __clone(store:Store) : Schema {
            var sch = new Schema(store, this.name);
            sch.root = this.root;
            this._elements.forEach( e => sch.__addSchemaElement(e));
            sch.constraints = new Hyperstore.ConstraintsManager(sch, this.constraints);
            return sch;
        }

        /**
         * get all schema elements
         * @returns {Hyperstore.Cursor}
         */
        getSchemaElements() : Cursor {
            return new MapCursor(this._elements, s => s);
        }

        getSchemaEntities() : Cursor {
            return new MapCursor(this._elements, (s:SchemaInfo) => s.kind === SchemaKind.Entity ?  s : undefined);
        }

        getSchemaRelationships(start?:SchemaElement, end?:SchemaElement) : Cursor {
            return new MapCursor(this._elements, (s:SchemaInfo) => {
                if(s.kind !== SchemaKind.Relationship) return;
                if( start && (<any>s).startProperty !== start.id) return;
                if( end && (<any>s).endProperty !== end.id) return;
                return s;
            });
        }

        private _getSimpleName(id:string) {
            var pos = id.indexOf(':');
            return pos < 0 ? id : id.substr(pos + 1);
        }

        __addSchemaElement(schemaInfo:SchemaInfo)
        {
            var id = schemaInfo.id.toLowerCase();
            var simpleName = this._getSimpleName(id);
            if( this._elements.keyExists(simpleName))
                throw "Duplicate schema name " + id;
            this._elements.add(simpleName, schemaInfo);
            this.store.__addSchemaElement(schemaInfo);

            // Calculate schema root
            // Roots = elements which are not a target element of any relationships
            if( schemaInfo.kind == SchemaKind.Entity && !this.root) {
                this.root = <SchemaEntity>schemaInfo;
            }
        }
    }
}