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
     * Event dispatcher manage [[EventHandler]]. There is one dispatcher by channel initialized from [[EventBus.defaultEventDispatcher]].
     */
    export interface IEventDispatcher
    {
        handleEvent(event:AbstractEvent);
    }

    /**
     * Interface for event handler.
     *
     * Event handler are used when an event is received by the [[EventBus]]. Handlers for built-in events are registered
     * by the [[EventBus]].
     *
     * If you create a custom event, you must provide its event handler and register it in the [[EventDispatcher]] get
     *  from [[EventBus.defaultEventDispatcher]].
     *
     */
    export interface IEventHandler
    {
        eventName: string;
        execute(domain:DomainModel, event);
    }

    /**
     * interface for event providing a undoable event. see [[UndoManager]]
     */
    export interface IUndoableEvent
    {
        /**
         * get the reverse event
         * @param correlationId - current session id
         */
        getReverseEvent(correlationId:number): AbstractEvent;
    }

    /**
     * Abstract event all events must inherits
     */
    export class AbstractEvent
    {
        /**
         * Top Level event (see remove element)
         * @type {boolean}
         */
        public TL:boolean = true;

        /**
         *
         * @param eventName - event name. See [[EventManager]]
         * @param domain - domain of element
         * @param correlationId - session id
         * @param version - element version
         */
        constructor(public eventName:string, public domain:string, public correlationId:number, public version:number) { }

        toString():string
        {
            return JSON.stringify(this);
        }
    }

    /**
     * Event raised when an entity is added
     */
    export class AddEntityEvent extends AbstractEvent implements IUndoableEvent
    {
        /**
         *
         * @param domain - domain of element
         * @param id - element id
         * @param schemaId - element schema id
         * @param correlationId - session id
         * @param version - element version
         */
        constructor(domain:string, public id:string, public schemaId:string, correlationId:number, version:number)
        {
            super(EventManager.AddEntityEvent, domain, correlationId, version);
        }

        getReverseEvent(correlationId:number)
        {
            return new RemoveEntityEvent(this.domain, this.id, this.schemaId, correlationId, this.version);
        }
    }

    /**
     * Event raised when an entity is removed
     */
    export class RemoveEntityEvent extends AbstractEvent implements IUndoableEvent
    {
        /**
         *
         * @param domain - domain of element
         * @param id - element id
         * @param schemaId - element schema id
         * @param correlationId - session id
         * @param version - element version
         */
        constructor(domain:string, public id:string, public schemaId:string, correlationId:number, version:number)
        {
            super(EventManager.RemoveEntityEvent, domain, correlationId, version);
        }

        getReverseEvent(correlationId:number)
        {
            return new AddEntityEvent(this.domain, this.id, this.schemaId, correlationId, this.version);
        }
    }

    /**
     * event raised when a relationship is added
     */
    export class AddRelationshipEvent extends AbstractEvent implements IUndoableEvent
    {
        /**
         *
         * @param domain - domain of relationship
         * @param id - relationship id
         * @param schemaId - relationship schema id
         * @param startId - start element id
         * @param startSchemaId - start schema id
         * @param endId - end element id
         * @param endSchemaId - end schema id
         * @param correlationId - session id
         * @param version - relationship version
         */
        constructor(domain:string, public id:string, public schemaId:string, public startId:string, public startSchemaId:string, public endId:string, public endSchemaId:string,
                    correlationId:number, version:number)
        {
            super(EventManager.AddRelationshipEvent, domain, correlationId, version);
        }

        getReverseEvent(correlationId:number)
        {
            return new RemoveRelationshipEvent(this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId, correlationId, this.version);
        }
    }

    /**
     * event raised when a relationship is removed
     */
    export class RemoveRelationshipEvent extends AbstractEvent implements IUndoableEvent
    {
        /**
         *
         * @param domain - domain of relationship
         * @param id - relationship id
         * @param schemaId - relationship schema id
         * @param startId - start element id
         * @param startSchemaId - start schema id
         * @param endId - end element id
         * @param endSchemaId - end schema id
         * @param correlationId - session id
         * @param version - relationship version
         */
        constructor(domain:string, public id:string, public schemaId:string, public startId:string, public startSchemaId:string, public endId:string, public endSchemaId:string,
                    correlationId:number, version:number)
        {
            super(EventManager.RemoveRelationshipEvent, domain, correlationId, version);
        }

        getReverseEvent(correlationId:number)
        {
            return new AddRelationshipEvent(this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId, correlationId, this.version);
        }
    }

    /**
     * Event raised when a property value change.
     */
    export class ChangePropertyValueEvent extends AbstractEvent implements IUndoableEvent
    {
        /**
         *
         * @param domain - domain of owner element
         * @param id - element id
         * @param schemaId - element schema id
         * @param propertyName - property name
         * @param value - new value
         * @param oldValue - old value
         * @param correlationId - session id
         * @param version - property value version
         */
        constructor(domain:string, public id:string, public schemaId:string, public propertyName:string, public value:any, public oldValue:any,
                    correlationId:number, version:number)
        {
            super(EventManager.ChangePropertyValueEvent, domain, correlationId, version);

        }

        getReverseEvent(correlationId:number)
        {
            return new ChangePropertyValueEvent(this.domain, this.id, this.schemaId, this.propertyName, this.oldValue, this.value, correlationId, this.version);
        }
    }

    /**
     * Event raised when a property is removed - A property is removed when its element owner is removed
     */
    export class RemovePropertyEvent extends AbstractEvent implements IUndoableEvent
    {
        /**
         *
         * @param domain - domain of owner element
         * @param id - element id
         * @param schemaId - element schema id
         * @param propertyName - property name
         * @param value - new value
         * @param correlationId - session id
         * @param version - property value version
         */
        constructor(domain:string, public id:string, public schemaId:string, public propertyName:string, public value:any,
                    correlationId:number, version:number)
        {
            super(EventManager.RemovePropertyEvent, domain, correlationId, version);
            this.TL = false;
        }

        getReverseEvent(correlationId:number)
        {
            return new ChangePropertyValueEvent(this.domain, this.id, this.schemaId, this.propertyName, this.value, undefined, correlationId, this.version);
        }
    }

    export interface SessionInfo
    {
        aborted: boolean;
        sessionId: number;
        events: Array<AbstractEvent>;
        mode: SessionMode;
    }

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
        public onEntityAdded(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.AddEntityEvent, callback);
        }

        /**
         * subscribe to 'removeEntity' same as *on('removeEntity')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onEntityRemoved(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.RemoveEntityEvent, callback);
        }

        /**
         * subscribe to 'addRelationship' same as *on('addRelationship')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onRelationshipAdded(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.AddRelationshipEvent, callback);
        }

        /**
         * subscribe to 'removeRelationship' same as *on('removeRelationship')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onRelationshipRemoved(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.RemoveRelationshipEvent, callback);
        }

        /**
         * subscribe to 'change' same as *on('change')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onPropertyChanged(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.ChangePropertyValueEvent, callback);
        }

        /**
         * subscribe to session completed event same as *on('sessionCompleted')*.
         *
         * @param callback - function called when event is emitted.
         * @returns a cookie used to un subscribe to this event (see [[EventManager.remove]]).
         */
        public onSessionCompleted(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
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
        public on(eventName:string, callback) : any {
            if( !eventName || !callback)
                return;

            if(!this._subscriptions)
                this._subscriptions = {};

            var list = this._subscriptions[eventName];
            if(!list)
                this._subscriptions[eventName] = list = [];

            var ix = list.length;
            list.push({ix:ix, fn:callback});
            return {e:eventName, ix:ix};
        }

        /**
         * un subscribe to event using the cookie of the [[EventManager.on]] method.
         * @param cookie - valid cookie
         * @returns [[EventManager]]
         */
        public remove(cookie):EventManager {
            if( !cookie || !cookie.ix)
                return this;

            var list = this._subscriptions[cookie.e];
            if( !list)
                return this;
            var pos = Utils.indexOf(this._subscriptions, s=> s.ix===cookie);
            if( pos >= 0)
            {
                list.splice(cookie.ix, 1);
                if (list.length === 0)
                    delete this._subscriptions[cookie.e];
            }
            return this;
        }

        __notifySessionCompleted(session:Session)
        {
            if(!this._subscriptions)
                return;

            var si = {
                aborted:   session.aborted,
                mode:      session.mode,
                sessionId: session.sessionId,
                events:    session.events.filter(e=> e.domain === this.domain)
            };

            for(var i=0;i<si.events.length;i++)
            {
                var evt = si.events[i];
                var list = this._subscriptions[evt.eventName];
                if( !list)
                    continue;

                Utils.forEach(list, s => s.fn(si, evt));
            }

            var list = this._subscriptions[EventManager.SessionCompleted];
            if( !list)
                return;
            Utils.forEach(list, s => s.fn(si));
        }
    }
}