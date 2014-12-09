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
     * Event manager manage all events from a domain. You can subscribe to domain events with
     * the [[EventManager.on]] method or dedicated method like [[EventManager.onEntityAdded]].
     *
     * You can un subscribe to event with the [[EventManager.remove]] method.
     */
    export class EventManager
    {
        private _subscriptions;
        static AddEntityEvent = "addEntity";
        static RemoveEntityEvent = "removeEntity";
        static AddRelationshipEvent = "addRelationship";
        static ChangePropertyValueEvent = "change";
        static RemoveRelationshipEvent = "removeRelationship";
        static RemovePropertyEvent = "removeProperty";
        static SessionCompleted = "sessionCompleted";
        static OnErrors = "onErrors";

        /**
         * create a new instance
         * @param domain
         */
        constructor(private domain:string)
        {
        }

        /**
         * do not call directly
         */
        dispose()
        {
            this._subscriptions = undefined;
        }

        static createEvent(eventName:string)
        {
            switch (eventName)
            {
                case EventManager.AddEntityEvent:
                    return Object.create(AddEntityEvent);
                case EventManager.RemoveEntityEvent:
                    return Object.create(RemoveEntityEvent);
                case EventManager.AddRelationshipEvent:
                    return Object.create(AddRelationshipEvent);
                case EventManager.ChangePropertyValueEvent:
                    return Object.create(ChangePropertyValueEvent);
                case EventManager.RemoveRelationshipEvent:
                    return Object.create(RemoveRelationshipEvent);
                case EventManager.RemovePropertyEvent:
                    return Object.create(RemovePropertyEvent);
                default:
                    return undefined;
            }
        }

        /**
         * subscribe to 'addEntity' same as *on('addEntity')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onEntityAdded(callback:(s:SessionInfo, e:AddEntityEvent)=>void):any
        {
            return this.on(EventManager.AddEntityEvent, callback);
        }

        /**
         * subscribe to 'removeEntity' same as *on('removeEntity')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onEntityRemoved(callback:(s:SessionInfo, e:AddEntityEvent)=>void):any
        {
            return this.on(EventManager.RemoveEntityEvent, callback);
        }

        /**
         * subscribe to 'addRelationship' same as *on('addRelationship')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onRelationshipAdded(callback:(s:SessionInfo, e:AddEntityEvent)=>void):any
        {
            return this.on(EventManager.AddRelationshipEvent, callback);
        }

        /**
         * subscribe to 'removeRelationship' same as *on('removeRelationship')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onRelationshipRemoved(callback:(s:SessionInfo, e:AddEntityEvent)=>void):any
        {
            return this.on(EventManager.RemoveRelationshipEvent, callback);
        }

        /**
         * subscribe to 'change' same as *on('change')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onPropertyChanged(callback:(s:SessionInfo, e:AddEntityEvent)=>void):any
        {
            return this.on(EventManager.ChangePropertyValueEvent, callback);
        }

        /**
         * subscribe to session completed event same as *on('sessionCompleted')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onSessionCompleted(callback:(s:SessionInfo, e:AddEntityEvent)=>void):any
        {
            return this.on(EventManager.SessionCompleted, callback);
        }

        /**
         * subscribe to event. You can use specific method like [[EventManager.OnSessionCompleted]]
         * to subscribe to built-in event.
         *
         * @param eventName - event name must be one of the built-in events (see [[EventManager]]) or a custom event.
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public on(eventName:string, callback):any
        {
            if (!eventName || !callback)
                return;

            if (!this._subscriptions)
                this._subscriptions = {};

            var list = this._subscriptions[eventName];
            if (!list)
                this._subscriptions[eventName] = list = [];

            var ix = list.length;
            list.push({ix: ix, fn: callback});
            return {e: eventName, ix: ix};
        }

        /**
         * un subscribe to event using the cookie of the [[EventManager.on]] method.
         * @param cookie - valid cookie
         * @returns [[EventManager]]
         */
        public remove(cookie):EventManager
        {
            if (!cookie || !cookie.ix)
                return this;

            var list = this._subscriptions[cookie.e];
            if (!list)
                return this;
            var pos = Utils.indexOf(this._subscriptions, s=> s.ix === cookie);
            if (pos >= 0)
            {
                list.splice(cookie.ix, 1);
                if (list.length === 0)
                    delete this._subscriptions[cookie.e];
            }
            return this;
        }

        __notifySessionCompleted(session:Session)
        {
            if (!this._subscriptions)
                return;

            var si = {
                aborted  : session.aborted,
                mode     : session.mode,
                sessionId: session.sessionId,
                events   : session.events.filter(e=> e.domain === this.domain)
            };

            for (var i = 0; i < si.events.length; i++)
            {
                var evt = si.events[i];
                var list = this._subscriptions[evt.eventName];
                if (!list)
                    continue;

                Utils.forEach(list, s => s.fn(si, evt));
            }

            var list = this._subscriptions[EventManager.SessionCompleted];
            if (!list)
                return;
            Utils.forEach(list, s => s.fn(si));
        }
    }
}