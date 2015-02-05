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
 * Describe a property
 */
export class SchemaProperty
{
    /**
     * Schema element owner
     */
    public owner:SchemaElement;

    /**
     * create a new instance.
     *
     * @param name Name of the property
     * @param schemaProperty
     * @param defaultValue Default value or function representing a calculated value.
     * @param kind Use [[PropertyKind.CalculatedValue]] for a calculated value. You must provide a function in the
     * defaultValue argument.
     */
    constructor(public name:string, public schemaProperty:SchemaInfo, public defaultValue?:any, public kind:PropertyKind = PropertyKind.Normal)
    {
        if(!schemaProperty)
            throw "Invalid schema property for property " + name;
    }

    deserialize(ctx:SerializationContext):any
    {
        return ctx.value && this.schemaProperty.deserialize(ctx);
    }

    serialize(value:string):any
    {
        return value && this.schemaProperty.serialize(value);
    }

    /**
     * Add a property constraint. See [IElementConstraint]]
     * @param message - message if the condition is not true. See [[DiagnosticMessage]] for advanced format behavior.
     * @param condition - condition to validate
     * @param asError - error or warning
     * @param kind - Specify when the constraint is executed (check = on every change, validate = manually). See [IElementConstraint]]
     * @returns {Hyperstore.SchemaProperty}
     */
    addConstraint(message:string, condition:(val, old, ctx:ConstraintContext) => boolean, asError:boolean,
                  kind:ConstraintKind = ConstraintKind.Validate):SchemaProperty
    {
        this.owner.schema.constraints.addPropertyConstraint(this, condition, message, asError, kind);
        return this;
    }
}
}