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

module Hyperstore
{

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export interface ISchemaDefinition
    {
        defineSchema(schema:Schema);
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export interface ICheckValueObjectConstraint
    {
        check(value, oldValue, ctx:ConstraintContext);
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export interface IValidateValueObjectConstraint
    {
        validate(value, oldValue, ctx:ConstraintContext);
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export enum SchemaKind
    {
        Entity,
        Relationship,
        ValueObject,
        Primitive
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export enum Cardinality
    {
        OneToOne = 0,
        OneToMany = 1,
        ManyToOne = 2,
        ManyToMany = 3
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class SerializationContext
    {
        constructor(public domain:DomainModel, public id:string, public startId?:string, public startSchemaId?:string, public endId?:string, public endSchemaId?:string, public value?:any)
        {
        }

    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export enum PropertyKind
    {
        Normal,
        Calculated
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class SchemaProperty
    {
        public owner:SchemaElement;

        constructor(public name:string, public schemaProperty:SchemaInfo, public defaultValue?:any, public kind:PropertyKind = PropertyKind.Normal)
        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        {
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        deserialize(ctx:SerializationContext):any
        {
            return ctx.value && this.schemaProperty.deserialize(ctx);
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        serialize(value:string):any
        {
            return value && this.schemaProperty.serialize(value);
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        addConstraint(message:string, condition:(val, old, ctx:ConstraintContext) => boolean, asError:boolean, kind:ConstraintKind = ConstraintKind.Validate):SchemaProperty
        {
            this.owner.schema.constraints.addPropertyConstraint(this, condition, message, asError, kind);
            return this;
        }
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

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class Schema
    {
        public constraints:ConstraintsManager;

        constructor(public store:Store, public name?:string, def?:ISchemaDefinition)
        {
            this.constraints = new ConstraintsManager(this);
            if (def)
            {
                def.defineSchema(this);
            }
        }

        __addSchemaElement(schemaInfo:SchemaInfo)
        {
            this.store.__addSchemaElement(schemaInfo);
        }

        dispose()
        {

        }
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class SchemaInfo
    {

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(public schema:Schema, public kind:SchemaKind, public id:string)
        {
            if (schema.name)
            {
                if( id.indexOf('.') <= 0 || id.substr(0, schema.name.length) !== schema.name)
                {
                    this.id = schema.name + ":" + id;
                }
                else
                {
                    this.id = schema.name + ":"  + id.substr(schema.name.length + 1);
                }
            }
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        deserialize(ctx:SerializationContext):any
        {
            return ctx.value;
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        serialize(value:any):any
        {
            return value;
        }
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class SchemaValueObject extends SchemaInfo
    {

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(schema:Schema, id:string, validate:(newValue, oldValue, ctx:ConstraintContext) => void, checkConstraint:boolean = true)
        {
            super(schema, SchemaKind.ValueObject, id);
            if (validate)
            {
                if (checkConstraint)
                {
                    this["check"] = validate;
                }
                else
                {
                    this["validate"] = validate;
                }
            }
            schema.__addSchemaElement(this);
        }
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class Primitive extends SchemaValueObject
    {
        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(schema:Schema, id:string, validate?:(newValue, oldValue, ctx:ConstraintContext) => void, checkConstraint:boolean = true)
        {
            super(schema, id, validate, checkConstraint);
            this.kind = SchemaKind.Primitive;
        }
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class SchemaElement extends SchemaInfo
    {
        private _properties;
        private _references;
        private proto;

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(schema:Schema, kind:SchemaKind, id:string, public baseElement?:SchemaElement)
        {
            super(schema, kind, id);
            this._properties = {};
            this._references = {};
            this.proto = Object.create(baseElement
                ? baseElement.proto
                : ModelElement.prototype);
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        getProperties(recursive:boolean):SchemaProperty[]
        {
            var list = [];
            Utils.forEach(this._properties, function (v) { list.push(v) });
            if (recursive && this.baseElement)
            {
                list = list.concat(this.baseElement.getProperties(true));
            }
            return list;
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        private _getReferences(recursive:boolean):IReference[]
        {
            var list = [];
            Utils.forEach(this._references, function (v) { list.push(v) });
            if (recursive && this.baseElement)
            {
                list = list.concat(this.baseElement._getReferences(true));
            }
            return list;
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        getReference(name:string, recursive:boolean):IReference
        {
            var p = this._references[name];
            if (p)
            {
                return p;
            }

            if (recursive === false || !this.baseElement)
            {
                return undefined;
            }

            return this.baseElement.getReference(name, true);
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        getProperty(name:string, recursive:boolean):SchemaProperty
        {
            var p = this._properties[name];
            if (p)
            {
                return p;
            }

            if (recursive === false || !this.baseElement)
            {
                return undefined;
            }

            return this.baseElement.getProperty(name, true);
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        __defineReferenceProperty(schemaRelationship:SchemaRelationship, opposite:boolean)
        {
            var name = opposite
                ? schemaRelationship.endProperty
                : schemaRelationship.startProperty;

            if (this._references[name])
            {
                throw "Duplicate property " + name;
            }

            var info = {
                name:               name,
                opposite:           opposite,
                schemaRelationship: schemaRelationship,
                isCollection:       !((schemaRelationship.cardinality === Cardinality.OneToOne ||
                (schemaRelationship.cardinality === Cardinality.OneToMany) && opposite)
                || schemaRelationship.cardinality === Cardinality.ManyToOne && !opposite)
            };

            this._references[name] = info;

            var refName = "__ref" + name + "__";

            if (!info.isCollection)
            {
                var desc = {
                    configurable: true,
                    enumerable:   true,
                    set:          function (v) { this[refName].setReference(v); },
                    get:          function () { return this[refName].getReference(); }
                };
                Object.defineProperty(this.proto, info.name, desc);
            }
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        defineProperty(name:any, schema:any, defaultValue?:any, kind:PropertyKind = PropertyKind.Normal):SchemaProperty
        {
            var desc;
            if (name.name)
            { // In case name is a propertydescriptor
                desc = <SchemaProperty>name;
                name = desc.name;
            }
            else
            {
                desc = new SchemaProperty(name, <SchemaInfo>schema, defaultValue, kind);
            }

            if (this.getProperty(name, true))
            {
                throw "Duplicate property name " + name;
            }

            if (typeof (desc.schemaProperty) === "string")
            {
                desc.schemaProperty = this.schema.store.getSchemaInfo(desc.schemaProperty);
            }

            desc.owner = this;
            this._properties[name] = desc;
            this.schema.constraints.addPropertyConstraint(desc);

            if (desc.kind == PropertyKind.Normal)
            {
                Object.defineProperty(this.proto, desc.name, {
                    enumerable:   true,
                    configurable: true,
                    get:          function () { return ModelElement.prototype.getPropertyValue.call(this, desc); },
                    set:          function (value)
                    {
                        ModelElement.prototype.setPropertyValue.call(this, desc, value);
                    }
                });
            }
            else
            {
                var code = <string>desc.defaultValue;
                if (!code || code.length === 0)
                {
                    throw "Calculated property must provide code";
                }

                if (code.match(/{(.*)}/) == null)
                {
                    code = 'return ' + code + ';';
                }

                try
                {
                    Object.defineProperty(this.proto, desc.name, {
                        enumerable:   true,
                        configurable: false,
                        get:          <() => any>new Function(code)
                    });
                }
                catch (e)
                {
                    throw "Error on " + desc.name + "property definition for " + this.id + " - " + e;
                }
            }

            return desc;
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        isA(schema:any):boolean
        {
            var s = schema;
            var id = schema.id;
            if( !id) {
                s = this.schema.store.getSchemaInfo(schema, false);
                if( !s)
                    return false;
                id = s.id;
            }
            if (id === this.id)
            {
                return true;
            }

            if (this.baseElement)
            {
                return this.baseElement.isA(s);
            }

            return false;
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        deserialize(ctx:SerializationContext)
        {
            var mel = <ModelElement>Object.create(this.proto);

            mel.__initialize(ctx.domain, ctx.id, this, ctx.startId, ctx.startSchemaId, ctx.endId, ctx.endSchemaId);

            Utils.forEach(this._references, info =>
            {
                var refName = "__ref" + info.name + "__";
                if (!info.isCollection)
                {
                    mel[refName] = new ReferenceHandler(mel, info.schemaRelationship, info.opposite);
                }
                else
                {
                    mel[refName] = new ModelElementCollection(mel, info.schemaRelationship, info.opposite);
                    Object.defineProperty(mel, info.name, {
                        configurable: true,
                        enumerable:   true,
                        value:        mel[refName]
                    });
                }
            });
            return mel;
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        addConstraint(message:string, constraint:(self:ModelElement, ctx:ConstraintContext) => boolean, kind:ConstraintKind = ConstraintKind.Validate, asError:boolean = true, propertyName?:string)
        {
            this.schema.constraints.addConstraint(this,
                {
                    kind:              kind,
                    executeConstraint: constraint,
                    message:           message,
                    messageType: asError
                        ? MessageType.Error
                        : MessageType.Warning,
                    propertyName:      propertyName
                });
        }
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class SchemaRelationship extends SchemaElement
    {
        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(schema:Schema, id:string, public startSchemaId:string, public endSchemaId:string, public embedded:boolean, public cardinality:Cardinality, public startProperty?:string, public endProperty?:string, public baseElement?:SchemaElement)
        {
            super(schema, SchemaKind.Relationship, id, baseElement);
            schema.__addSchemaElement(this);
        }
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class SchemaEntity extends SchemaElement
    {

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(schema:Schema, id:string, public baseElement?:SchemaElement)
        {
            super(schema, SchemaKind.Entity, id, baseElement);
            schema.__addSchemaElement(this);
        }
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    class ReferenceHandler
    {
        private relationship:ModelElement;

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(private _source:ModelElement, private _schemaRelationship:SchemaRelationship, private _opposite:boolean)
        {
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        getReference():ModelElement
        {
            if (this._source.disposed)
            {
                throw "Can not use a disposed element";
            }

            if (!this.relationship)
            {
                var start = this._opposite
                    ? undefined
                    : this._source;
                var end = this._opposite
                    ? this._source
                    : undefined;
                var rels = this._source.domain.getRelationships(this._schemaRelationship, start, end);
                this.relationship = rels.firstOrDefault();
            }

            if (!this.relationship)
            {
                return undefined;
            }

            return this._opposite
                ? this.relationship.start
                : this.relationship.end;
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        setReference(v:any)
        {
            if (this._source.disposed)
            {
                throw "Can not use a disposed element";
            }

            var other = <ModelElement>v;

            var start:ModelElement = this._opposite ? undefined : this._source;
            var end = this._opposite ? this._source : undefined;

            if (this.relationship)
            {
                var rels = this._source.domain.getRelationships(this._schemaRelationship, start, end);
                this.relationship = rels.firstOrDefault();
            }
            start = this._opposite ? other : this._source;
            end = this._opposite   ? this._source : other;

            if (this.relationship)
            {
                if (other && this.relationship.startId === start.id && this.relationship.endId === other.id)
                {
                    return; // Same relationship do nothing
                }
                this._source.domain.removeElement(this.relationship.id);
            }

            this.relationship = undefined;

            if (other)
            {
                this.relationship = this._source.domain.createRelationship(this._schemaRelationship, start, end.id, end.schemaElement.id);
            }
        }
    }

}