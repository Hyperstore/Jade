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

    export interface IEventDispatcher
    {
        handleEvent(event:Event);
    }

    export interface IEventHandler
    {
        eventName: string;
        execute(domain:DomainModel, event);
    }

    export interface IUndoableEvent
    {
        getReverseEvent(correlationId:number): Event;
    }

    export class Event
    {
        constructor(public eventName:string, public domain:string, public correlationId:number, public version:number) { }

        toString():string
        {
            return JSON.stringify(this);
        }
    }

    export class AddEntityEvent extends Event implements IUndoableEvent
    {
        constructor(domain:string, public id:string, public schemaId:string, correlationId:number, version:number)
        {
            super("AddEntityEvent", domain, correlationId, version);
        }

        getReverseEvent(correlationId:number)
        {
            return new RemoveEntityEvent(this.domain, this.id, this.schemaId, correlationId, this.version);
        }
    }

    export class RemoveEntityEvent extends Event implements IUndoableEvent
    {
        constructor(domain:string, public id:string, public schemaId:string, correlationId:number, version:number)
        {
            super("RemoveEntityEvent", domain, correlationId, version);
        }

        getReverseEvent(correlationId:number)
        {
            return new AddEntityEvent(this.domain, this.id, this.schemaId, correlationId, this.version);
        }
    }

    export class AddRelationshipEvent extends Event implements IUndoableEvent
    {
        constructor(domain:string, public id:string, public schemaId:string, public startId:string, public startSchemaId:string, public endId:string, public endSchemaId:string,
                    correlationId:number, version:number)
        {
            super("AddRelationshipEvent", domain, correlationId, version);
        }

        getReverseEvent(correlationId:number)
        {
            return new RemoveRelationshipEvent(this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId, correlationId, this.version);
        }
    }

    export class RemoveRelationshipEvent extends Event implements IUndoableEvent
    {
        constructor(domain:string, public id:string, public schemaId:string, public startId:string, public startSchemaId:string, public endId:string, public endSchemaId:string,
                    correlationId:number, version:number)
        {
            super("RemoveRelationshipEvent", domain, correlationId, version);
        }

        getReverseEvent(correlationId:number)
        {
            return new AddRelationshipEvent(this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId, correlationId, this.version);
        }
    }

    export class ChangePropertyValueEvent extends Event implements IUndoableEvent
    {
        constructor(domain:string, public id:string, public schemaId:string, public propertyName:string, public value:any, public oldValue:any,
                    correlationId:number, version:number)
        {
            super("ChangePropertyValueEvent", domain, correlationId, version);

        }

        getReverseEvent(correlationId:number)
        {
            return new ChangePropertyValueEvent(this.domain, this.id, this.schemaId, this.propertyName, this.oldValue, this.value, correlationId, this.version);
        }
    }

    export class RemovePropertyEvent extends Event implements IUndoableEvent
    {
        constructor(domain:string, public id:string, public schemaId:string, public propertyName:string, public value:any,
                    correlationId:number, version:number)
        {
            super("RemovePropertyEvent", domain, correlationId, version);
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
        events: Array<Event>;
        mode: SessionMode;
    }

    export class EventManager
    {
        private _subscriptions;
        static _counter = 0;

        constructor(private domain:string)
        {
            this._subscriptions = [];
        }

        dispose()
        {
            this._subscriptions = undefined;
        }

        static createEvent(eventName:string)
        {
            switch (eventName)
            {
                case "AddEntityEvent":
                    return Object.create(AddEntityEvent);
                case "RemoveEntityEvent":
                    return Object.create(RemoveEntityEvent);
                case "AddRelationshipEvent":
                    return Object.create(AddRelationshipEvent);
                case "ChangePropertyValueEvent":
                    return Object.create(ChangePropertyValueEvent);
                case "RemoveRelationshipEvent":
                    return Object.create(RemoveRelationshipEvent);
                case "RemovePropertyEvent":
                    return Object.create(RemovePropertyEvent);
                default:
                    return undefined;
            }
        }

        public subscribeSessionCompleted(action:(s:SessionInfo) => any):number
        {
            var cookie = EventManager._counter++;
            this._subscriptions.push({cookie: cookie, action: action});
            return cookie;
        }

        public unsubscribeSessionCompleted(cookie:number)
        {
            this._subscriptions.splice(cookie);
        }

        __onSessionCompleted(session:Session)
        {
            Utils.forEach(this._subscriptions,
                    info => info.action({
                    aborted:   session.aborted,
                    mode:      session.mode,
                    sessionId: session.sessionId,
                    events:    Utils.where(session.events, e=> e.domain === this.domain)
                })
            );
        }

    }
}