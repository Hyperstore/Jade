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
    /**
     * A constraint is like a rule checked every time something change in a domain.
     * Every domain has a [[ConstraintsManager]] containing the domain constraints. You can access it by using the
     * [[DomainModel.constraints]] property.
     *
     * You can add constraint :
     * * on a schema element with the [[SchemaElement.addConstraint]] method.
     * * on a property with the [[SchemaProperty.addConstraint]] method.
     * * or directly by using the appropriate methods of the [[ConstraintManager]].
     *
     * Every constraint has a [[ConstraintKind]] property which specify when a constraint is executed.
     *
     * This can have two values :
     * * check : constraint are executed every a session is closed (aka every time something change) but only on elements
     * involved during the session.
     * * validateElement : constraints must be run manually by calling the [[ConstraintsManager.validate]]
     */
    export interface IConstraint
    {
        kind: ConstraintKind
        executeConstraint: (self:ModelElement, ctx:ConstraintContext) => boolean;
        message: string;
        messageType?: MessageType;
        propertyName?: string;
    }

    export enum ConstraintKind {
        Check,
        Validate
    }

    /**
     * A constraint context is used to log a new diagnostic message.
     */
    export class ConstraintContext
    {
        /**
         * element the constraint execute on
         */
        element:ModelElement;
        /**
         * current property is any
         */
        propertyName:string;
        /**
         * diagnostic message list
         */
        messages:Array<DiagnosticMessage> = new Array<DiagnosticMessage>();

        /**
         * @private
         * @param kind
         */
        constructor(public kind:ConstraintKind) { }

        /**
         * log a new diagnostic message
         * @see [[DiagnosticMessage]]
         * @param msg - message with pattern
         * @param messageType - error or warning
         * @param propertyName - property name
         */
        log(msg:string, messageType:MessageType = MessageType.Warning, propertyName?:string)
        {
            var diag = new DiagnosticMessage(messageType, msg, this.element, this.propertyName || propertyName);
            this.messages.push(diag);
        }
    }

    /**
     * Specify a diagnostic message type
     */
    export enum MessageType {
        /**
         * warning - a constraint failed by the session is complete.
         */
        Warning,
        /**
         * error - the current session will be aborted.
         */
        Error
    }

    /**
     * A diagnostic message is emitted by a constraint and has some extended formatting features. Since constraint
     * are executed on a domain element, every diagnostic has a reference to this element and if the constraint is a
     * property constraint, the propertyName property is set.
     *
     * You can use this dynamic informations to create a message with pattern like {{property_Name}}
     * (Only simple properties are allowed. xxx.yyy are not take into account.)
     *
     * **example** : "{{Email}} is already taken for customer {{Name}}"
     *
     * The special pattern {{propertyName}} can be used to include the property in error.
     */
    export class DiagnosticMessage
    {
        public id:string;

        /**
         * create a diagnostic message instance - do not use directly
         * @param messageType
         * @param rawMessage
         * @param element
         * @param propertyName
         */
        constructor(public messageType:MessageType, public rawMessage:string, private element?:ModelElement,
                    public propertyName?:string)
        {
            if (element)
            {
                this.id = element.id;
            }
        }

        /**
         * get the formatted message
         * @returns {string} - formatted message
         */
        get message() :string
        {
            if (!this.element)
            {
                return this.rawMessage;
            }

            var self = this;
            var regex = /{\s*(\S*)\s*}/g;
            return this.rawMessage
                .replace(regex, function(match, name )
                {
                    return name === "propertyName" ? this.propertyName : self.element[name];
                });
        }
    }

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
        addPropertyConstraint(property:SchemaProperty, condition?:(value, oldValue, ctx:ConstraintContext) => boolean,
                              message?:string, asError:boolean = false, kind:ConstraintKind = ConstraintKind.Check)
        {
            var fn = condition;
            if (!fn && property.schemaProperty)
            {
                if ((<any>property.schemaProperty).check)
                {
                    fn = (<any>property.schemaProperty).check;
                    kind = ConstraintKind.Check;
                }
                else if ((<any>property.schemaProperty).validateElement)
                {
                    fn = (<any>property.schemaProperty).validateElement;
                    kind = ConstraintKind.Validate;
                }
            }
            if (!fn)
            {
                return;
            }

            this.addConstraint(property.owner,
                {
                    propertyName: property.name,
                    messageType: asError ? MessageType.Error : MessageType.Warning,
                    executeConstraint: function (self, ctx)
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
                            result = fn(pv.value, pv.oldValue, ctx);
                        }
                        catch (e)
                        {
                            ctx.log(e, asError
                                ? MessageType.Error
                                : MessageType.Warning);
                        }
                        ctx.propertyName = undefined;
                        return result;
                    },
                    message:           message,
                    kind:              kind
                });
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
        validate(elements) : DiagnosticMessage[] {
            if( elements.store)
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
                        if (!constraint.executeConstraint(ctx.element, ctx))
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
                    if (!constraint.executeConstraint(ctx.element, ctx))
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