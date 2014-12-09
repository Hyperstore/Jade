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
            var def = {condition: condition, message: message, error: asError, kind: kind};
            this.setPropertyConstraint(def, property);

            var schema = <any>property.schemaProperty;
            while(schema)
            {
                Utils.forEach(schema.constraints,
                              c => this.setPropertyConstraint(c, property, schema)
                );
                schema = (<any>schema).parent;
            }
        }

        private setPropertyConstraint(def, property, schema?)
        {
            if (!def.condition)
            {
                return;
            }

            var condition = schema ? def.condition.bind(schema) : def.condition;
            var message = DiagnosticMessage.__prepareMessage( def.message, schema ) || "Constraint failed for element {id} {propertyName}";

                this.addConstraint( property.owner,
                {
                    propertyName     : property.name,
                    messageType      : def.messageType,
                    execute : function (self, ctx) : string
                    {
                        var pv = <PropertyValue>ctx.element.domain.getPropertyValue(self.id, property);
                        if (!pv)
                        {
                            return null;
                        }
                        var result = <string>null;
                        ctx.propertyName = property.name;
                        try
                        {
                            if( !condition(pv.value, pv.oldValue, ctx)) {
                                result = DiagnosticMessage.__format(
                                                                  message,
                                                                  ctx.element,
                                                                  property.name,
                                                                  pv.value,
                                                                  pv.oldValue
                                );
                            }
                        }
                        catch (e)
                        {
                            ctx.log(e, MessageType.Error );
                        }
                        ctx.propertyName = undefined;
                        return result;
                    },
                    kind             : def.kind
                }
            );
        }

        /**
         * add an element constraint
         * @param schemaElement - schema of the element to validate
         * @param a [[IConstraint]] definition
         */
        addConstraint(schemaElement:SchemaElement, constraint)
        {
            var constraints = this._constraints[schemaElement.id];
            if (!constraints)
            {
                constraints = [];
                this._constraints[schemaElement.id] = constraints;
            }

            if(!constraint.execute)
            {
                var message = constraint.message || "Constraint failed for element {id}";
                constraint.execute = function (self, ctx)
                {
                    var result = <string>null;
                    ctx.propertyName = null;
                    try
                    {
                        if (!constraint.condition(self, ctx))
                        {
                            result = DiagnosticMessage.__format(
                                message,
                                ctx.element,
                                constraint.propertyName
                            );
                        }
                    }
                    catch (e)
                    {
                        ctx.log(e, MessageType.Error );
                    }
                    return result;
                };
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
                elements = <DomainModel>elements.find();
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
                    this.checkCondition(ctx, mel.schemaElement);
                }
                catch (e)
                {
                    ctx.log(e, MessageType.Error);
                }
            }

            return ctx.messages;
        }

        private checkCondition(ctx:ConstraintContext, schemaElement:SchemaElement)
        {
            var constraints = this._constraints[schemaElement.id];
            if (constraints)
            {
                for (var key in constraints)
                {
                    var constraint = constraints[key];
                    if (constraint.kind === ctx.kind)
                    {
                        var msg = constraint.execute(ctx.element, ctx);
                        if(msg)
                        {
                            ctx.log(msg, constraint.messageType, constraint.propertyName);
                        }
                    }
                }
            }

            var parentSchema = schemaElement.baseElement;
            if (parentSchema && parentSchema.kind !== SchemaKind.Primitive)
            {
                this.checkCondition(ctx, parentSchema);
            }
        }
    }
}