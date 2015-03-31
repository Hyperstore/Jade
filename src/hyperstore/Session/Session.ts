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
    export enum SessionMode
    {
        Normal = 0,
        Loading = 4,
        Undo = 8,
        Redo = 16,
        UndoOrRedo = 24,
        Serializing = 32,
        SilentMode = 64,
        AbortOnWarning=128,
        Rollback = 2048
    }

    export interface SessionConfiguration
    {
        defaultDomain?: Domain;
        mode?: SessionMode;
        sessionId?: number;
        origin?: string;
    }

    export class Session
    {
        public events:Array<AbstractEvent>;
        private static _sequence:number = 0;
        public aborted:boolean;
        private _depth:number;
        private _committed:boolean;
        public closed:boolean;
        public originStoreId:string;
        public mode:SessionMode;
        public static current:Session;
        public sessionId:number;
        public trackingData:TrackingData;
        public result:SessionResult;
        private _activeDomains : HashTable<string, Domain>;
        private _store: Store;

        /**
         * @constructor
         * @param store
         * @param config
         */
        constructor(public store:Store, private config?:SessionConfiguration)
        {
            this.events = new Array<AbstractEvent>();
            this.aborted = false;
            this._depth = 0;
            this.closed = false;
            this.originStoreId = store.storeId;
            this.mode = SessionMode.Normal;
            this.trackingData = new TrackingData();
            this.result = new SessionResult(this);
            this.result.maxVersionNumber = 0;

            if (config && config.origin)
            {
                this.originStoreId = config.origin;
            }

            if (config && config.sessionId)
            {
                this.sessionId = config.sessionId;
            }
            else
            {
                Session._sequence++;
                this.sessionId = Session._sequence;
            }
            if (config && config.mode)
            {
                this.mode = config.mode;
            }

            if( store.hasDomainExtensions)
                this._activeDomains = store.getActiveDomains();

            this._store = store;
            this.__nextLevel();
        }

        /**
         *
          * @param domain
         * @returns {Domain}
         */
        getDomain(domain:string, activeOnly:boolean=false) {
            return this._activeDomains ? this._activeDomains.get(domain) : activeOnly ? undefined : this._store.getDomain(domain);
        }

        __nextLevel()
        {
            if (this.mode & SessionMode.Rollback) return;
            if (this.closed)   throw "Can not reused a closed session";

            this._depth++;
            this._committed = false;
        }

        /**
         *
         */
        acceptChanges()
        {
            if (this.mode & SessionMode.Rollback) return;
            if (this.closed)   throw "Can not reused a closed session";
            this._committed = true;
        }

        /**
         *
         * @returns {*}
         */
        close():SessionResult
        {
            if (this.closed)
            {
                return this.result;
            }

            if (!this._committed)
            {
                this.aborted = true;
            }

            this._depth--;
            if (this._depth > 0)
            {
                this._committed = false;
                return undefined;
            }

            this.closed = true;

            this.result.aborted = this.aborted;

            if (!this.aborted && (this.mode & (SessionMode.Loading | SessionMode.UndoOrRedo)) === 0)
            {
                var elements = this.trackingData.__prepareTrackedElements(this.store);
                this.result.involvedElements = elements;
                if (!this.aborted)
                {
                    this.result.__addMessages(this.executeConstraints(elements));
                }
            }

            var hasErrors = this.result.hasErrors || ((this.mode & SessionMode.AbortOnWarning) && this.result.hasWarnings);
            this.aborted = this.aborted || hasErrors;

            // Rollback
            if (this.aborted)
            {
                // Undo all session events
                this.mode = this.mode | SessionMode.Rollback;
                var d = this.store.eventBus.defaultEventDispatcher;
                this.events.reverse().forEach(e => {
                        if ((<any>e).getReverseEvent)
                            d.handleEvent((<any>e).getReverseEvent(this.sessionId))
                    }
                );
            }

            // Cannot use the current session from here
            Session.current = undefined;

            // Session completed events
            var self = this;
            // First domain events
            if (!this.aborted) {
                this.store.domains.forEach(d=> {
                    (<Domain>d).events.__notifySessionCompleted(self);
                });
            }
            // store events is always send
            this.store.__sendSessionCompletedEvent(self);

            // if errors and not in silent mode, throw an exception
            if( hasErrors && !(this.mode & SessionMode.SilentMode)) {
                var txt = "Session failed : ";
                for(var i in this.result.messages) {
                    if( !this.result.messages.hasOwnProperty(i))
                        continue;
                    var msg = this.result.messages[i];
                    if( msg.messageType === MessageType.Error)
                       txt = txt + msg.message + "\r\n";
                }
                throw {message: txt, result: this.result};
            }

            return this.result;
        }

        private executeConstraints(elements:Element[])
        {
            var constraintsManager = Utils.groupBy(elements, (e:Element) => e.getInfo().schemaElement.schema.constraints);

            var messages = [];
            Utils.forEach(constraintsManager, m =>
                {
                    var manager = m.key;
                    messages = messages.concat(manager.__checkElements(m.value));
                }
            );
            return messages;
        }

        /**
         *
         * @param evt
         */
        addEvent(evt:AbstractEvent)
        {
            if (this.mode & SessionMode.Rollback) return;
            if (this.closed)   throw "Can not reused a closed session";

            evt.correlationId = this.sessionId;
            this.events.push(evt);
            this.trackingData.__onEvent(evt);
            if (evt.version > this.result.maxVersionNumber)
            {
                this.result.maxVersionNumber = evt.version;
            }
        }
    }
}