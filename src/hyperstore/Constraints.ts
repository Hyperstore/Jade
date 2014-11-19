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

    export class ConstraintContext
    {
        element:ModelElement;
        propertyName:string;
        messages:Array<DiagnosticMessage> = new Array<DiagnosticMessage>();

        constructor(public kind:ConstraintKind) { }

        log(msg:string, messageType:MessageType = MessageType.Warning, propertyName?:string)
        {
            var diag = new DiagnosticMessage(messageType, msg, this.element, this.propertyName || propertyName);
            this.messages.push(diag);
        }
    }

    export enum MessageType {
        Warning,
        Error
    }

    export class DiagnosticMessage
    {
        public id:string;

        constructor(public messageType:MessageType, public message:string, private element?:ModelElement, public propertyName?:string)
        {
            if (element)
            {
                this.id = element.id;
            }
        }

        toString():string
        {
            if (!this.element)
            {
                return this.message;
            }

            var self = this;
            var regex = /{(\S+)}/g;
            return this.message.replace(regex, function(match, propertyName )
            {
                return self.element[propertyName];
            });
        }
    }

    export class ConstraintsManager
    {

        private _constraints;

        constructor(public schema:Schema)
        {
            this._constraints = {};
        }

        addPropertyConstraint(property:SchemaProperty, condition?:(value, oldValue, ctx:ConstraintContext) => boolean, message?:string, asError:boolean = false, kind:ConstraintKind = ConstraintKind.Check)
        {
            var fn = condition;
            if (!fn && property.schemaProperty)
            {
                if ((<any>property.schemaProperty).check)
                {
                    fn = (<any>property.schemaProperty).check;
                    kind = ConstraintKind.Check;
                }
                else if ((<any>property.schemaProperty).validate)
                {
                    fn = (<any>property.schemaProperty).validate;
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

        checkElements(elements):DiagnosticMessage[]
        {
            return this.checkOrValidateElements(elements, ConstraintKind.Check);
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