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
/// <reference path="../../../Scripts/typings/Q/Q.d.ts" />
module Hyperstore
{

    /**
     * Session result contains finally state of a session.
     *
     */
    export class SessionResult
    {
        /**
         * Promises for waiting for async tasks like persistence
         */
        private _promises: Q.Promise<any>[];
        /**
         * Session has been aborted ?
         */
        public aborted:boolean;
        /**
         * Diagnostic messages emitted during the session from a constraint or by calling [[SessionResult.log]]
         *
         * @type {Array} List of messages
         */
        public messages = [];
        /**
         * Is there some error messages ?
         *
         * @type {boolean} true if at least one error message exists
         */
        public hasErrors:boolean = false;
       /**
         * Is there some warning messages ?
         *
         * @type {boolean} true if at least one warning message exists
         */
        public hasWarnings:boolean = false;
        /**
         * List of elements involved during the current session
         */
        public involvedElements:ModelElement[];
        /**
         * Max version number founded during the session.
         *
         */
        public maxVersionNumber:number;

        constructor(private _session:Session)
        {
            this._promises = [];
        }

        addPromise(q)  {
            this._promises.push(q);
        }

        /**
         * register a promise
         *  registerPromise(func, args, callback)
         *  callback is always the last argument and must have a node callback signature (err, result)
         * @param func
         */
        registerPromise(obj:any, method:string, callback:(err?,r?,session?:Session)=>void, ...args:any[]) {
            var p = Q.defer<any>();
          //  var args = Array.prototype.slice.call(arguments,0);
            var func = obj[method];
            var self = this;
            var fargs = args;
            for(var i = args.length;i<func.length-1;i++)
                args.push(undefined);

            func.apply(obj, fargs.concat(function(err, r) {
                if( err )
                {
                    p.reject(err);
                    return;
                }
                p.resolve(r);
                callback(err, r, self._session);
            }));

            this._promises.push(p.promise);
        }

        async() : Q.Promise<any> {
            if( this._promises.length) {
                var p = Q.allSettled(this._promises);
                this._promises = [];
                return p;
            }
            var q = Q.defer<any>();
            q.resolve(false);
            return q.promise;

        }
        /**
         * Is there some error or warning messages ?
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
         * log a new message
         *
         * @param message A diagnostic message
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