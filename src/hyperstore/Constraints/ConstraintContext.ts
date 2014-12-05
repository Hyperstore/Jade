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
     * A constraint context is used to log diagnostic messages.
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
        constructor(public kind:ConstraintKind)
        { }

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
}