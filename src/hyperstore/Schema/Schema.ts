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
            public domain:DomainModel, public id:string, public startId?:string, public startSchemaId?:string,
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

        constructor(public store:Store, public name?:string, def?:ISchemaDefinition)
        {
            this.constraints = new ConstraintsManager(this);
            if (def)
            {
                if (def.defineSchema)
                {
                    def.defineSchema(this);
                    delete def.defineSchema;
                }
                else
                {
                    var parser = new DslParser(this, def);
                    parser.parse(def);
                }
                for (var p in def)
                {
                    if (def.hasOwnProperty(p) && p[0] === "$")
                        delete def[p]; // remove all "$" properties
                }
            }
        }

        __addSchemaElement(schemaInfo:SchemaInfo)
        {
            this.store.__addSchemaElement(schemaInfo);
        }
    }

    // ----------------------------------------------------------------
    // Store config json parser
    // ----------------------------------------------------------------
    class DslParser
    {
        constructor(private schema:Schema, private def, private context?) {
            if(!this.context) {
                this.context = {constraints:{}, dsls:{}};
            }
            this.context.dsls[schema.name] = true; // cyclic reference guard
        }

        private pendings : any[];

        /**
         *
         * @param dsl
         */
        parse(dsl)
        {
            if (!dsl )
                return;

            var uri;
            // external reference
            // var obj = require('xxxx);
            // $import = obj;
            if( dsl.$imports) {
                for(var i=0;i <dsl.$imports.length;i++) {
                    this.parseConstraintDeclarations(dsl.$imports[i].$constraints);

                    var schemas = dsl.$imports[i].schemas;
                    if( !schemas )
                        continue;

                    for(var schemaName in schemas) {
                        if( this.context.dsls[schemaName])
                            continue;
                        var schema = new Schema(this.schema.store,schemaName );
                        var def = schemas[schemaName];
                        var p = new DslParser(schema, def, this.context);
                        p.parse(def); //
                        var hasProperties = false;
                        Utils.forEach(def, p=>hasProperties=true);
                        if( hasProperties)
                            this.def[schemaName] = def;
                    }
                }
            }

            // Relationship must be created after all entities
            this.pendings = [];

            this.parseConstraintDeclarations(dsl.$constraints);

            // valueObjects must be processed first
            this.parseValueObjects(dsl.$types);

            for (var name in dsl)
            {
                if (name[0] !== "$")
                {
                    var o = dsl[name];
                    if (o.$source)
                        this.parseRelationship(o, name);
                    else
                        this.parseEntity(o, name);
                }
                delete dsl[name];
            }

            this.pendings.forEach(p=>this.createRelationship(p));
        }

        private parseConstraintDeclarations(val) {
            this.parseConstraints(val, (ct) => {
               var name = ct.name;
                if( !name)
                    throw "Global constraint must have a name.";
                this.context.constraints[name] = ct;
            });
        }

        private parseEntity(o, name:string)
        {
            var base;
            if (o.$extend)
            {
                base = this.schema.store.getSchemaEntity(o.$extend);
                if (!base)
                    throw "Unknown extended entity " + o.$extend;
            }

            var entity = new SchemaEntity(this.schema, name, base);
            this.def[name + "Schema"] = entity;
            for (var prop in o)
            {
                if( !o.hasOwnProperty(prop))
                    continue;

                if (prop[0] === "$")
                {
                    if (prop === "$constraints")
                        this.parseConstraints(o.$constraints,
                                              c=> entity.addConstraint(c.message, c.condition, c.error, c.kind)
                                              );
                    continue;
                }

                this.parseProperty(prop, o[prop], entity);
            }
        }

        private parseKeyValue(str) {
            var kv = {};
            var i=0;
            while(i < str.length) {
                var pos = str.indexOf(':', i);
                var key = str.substring(i, pos).trim();
                key = key.replace(/"/g, '');
                i=pos+1;
                var block = 0;
                while(i<str.length) {
                    var ch = str.charAt(i);
                    if( ch === '[' || ch == '{') {block++;}
                    else if( ch === ']' || ch === '}') {
                        block--;
                    }
                    else if( ch === ',' && block === 0 )
                        break;
                    i++;
                }
                var val = str.substring(pos+1, i).trim().replace(/'/g, '"');
                i++; // Skip ,
                kv[key] = val;
            }
            return kv;
        }

        private parsePropertyType(text:string) {

            var t = <any>typeof(text);
            // specified type
            // ex : "number" (primitive or valueObject)
            //      "Book" One to one reference
            //      "range(min:1, max:2)"
            if (t === "string" && text.length > 0)
            {
                var re = /(.*)\((.*)\)/;
                var r = re.exec(text);
                if (r !== null)
                {
                    var t2 = this.schema.store.getSchemaInfo(r[1]);
                    if (t2.kind !== SchemaKind.ValueObject)
                        throw "Type initializer can ony be used with valueObject. Incorrect type " + t;
                    var vo = Object.create(t2);
                    if( r.length === 3 && r[2])
                    {
                        // min:1, max:2 => {"min":1, "max":2}
                        //re = /["']?(\w*)["']?\s*:\s*([^,]*)/g; // TODO
                        //var txt = '{' + r[2].replace(re, '"$1": $2') + '}';
                        //var init = JSON.parse(txt);
                        this.extends(vo, this.parseKeyValue(r[2]));
                    }

                    return vo;
                }
                t = text;
            }

            return this.schema.store.getSchemaInfo(t);
        }

        private parseProperty(name:string, o, entity:SchemaElement)
        {
            var t = <any>typeof(o);
            if (t === "object")
            {
                // primitive or default value
                // ex : { $type: "string", $default? : "xxx", $constraints? : {} }
                if (o.$type)
                {
                    t = this.parsePropertyType(o.$type);
                    if( !t )
                        throw "Unknown type " + o.$type;

                    if (t.kind !== SchemaKind.ValueObject && t.kind !== SchemaKind.Primitive)
                    {
                        throw "Invalid type '" + o + "' Only value object or primitive is allowed for property " +
                        name + ". Use reference instead.";
                    }
                    var p = entity.defineProperty(name, t, o.$default);
                    this.parseConstraints(o.$constraints,
                                          c => p.addConstraint(c.message, c.condition, c.error, c.kind)
                                          );
                }
                else
                {
                    // relationship
                    // ex : { $end : "Book", $kind : "1=>*", name?: "libHasBooks", $constraints?: {} }
                    if (o.$end)
                    {
                        this.pendings.push(
                            {
                                src     : entity.id,
                                end     : o.$end,
                                type    : o.$kind,
                                name    : o.$relationship,
                                property: name,
                                const   : o.$constraints
                            }
                        );
                        return;
                    }

                    // One to many reference
                    if (Utils.isArray(o))
                    {
                        // ex : ["Book"]
                        this.pendings.push(
                            {
                                src     : entity.id,
                                end     : o[0],
                                property: name,
                                type    : "1=>*"
                            }
                        );
                        return;
                    }

                    // specified reference
                    // ex : { Book : "*=>*"}
                    var cx = 0;
                    for (var key in o)
                    {
                        if( !o.hasOwnProperty(key))
                            continue;
                        cx++;
                        if (cx > 1)
                            throw "Invalid reference definition. Object must contain only one field. ex: { Book : '1=>*'} ";

                        this.pendings.push(
                            {
                                src     : entity.id,
                                end     : key,
                                type    : o[key],
                                property: name
                            }
                        );
                    }
                }
            }
            // calculated property
            // ex : function() {return 1;}
            else if (t === "function")
            {
                entity.defineProperty(name, null, o, PropertyKind.Calculated);
            }
            else
            {
                t = this.parsePropertyType(o);
                if( !t )
                    throw "Unknown type " + o;

                if (t.kind !== SchemaKind.ValueObject && t.kind !== SchemaKind.Primitive)
                {
                    // OneToOne
                    this.pendings.push(
                        {
                            src     : entity.id,
                            end     : t.id,
                            property: name,
                            type    : "1->1"
                        }
                    );
                    return;
                }
                entity.defineProperty(name, t, undefined);
            }
        }

        private parseConstraints(constraints, callback)
        {
            if (!constraints)
                return;

            var def = constraints.$default || {kind: "check", error: false};
            def.kind = def.kind === "check" ? ConstraintKind.Check : ConstraintKind.Validate;
            for (var msg in constraints)
            {
                if( !constraints.hasOwnProperty(msg))
                    continue;

                var c = constraints[msg];
                if(  msg[0] === '$') {
                    if( msg !== "$ref")
                        continue;
                    var refs = Array.isArray(c) ? c : [c];
                    for(var i=0;i<refs.length;i++) {
                        var ct = this.context.constraints[refs[i]];
                        if( ct)
                            callback(ct);
                    }
                    continue;
                }
                else {
                    ct = {
                        name: c.name,
                        message: msg,
                        kind: c.check ? ConstraintKind.Check : c.validate ? ConstraintKind.Validate : def.kind,
                        error: c.error || def.error,
                        condition: c.validate || c.check || c
                    };
                }
                // TODO validate constraint
                callback(ct);
            }
        }

        private parseRelationship(o, name:string)
        {
            var base;
            if (o.$extend)
            {
                base = this.schema.store.getSchemaRelationship(o.$extend);
                if (!base)
                    throw "Unknown extended relationship " + o.$extend;
            }

            this.pendings.push(
                {
                    src  : o.$source,
                    end  : o.$end,
                    type : o.$kind,
                    obj  : o,
                    base : base,
                    name : name,
                    const: o.$constraints
                }
            );
        }

        private createRelationship(def)
        {
            // TODO optional redefinition (inutile de redefinir les propriétes pour une relation explicite)
            var src = this.schema.store.getSchemaElement(def.src);
            var end = this.schema.store.getSchemaElement(def.end);

            var c = this.parseCardinality(def.type);
            if (c.opposite)
            {
                var t = src;
                src = end;
                end = t;
            }

            var name = def.name || src.name + (c.embedded ? 'Has' : 'References') + end.name;
            var rel = this.schema.store.getSchemaRelationship(name, false);
            if (rel)
            {
                if (rel.cardinality !== c.type || rel.startSchemaId !== src.id || rel.endSchemaId !== end.id ||
                    rel.embedded !== c.embedded)
                    throw "Relationship mismatch with a previous definition for " + name;
                rel.baseElement = rel.baseElement || def.base;
            }
            else
            {
                rel = new SchemaRelationship(this.schema, name, src.id, end.id, c.embedded || false, c.type, undefined, undefined, def.base);
                this.def[name + "Schema"] = rel;
            }

            this.parseConstraints(def.const, c => rel.addConstraint(c.message, c.condition, c.error, c.kind));

            if (def.property)
            {
                rel[c.opposite ? "endProperty" : "startProperty"] = def.property;
            }

            if (!def.obj)
                return;

            for (var prop in def.obj)
            {
                if (!def.obj.hasOwnProperty(prop) || prop[0] === "$")
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

        private parseCardinality(c)
        {
            var re = /([1\*])(=|-|<)(-|=|>)([1\*])/;
            var m = re.exec(c);
            if (!m)
                throw "Invalid reference format. Must be [1|*]xx[1|*] with xx = ->, =>, <- or <= .";

            var op = m[2] === "<";
            var src = m[op ? 4 : 1];
            var end = m[op ? 1 : 4];
            var type = DslParser.cardinalities[src + end];

            return {
                opposite: op,
                embedded: m[op ? 3 : 2] === "=",
                type    : type
            }
        }

        private parseValueObjects(values)
        {
            if(!values)
                return;

            for(var name in values) {
                if( !values.hasOwnProperty(name))
                    continue;

                var val = values[name];
                var valueObject = new SchemaValueObject(this.schema, name);

                this.extends(valueObject, val, p => {
                    if(p === "$type") {
                        var s = this.schema.store.getSchemaInfo(val[p]);
                        valueObject.parent = s;
                    }
                    else if(p==="$constraints") {
                        this.parseConstraints(val.$constraints,
                                              c=>valueObject.addConstraint(c.message, c.condition, c.error, c.kind)
                                              );
                    }
                });
            }
        }

        private extends(v, o, callback?) {
            if(!o)
                return;
            for(var p in o) {
                if( o.hasOwnProperty(p) )
                {
                    if(p[0] === "$") {
                        if(callback) callback( p );
                    }
                    else
                        v[p] = o[p];
                }
            }
        }
    }
}