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
        constructor(public schema:Schema, private parent?:ConstraintsManager)
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
            this.__setPropertyConstraint(property, def);
        }

        __setPropertyConstraint(property, def, schema?)
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
                    execute : function (self:Element, ctx:ConstraintContext) : string
                    {
                        var pv = <PropertyValue>ctx.element.getInfo().domain.getPropertyValue(self.getInfo().id, property);
                        if (!pv)
                        {
                            pv = new PropertyValue(null,null,0);
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
                            var txt = "Fatal error << " + e + " >> on property constraint " + message + " for property " + property.name;
                            ctx.log(txt, MessageType.Error );
                        }
                        ctx.propertyName = undefined;
                        return result;
                    },
                    kind             : def.kind
                }
            );
        }

        getConstraints(schemaElement:SchemaElement) {
            return this._constraints[schemaElement.id];
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
                constraint.execute = function (self:Element, ctx:ConstraintContext)
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
                        var txt = "Fatal error << " + e + " >> on element constraint " + message;
                        ctx.log(txt, MessageType.Error );
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
        validate(elements:Domain);
        /**
         * validate a list of elements by executing all constraints (including [[ConstraintKind.Check]] constraint)
         * and returns a list of messages.
         * @param elements - elements to validate or a domain model (to validates all its elements)
         * * @returns [[ DiagnosticMessage[] ]] - message list
         */
        validate(elements):DiagnosticMessage[]
        {
            if (elements.store)
                elements = <Domain>elements.getElements();
            return this.checkOrValidateElements(elements, ConstraintKind.Validate);
        }

        private checkOrValidateElements(elements, kind:ConstraintKind):DiagnosticMessage[]
        {
            var ctx = new ConstraintContext(kind);
            Utils.forEach(elements, (mel:Element) => {
                try {
                    ctx.element = mel;
                    this.checkCondition(ctx, mel.getInfo().schemaElement);
                }
                catch (e) {
                    ctx.log(e, MessageType.Error);
                }
            });

            return ctx.messages;
        }

        __dump() {
            for(var id in this._constraints) {
                console.log("Constraints for " + id);
                var constraints = this._constraints[id];
                for (var key in constraints)
                {
                    if (!constraints.hasOwnProperty(key))
                        continue;
                    var constraint = constraints[key];
                    var str = "Constraint";
                    if( constraint.propertyName)
                        str += " for property " + constraint.propertyName;
                    else
                        str += " for entity";
                    str += " message = '" + constraint.message + "'";
                    //str += " condition " + constraint.execute.toString();
                    console.log(str);
                }
            }
        }

        private checkCondition(ctx:ConstraintContext, schemaElement:SchemaElement)
        {
            var constraints = this._constraints[schemaElement.id];
            if( this.parent)
                constraints = this.parent._constraints.concat(constraints);
            if (constraints)
            {
                for (var key in constraints)
                {
                    if( !constraints.hasOwnProperty(key))
                        continue;
                    var constraint = constraints[key];
                    if (constraint.kind <= ctx.kind) // validate includes check constraint
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