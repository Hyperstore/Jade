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
}