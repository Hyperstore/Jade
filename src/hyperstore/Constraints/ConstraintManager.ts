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
     * a constraint manager is associated with one and only one schema.
     * It's an internal implementation and does not be used directly.
     */
    export class ConstraintsManager
    {
        private _constraints;

        /**
         * create a new constraint manager instance.
         * @param schema
         */
        constructor(public schema:Schema)
        {
            this._constraints = {};
        }

        /**
         * add a property constraint - This method must not be called directly used [[SchemaProperty.addConstraint]]
         * instead.
         * @param property - property to validate
         * @param condition - condition to check - function arguments are : newValue, oldValue, [[ConstraintContext]]
         * @param message - error message
         * @param asError - error or warning
         * @param kind - [[ConstraintKind]]
         */
        addPropertyConstraint(
            property:SchemaProperty, condition?:(value, oldValue, ctx:ConstraintContext) => boolean,
            message?:string, asError:boolean = false, kind:ConstraintKind = ConstraintKind.Check)
        {
            var def = {condition:condition, message:message, error:asError, kind:kind};
            var fn = condition;
            if (!fn && property.schemaProperty)
            {
                var tmp;
                if ((<any>property.schemaProperty).check)
                {
                    tmp = (<any>property.schemaProperty).check;
                    def.kind = ConstraintKind.Check;
                }
                else if ((<any>property.schemaProperty).validate)
                {
                    tmp = (<any>property.schemaProperty).validate;
                    def.kind = ConstraintKind.Validate;
                }

                if(tmp) {
                    if( tmp.condition)
                    {
                        def.condition = tmp.condition;
                        def.condition = def.condition.bind(property.schemaProperty);
                        def.message = def.message || tmp.message;
                        def.error = def.error || tmp.error;
                    }
                    else if( typeof(tmp) == "function") {
                        def.condition = tmp;
                        def.condition = def.condition.bind(property.schemaProperty);
                    }
                }
            }

            if (!def.condition)
            {
                return;
            }

            this.addConstraint( property.owner,
                {
                    propertyName     : property.name,
                    messageType      : def.error ? MessageType.Error : MessageType.Warning,
                    verify: function (self, ctx)
                    {
                        var pv = ctx.element.domain.getPropertyValue(self.id, property);
                        if (!pv)
                        {
                            return true;
                        }
                        var result = false;
                        ctx.propertyName = property.name;
                        try
                        {
                            result = def.condition(pv.value, pv.oldValue, ctx);
                        }
                        catch (e)
                        {
                            ctx.log(e, def.error ? MessageType.Error : MessageType.Warning);
                        }
                        ctx.propertyName = undefined;
                        return result;
                    },
                    message          : def.message || "Constraint failed for element {id} {propertyName}",
                    kind             : def.kind
                }
            );
        }

        /**
         * add an element constraint
         * @param schemaElement - schema of the element to validate
         * @param a [[IConstraint]] definition
         */
        addConstraint(schemaElement:SchemaElement, constraint:IConstraint)
        {
            var constraints = this._constraints[schemaElement.id];
            if (!constraints)
            {
                constraints = [];
                this._constraints[schemaElement.id] = constraints;
            }
            constraints.push(constraint);
        }

        __checkElements(elements):DiagnosticMessage[]
        {
            return this.checkOrValidateElements(elements, ConstraintKind.Check);
        }

        /**
         * validate a list of elements by executing all constraints (including [[ConstraintKind.Check]] constraint)
         * and returns a list of messages.
         * @param elements - elements to validate or a domain model (to validates all its elements)
         * * @returns [[ DiagnosticMessage[] ]] - message list
         */
        validate(elements:DomainModel);
        /**
         * validate a list of elements by executing all constraints (including [[ConstraintKind.Check]] constraint)
         * and returns a list of messages.
         * @param elements - elements to validate or a domain model (to validates all its elements)
         * * @returns [[ DiagnosticMessage[] ]] - message list
         */
        validate(elements):DiagnosticMessage[]
        {
            if (elements.store)
                elements = <DomainModel>elements.getElements();
            return this.checkOrValidateElements(elements, ConstraintKind.Validate);
        }

        private checkOrValidateElements(elements, kind:ConstraintKind):DiagnosticMessage[]
        {
            var ctx = new ConstraintContext(kind);
            for (var key in elements)
            {
                var mel = elements[key];
                try
                {
                    ctx.element = mel;
                    if (kind === ConstraintKind.Check)
                    {
                        this.checkElement(ctx, mel.schemaElement);
                    }
                    else
                    {
                        this.validateElement(ctx, mel.schemaElement);
                    }
                }
                catch (e)
                {
                    ctx.log(e, MessageType.Error);
                }
            }

            return ctx.messages;
        }

        private checkElement(ctx:ConstraintContext, schemaElement:SchemaElement)
        {
            var constraints = this._constraints[schemaElement.id];
            if (constraints)
            {
                for (var key in constraints)
                {
                    var constraint = constraints[key];
                    if (constraint.kind === ConstraintKind.Check)
                    {
                        if (!constraint.verify(ctx.element, ctx))
                        {
                            ctx.log(constraint.message, constraint.messageType, constraint.propertyName);
                        }
                    }
                }
            }

            var parentSchema = schemaElement.baseElement;
            if (parentSchema && parentSchema.kind !== SchemaKind.Primitive)
            {
                this.checkElement(ctx, parentSchema);
            }
        }

        private validateElement(ctx:ConstraintContext, schemaElement:SchemaElement)
        {
            var constraints = this._constraints[schemaElement.id];
            if (constraints)
            {
                for (var constraint in constraints)
                {
                    if (!constraint.verify(ctx.element, ctx))
                    {
                        ctx.log(constraint.message, constraint.messageType, constraint.propertyName);
                    }
                }
            }
            var parentSchema = schemaElement.baseElement;
            if (parentSchema && parentSchema.kind !== SchemaKind.Primitive)
            {
                this.validateElement(ctx, parentSchema);
            }
        }
    }
}