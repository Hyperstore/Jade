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
        this.proto = Object.create(
            baseElement
                ? baseElement.proto
                : ModelElement.prototype
        );
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
    getReference(name:string, recursive:boolean=true):IReference
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
    getProperty(name:string, recursive:boolean=true):SchemaProperty
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

        var c = schemaRelationship.cardinality;
        var info = {
            name              : name,
            opposite          : opposite,
            schemaRelationship: schemaRelationship,
            // !opposite & (1..*|*.*)
            // opposite & (*.*| *..1)
            isCollection      : c === Cardinality.ManyToMany ||
                                (!opposite && c === Cardinality.OneToMany) ||
                                (opposite && c === Cardinality.ManyToOne)
        };

        this._references[name] = info;

        var refName = "__ref" + name + "__";

        if (!info.isCollection)
        {
            var desc = <any>{
                configurable: true,
                enumerable  : true,
                set         : function (v) { this[refName].setReference(v); },
                get         : function () { return this[refName].getReference(); }
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

        var schema = <any>desc.schemaProperty;
        while(schema)
        {
            Utils.forEach(schema.constraints, c =>
                this.schema.constraints.__setPropertyConstraint(desc, c, schema)
            );
            schema = (<any>schema).parent;
        }

        if (desc.kind == PropertyKind.Normal)
        {
            Object.defineProperty(
                this.proto, desc.name, {
                    enumerable  : true,
                    configurable: true,
                    get         : function ()
                    {
                        return ModelElement.prototype.getPropertyValue.call(this, desc);
                    },
                    set         : function (value)
                    {
                        ModelElement.prototype.setPropertyValue.call(this, desc, value);
                    }
                }
            );
        }
        else
        {
            var code = desc.defaultValue;
            if (typeof(
                    code) !== "function" && typeof(
                    code) === "string" && code.length > 0)
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
                Object.defineProperty(
                    this.proto, desc.name, {
                        enumerable  : true,
                        configurable: false,
                        get         : code
                    }
                );
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
        if (!id)
        {
            s = this.schema.store.getSchemaInfo(schema, false);
            if (!s)
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

    /**
     * deserialize is called when an element is created. This method is used when an element is deserializing
     * from an external source (channel or persistence)
     * @param ctx - [[SerializationContext]] contains model element informations
     * @returns [[Hyperstore.ModelElement]] - return an initialized model element
     */
    deserialize(ctx:SerializationContext)
    {
        var mel = <ModelElement>Object.create(this.proto);

        mel.__initialize(ctx.domain, ctx.id, this, ctx.startId, ctx.startSchemaId, ctx.endId, ctx.endSchemaId);

        Utils.forEach(
            this._references, info =>
            {
                var refName = "__ref" + info.name + "__";
                if (!info.isCollection)
                {
                    mel[refName] = new ReferenceHandler(mel, info.schemaRelationship, info.opposite);
                }
                else
                {
                    mel[refName] = new ModelElementCollection(mel, info.schemaRelationship, info.opposite);
                    Object.defineProperty(
                        mel, info.name, {
                            configurable: true,
                            enumerable  : true,
                            value       : mel[refName]
                        }
                    );
                }
            }
        );
        return mel;
    }

    /**
     * add a constraint ([[IConstraint]]) on a schema element.
     * @param message - message when the constraint failed.
     * @param constraint - function to evaluate the constraint. Must returns true if the constraint is  satisfied.
     * @param asError - indicate if the constraint must be considered as an error (true) or a warning
     * @param kind - [[ConstraintKind]]
     * @param propertyName - if the constraint target a specific property, the propertyName diagnostic message property will be set with this value.
     */
    addConstraint(
        message:string, constraint:(self:ModelElement, ctx:ConstraintContext) => boolean, asError:boolean = false,
        kind:ConstraintKind = ConstraintKind.Check, propertyName?:string)
    {
        this.schema.constraints.addConstraint(
            this,
            {
                kind             : kind,
                condition        : constraint,
                message          : message,
                messageType      : asError
                    ? MessageType.Error
                    : MessageType.Warning,
                propertyName     : propertyName
            }
        );
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
            var start = this._opposite ? undefined : this._source;
            var end = this._opposite ? this._source : undefined;
            var cursor = this._source.domain.findRelationships(this._schemaRelationship, start, end);
            this.relationship = cursor.hasNext() ? cursor.next() : undefined;
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
            var cursor = this._source.domain.findRelationships(this._schemaRelationship, start, end);
            this.relationship = cursor.hasNext() ? cursor.next() : undefined;
        }
        start = this._opposite ? other : this._source;
        end = this._opposite ? this._source : other;

        if (this.relationship)
        {
            if (other && this.relationship.startId === start.id && this.relationship.endId === other.id)
            {
                return; // Same relationship do nothing
            }
            this._source.domain.remove(this.relationship.id);
        }

        this.relationship = undefined;

        if (other)
        {
            this.relationship = this._source.domain.createRelationship(
                this._schemaRelationship, start, end.id, end.schemaElement.id
            );
        }
    }
}

}