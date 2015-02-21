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
    class SchemaState
    {
        schema:Schema;
        constraints;
        id:string;
        meta;

        static Pending = new SchemaState(null, "$pending");

        constructor(store:Store, public config)
        {
            if (store)
            {
                this.constraints = {};
                this.id = config.id;
                this.schema = new Schema(store, this.id);
                this.meta = {};
            }
        }
    }

    export class Loader
    {
        private _schemas:HashTable<string,SchemaState>;
        private _configs:any[];

        constructor(public store:Store)
        {
        }

        loadSchemas(schemas):any
        {
            var meta = {};
            if (!schemas) return meta;

            if (!Array.isArray(schemas)) schemas = [schemas];
            this._configs = schemas;
            this._schemas = new HashTable<string,any>();
            this._configs.forEach(
                    schema =>
                {
                    var state = this._parseSchema(schema);
                    meta[state.id] = state.meta;
                }
            );
            return meta;
        }

        private _parseSchema(config):SchemaState
        {
            if (!config.id)
                throw new SchemaLoaderException("id is required for schema ", config);
            var state = this._schemas.get(config.id);
            if (state) return state;

            this._schemas.add(config.id, SchemaState.Pending);
            var parser = new SchemaParser(this);
            state = parser.parse(config);
            this._schemas.add(state.id, state);
            return state;
        }

        _resolveSchema(id:string):any
        {
            var configs = this._configs;
            if(typeof(id) === "object") {
                configs = [<any>id];
                id = configs[0].id;
            }

            var state = this._schemas.get(id);
            if (state) return state;

            Utils.forEach(configs, cfg => {
                if (cfg.id === id) {
                    state = this._parseSchema(cfg);
                }
            });

            return state;
        }
    }

    export class SchemaLoaderException
    {
        constructor(public message:string, public object)
        {
        }

        toString() {
            return this.message;
        }
    }

    class SchemaParser
    {
        private static typeSequence:number=0;

        private _imports:HashTable<string, SchemaState>;
        private _state:SchemaState;
        private pendings:any[];

        constructor(private _loader:Loader)
        {
            this._imports = new HashTable<string, SchemaState>();
        }

        parse(schema):SchemaState
        {
            if (!schema) return undefined;

            var id = schema.id;
            this._state = new SchemaState(this._loader.store, schema);

            this.parseImports(schema);
            // Global constraints
            this.parseConstraints(schema.constraints, ct=> this._state.constraints[ct.name] = ct);

            this.pendings = [];
            for (var name in schema)
            {
                if (name[0] !== "$" && name !== "constraints" && name !== "types" && name !== "id")
                {
                    var o = schema[name];
                    if (o.source)
                        this.parseRelationship(o, name);
                    else
                        this.parseEntity(o, name);
                }
            }

            this.pendings.forEach(p=>this.createRelationship(p));
            return this._state;
        }

        private parseEntity(o, name:string)
        {
            var base;
            if (o.extends)
            {
                base = this._resolveType(o.extends);
                if (!base)
                    throw new SchemaLoaderException("Unknown extended entity " + o.extends, this._state.config);
            }

            var entity = new SchemaEntity(this._state.schema, name, base);
            this.parseConstraints(o.constraints, c=> entity.addConstraint(c.message, c.condition, c.error, c.kind));
            this._state.meta[name] = entity;

            for (var prop in o.properties)
            {
                if (prop[0] !== "$" && o.properties.hasOwnProperty(prop))
                    this.parseProperty(prop, o.properties[prop], entity);
            }

            for (var prop in o.references)
            {
                if (prop[0] === "$" || !o.references.hasOwnProperty(prop))
                    continue;

                var d = o.references[prop];
                this.pendings.push(
                    {
                        src     : entity.id,
                        end     : d.end,
                        kind    : d.kind || "OneToMany",
                        name    : d.name,
                        property: prop,
                        const   : d.constraints
                    }
                );
            }
            this.extends(entity, o.members);
        }

        private parseRelationship(o, name:string)
        {
            var base;
            if (o.extends)
            {
                base = this._resolveType(o.extends);
                if (!base)
                    throw "Unknown extended relationship " + o.extends;
            }

            this.pendings.push(
                {
                    src  : o.source,
                    end  : o.end,
                    kind : o.kind,
                    obj  : o,
                    base : base,
                    name : name,
                    const: o.constraints
                }
            );
        }

        private createRelationship(def)
        {
            // TODO miss extends
            var src = this._state.schema.store.getSchemaElement(def.src);
            var end = <SchemaElement>this._resolveType(def.end);
            if (!end)
                throw new SchemaLoaderException(
                    "Unknown end reference " + def.end + " for relationship " + def.name, this._state.schema
                );

            var c = this.parseCardinality(def.kind);
            if (c.opposite)
            {
                var t = src;
                src = end;
                end = t;
            }

            var name = def.name || src.name + (
                    c.embedded ? 'Has' : 'References') + end.name;
            var rel = this._state.schema.store.getSchemaRelationship(name, false);
            if (rel)
            {
                if (rel.cardinality !== c.type
                    || rel.startSchemaId !== src.id
                    || rel.endSchemaId !== end.id
                    || rel.embedded !== c.embedded
                )
                    throw "Relationship mismatch with a previous definition for " + name;

                rel.baseElement = rel.baseElement || def.base;
            }
            else
            {
                rel = new SchemaRelationship(
                    this._state.schema,
                    name,
                    src.id,
                    end.id,
                    c.embedded || false, c.type, undefined, undefined,
                    def.base
                );
                this._state.meta[name] = rel;
            }

            this.parseConstraints(def.const, c => rel.addConstraint(c.message, c.condition, c.error, c.type));

            if (def.property)
            {
                rel[c.opposite ? "endProperty" : "startProperty"] = def.property;
            }

            if (!def.obj)
                return;

            for (var prop in def.obj)
            {
                if (!def.obj.hasOwnProperty(prop) || prop[0] === "$"
                    || prop === "end" || prop === "kind" || prop === "extends"
                    || prop === "source" || prop === "constraints")
                    continue;
                this.parseProperty(prop, def.obj[prop], rel);
            }

            this.extends(rel, def.obj.members);
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
            var type = SchemaParser.cardinalities[src + end];

            return {
                opposite: op,
                embedded: m[op ? 3 : 2] === "=",
                type    : type
            }
        }

        private parseProperty(name:string, definition, entity:SchemaElement)
        {
            if (typeof(definition) === "function")
            {
                entity.defineProperty(name, "any", definition, PropertyKind.Calculated);
                return;
            }
            if (typeof(definition) === "string")
            {
                var t = this._resolveType(definition, name);
                if(!t)
                    throw  new SchemaLoaderException(
                        "Invalid type " + definition + " for property " + name, this._state.schema
                    );
                entity.defineProperty(name, t);
                return;
            }

            if (typeof(definition) !== "object")
                throw new SchemaLoaderException("Invalid property definition " + name, this._state.schema);

            t = this._resolveType(definition.type, name);
            if (!t)
                throw  new SchemaLoaderException("Unknown type " + definition.type, this._state.schema);

            if (t.kind !== SchemaKind.ValueObject && t.kind !== SchemaKind.Primitive)
            {
                throw  new SchemaLoaderException(
                    "Invalid type '" + definition.type + "' Only value object or primitive is allowed for property " +
                    name + ". Use reference instead.", this._state.schema
                );
            }

            this.extends(t, definition, p => {
                    return (p === "type" || p === "constraints" || p === "default") ? null : p;
                }
            );

            var p = entity.defineProperty(name, t, definition.default);
            this.parseConstraints(definition.constraints, c => p.addConstraint(c.message, c.condition, c.error, c.kind));
        }

        private _resolveConstraint(name:string)
        {
            if (!name) return undefined;

            var parts = name.split('.');
            if (parts.length == 1)
            {
                return this._state.constraints[parts[0]];
            }

            var state = this._imports.get(parts[0]);
            if (state)
            {
                return state.constraints[parts[1]];
            }
            return undefined;
        }

        private _resolveType(name:string, propertyName?:string)
        {
            var valueObject;
            if (!name) return undefined;
            var fullName;
            var parts = name.split('.');
            if (parts.length == 1)
            {
                if(propertyName)
                    valueObject = this.trySharedTypes(this._state, name, propertyName);

                fullName = this._state.id + Store.IdSeparator + name;
            }
            else
            {
                var state = this._imports.get(parts[0]);
                if (!state)
                {
                    return undefined;
                }
                var n = parts[1];
                if(propertyName)
                    valueObject = this.trySharedTypes(state,  n, propertyName);

                fullName = state.id + Store.IdSeparator + n;
            }

            return valueObject || this._loader.store.getSchemaInfo(fullName, false) || this._loader.store.getSchemaInfo(name, false);
        }

        private trySharedTypes(state, name:string, propertyName:string) {
            if(!state.config.types) return;
            var val = state.config.types[name];
            if (!val)
                return;

            name = propertyName + "_" + name + (++SchemaParser.typeSequence).toString();
            var valueObject = new SchemaValueObject(state.schema, name);

            this.extends(valueObject, val, p => {
                if (p === "type") {
                    var s = this._resolveType(val[p]);
                    if (!s)
                        throw new SchemaLoaderException("Unknown type " + val[p], val);
                    valueObject.parent = s;
                    return null;
                }
                else if (p === "constraints") {
                    this.parseConstraints(
                        val.constraints, c=>valueObject.addConstraint(c.message, c.condition, c.error, c.kind)
                    );
                    return null;
                }
                return p;
            });
            return valueObject;
        }

        private extends(v, o, callback?)
        {
            if (!o) return;
            for (var p in o)
            {
                if (o.hasOwnProperty(p))
                {
                    if (callback && !callback(p))
                        continue;

                    v[p] = o[p];
                }
            }
        }

        private parseConstraints(constraints, callback)
        {
            if (!constraints)
                return;

            // $default
            var defaultValues = constraints.$default || {kind: "check", error: false};
            defaultValues.kind = defaultValues.kind === "check" ? ConstraintKind.Check : ConstraintKind.Validate;

            for (var name in constraints)
            {
                if (!name || !constraints.hasOwnProperty(name))
                    continue;

                var def = constraints[name];
                var constraint;
                if (typeof(def) === "function")
                {
                    callback(
                        {
                            message  : name,
                            kind     : defaultValues.kind,
                            error    : defaultValues.error,
                            condition: def
                        }
                    );
                    continue;
                }

                if (name[0] === '$')
                {
                    if (name !== "$ref")
                        continue;

                    var refs = Array.isArray(def) ? def : [def];
                    for (var i = 0; i < refs.length; i++)
                    {
                        var ct = this._resolveConstraint(refs[i]);
                        if (!ct)
                            throw new SchemaLoaderException("Unknown constraint " + refs[i], constraints);
                        callback(ct);
                    }
                    continue;
                }

                if (typeof(def) !== "object")
                    throw new SchemaLoaderException("Invalid constraint definition " + name, constraints);

                var ct2 = {
                    name     : name,
                    message  : def.message,
                    kind     : def.check ? ConstraintKind.Check : ConstraintKind.Validate,
                    error    : def.error || defaultValues.error,
                    condition: def.validate || def.check
                };

                if (!ct2.message)
                    throw new SchemaLoaderException("Message is required for constraint " + name, constraints);

                if (!ct2.condition || typeof(ct2.condition) !== "function")
                    throw new SchemaLoaderException(
                        "A check or validate function is required for constraint " + name, constraints
                    );

                callback(ct2);
            }
        }

        private parseImports(schema)
        {
            var imports = schema.$import;
            if (!imports) return;

            for (var alias in imports)
            {
                if(!imports.hasOwnProperty(alias))
                    continue;
                var id = imports[alias];
                var state = <SchemaState>this._loader._resolveSchema(id);
                if (!state)
                    throw new SchemaLoaderException("Unknown schema import " + id, schema);
                if (state === SchemaState.Pending)
                    throw new SchemaLoaderException("Circular reference " + id, schema);
                this._imports.add(alias, state);
            }
        }
    }
}