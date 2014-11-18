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
                for(var p in def)
                {
                    if( def.hasOwnProperty(p) && p[0] == "$")
                        delete def[p]; // remove all "$" properties
                }

                if( def.defineSchema)
                {
                    def.defineSchema(this);
                    delete def.defineSchema;
                }
                else {
                    var parser = new DslParser(this, def);
                    parser.parse(def);
                }
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
        public name:string;

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(public schema:Schema, public kind:SchemaKind, public id:string)
        {
            this.name =  id.indexOf('.') <= 0 || (schema.name && id.substr(0, schema.name.length) !== schema.name)
                        ? id
                        : id.substr(schema.name.length + 1);

            this.id =  schema.name  ? schema.name + ":" + this.name : id;
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
            { // In case name is a property descriptor
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
                var code = desc.defaultValue;
                if( typeof(code) !== "function" && typeof(code) === "string" && code.length > 0)
                {
                    if (code.match(/{(.*)}/) == null)
                    {
                        code = 'return ' + code + ';';
                    }
                    code = new Function(code)
                }

                if (!code)
                {
                    throw "Calculated property must provide code";
                }

                try
                {
                    Object.defineProperty(this.proto, desc.name, {
                        enumerable:   true,
                        configurable: false,
                        get:         code
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
        addConstraint(message:string, constraint:(self:ModelElement, ctx:ConstraintContext) => boolean, asError:boolean = true, kind:ConstraintKind = ConstraintKind.Validate, propertyName?:string)
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

    class DslParser {
        constructor(private schema:Schema, private def) {}

        private pendings : any[];

        parse(dsl) {
            if(!dsl)
                return;

            this.pendings = [];
            for(var name in dsl)
            {
                var o = dsl[name];
                if( name === "valueObjects")
                {
                    this.parseValueObjects(o);
                }
                else {
                    if( o.$source)
                        this.parseRelationship(o, name);
                    else
                        this.parseEntity(o, name);
                }
                delete dsl[name];
            }

            Utils.forEach(this.pendings, p=>this.createRelationship(p));
        }

        private parseEntity(o, name:string) {
            var base;
            if( o.$extend) {
                base = this.schema.store.getSchemaEntity(o.$extend);
                if( !base )
                    throw "Unknown extended entity " + o.$extend;
            }
            var entity = new SchemaEntity(this.schema, name, base );
            this.def[name + "Schema"] = entity;
            for(var prop in o) {
                if( prop[0] == "$")
                {
                    if( prop === "$constraints")
                        this.parseConstraints(o.$constraints, c=> {
                            entity.addConstraint(c.message, c.condition, c.error, c.kind);
                        } );
                    continue;
                }
                this.parseProperty(prop, o[prop], entity);
            }
        }

        private parseProperty(name:string, o, entity:SchemaElement) {
            var t = <any>typeof(o);
            if( t === "object")
            {
                if( o.$type)
                {
                    var p = entity.defineProperty(name, this.schema.store.getSchemaInfo(o.$type), o.$default);
                    this.parseConstraints(o.$constraints,c => p.addConstraint(c.message, c.condition, c.error, c.kind));
                }
                else {
                    if( o.$source )
                    {
                        this.pendings.push({src:     o.$source,
                                               end:  o.$end,
                                               type: o.$kind,
                                               name: o.$name,
                                               const:  o.$constraints
                                           }
                        );
                        return;
                    }

                    var cx = 0;
                    for(var key in o)
                    {
                        cx++;
                        if (cx > 1)
                            throw "Invalid reference definition. Object must contain only one field. ex: { Book : '1=>*'} ";

                        this.pendings.push(
                            {
                                src: entity.id,
                                end:key,
                                type: o[key],
                                property:name
                            }
                        );
                    }
                }
            }
            else if( t === "function")
            {
                entity.defineProperty(name, null, o, PropertyKind.Calculated);
            }
            else {
                if( t === "string" && o.length > 0)
                {
                    t = this.schema.store.getSchemaInfo(o);
                    if( t.kind !== SchemaKind.ValueObject || t.kind !== SchemaKind.Primitive)
                        throw "Only value object or primitive is allowed for property " + name + ". Use reference instead."
                    o = undefined;
                }
                entity.defineProperty(name, t, o);
            }
        }

        private parseConstraints(constraints, callback) {

            if( constraints)
            {
                var def = constraints.$default || {kind: "check", error: false};
                for (var msg in constraints)
                {
                    var c = constraints[msg];
                    callback(
                        {
                            message:   msg,
                            kind:      c.kind || def.kind,
                            error:     c.error || def.error,
                            condition: c.condition
                        }
                    );
                }
            }
        }

        private parseRelationship(o, name:string)
        {
            var base;
            if (o.$extend)
            {
                base = this.schema.store.getSchemaRelationship(o.$extend);
                if( !base )
                    throw "Unknown extended relationship " + o.$extend;
            }

            this.pendings.push({src: o.$source, end: o.$end, type: o.$kind, obj:o, base:base, name: o.$name, const:o.$constraints});
        }

        private createRelationship(def)
        {
            var src = this.schema.store.getSchemaElement(def.src);
            var end = this.schema.store.getSchemaElement(def.end);

            var c = this.parseCardinality(def.type);
            if( c.opposite) {
                var t = src;
                src=end;
                end=t;
            }

            var name = def.name || src.name + (c.embedded ? 'Has' : 'References') + end.name;
            var rel = this.schema.store.getSchemaRelationship(name, false);
            if( rel )
            {
                if( rel.cardinality !== c.type || rel.startSchemaId !== src.id || rel.endSchemaId !== end.id || rel.embedded !== c.embedded)
                    throw "Relationship mismatch with a previous definition for " + name;
                rel.baseElement = rel.baseElement || def.base;
            }
            else
            {
                rel = new SchemaRelationship(
                    this.schema, name, src.id, end.id, c.embedded || false, c.type, undefined, undefined, def.base
                );
                this.def[name + "Schema"] = rel;
            }

            this.parseConstraints(def.const,c => rel.addConstraint(c.message, c.condition, c.error, c.kind));

            if( def.property) {
                rel[c.opposite ? "endProperty" : "startProperty" ] = def.property;
            }

            if( !def.obj )
                return;

            for(var prop in def.obj) {
                if( prop[0] == "$")
                    continue;
                this.parseProperty(prop, def.obj[prop], rel);
            }
        }

        private static cardinalities = {
            "11": Cardinality.OneToOne,
            "1*": Cardinality.OneToMany,
            "*1": Cardinality.ManyToOne,
            "**": Cardinality.ManyToMany
        };

        private parseCardinality(c) {
            var re = /([1\*])(=|-|<)(-|=|>)([1\*])/;
            var m = re.exec(c);
            if( !m)
                throw "Invalid reference format. Must be [1|*]xx[1|*] with xx = ->, =>, <- or <= .";

            var op = m[2] == "<";
            var src = m[op?4:1];
            var end = m[op?1:4];
            var type = DslParser.cardinalities[src+end];

            return {
                opposite: op,
                embedded: m[op ? 3 : 2] === "=",
                type: type
            }
        }

        private parseValueObjects(values) {

        }
    }
}