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
    export class SchemaValueObject extends SchemaInfo
    {
        constraints : IPropertyConstraint[];

        /**
         *
         * @param schema
         * @param id
         * @param parent
         */
        constructor(schema:Schema, id:string, public parent?:SchemaInfo)
        {
            super(schema, SchemaKind.ValueObject, id);
            schema.__addSchemaElement(this);
        }

        /**
         * add a constraint
         * @param message Error message
         * @param condition
         * @param asError
         * @param kind
         */
        addConstraint( message:string, condition:(val:any, old:any, ctx:ConstraintContext) => boolean,
                       asError:boolean = true, kind:ConstraintKind = ConstraintKind.Validate)
        {
            this.constraints = this.constraints || [];
            this.constraints.push(
                {
                    kind             : kind,
                    condition        : condition,
                    message          : message,
                    messageType      : asError ? MessageType.Error : MessageType.Warning
                }
            );
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        deserialize(ctx:SerializationContext):any
        {
            return this.parent ? this.parent.deserialize(ctx) : ctx.value;
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        serialize(value:any):any
        {
            return this.parent ? this.parent.serialize(value) : value;
        }
    }

    /**
     * Primitive schema
     */
    export class Primitive extends SchemaValueObject
    {
        /**
         *
         * @param schema
         * @param id
         * @param message
         * @param condition
         * @param asError
         * @param kind
         */
        constructor(schema:Schema, id:string, message?:string, condition?:(val:any, old:any, ctx:ConstraintContext) => boolean,
                    asError:boolean = true, kind:ConstraintKind = ConstraintKind.Check)
        {
            super(schema, id)
            if( condition)
                this.addConstraint(message, condition, asError, kind );
            this.kind = SchemaKind.Primitive;
        }
    }

    export class NumberPrimitive extends Primitive {
        constructor(schema:Schema) {
            super(schema, "number");
            this.addConstraint("{$value} must be a number for {$propertyName}", (val, old, ctx) => !val || typeof(val) === "number", true, ConstraintKind.Check );
        }

        deserialize(ctx:SerializationContext):any
        {
            return ctx.value ? parseFloat(ctx.value) : 0;
        }

        serialize(value:any):any
        {
            return value;
        }
    }

    export class StringPrimitive extends Primitive {
        constructor(schema:Schema) {
            super(schema, "string");
            this.addConstraint("{$value} must be a string for {$propertyName}", (val, old, ctx) => !val || typeof(val) === "string", true, ConstraintKind.Check );
        }
    }

    export class BooleanPrimitive extends Primitive {
        constructor(schema:Schema) {
            super(schema, "boolean");
            this.addConstraint("{$value} must be a boolean for {$propertyName}", (val, old, ctx) => !val || typeof(val) === "boolean", true, ConstraintKind.Check );
        }

        deserialize(ctx:SerializationContext):any
        {
            return ctx.value == "true";
        }

        serialize(value:any):any
        {
            return value;
        }
    }
}