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
     *
     */
    export class SessionResult
    {
        public aborted:boolean;
        public messages = [];
        public hasErrors:boolean = false;
        public hasWarnings:boolean = false;
        public involvedElements:ModelElement[];
        public maxVersionNumber:number;

        /**
         *
         * @returns {boolean}
         */
        get hasErrorsOrWarnings()
        {
            return this.hasErrors || this.hasWarnings;
        }

        __addMessages(messages)
        {
            for (var k in messages)
            {
                var diag = messages[k];
                this.log(diag);
            }
        }

        /**
         *
         * @param message
         */
        log(message:DiagnosticMessage)
        {
            if (message.messageType === MessageType.Error)
            {
                this.hasErrors = true;
            }
            if (message.messageType === MessageType.Warning)
            {
                this.hasWarnings = true;
            }
            this.messages.push(message);
        }
    }
}