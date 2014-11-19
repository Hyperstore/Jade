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
        handleEvent(event:AbstractEvent);
    }

    export interface IEventHandler
    {
        eventName: string;
        execute(domain:DomainModel, event);
    }

    export interface IUndoableEvent
    {
        getReverseEvent(correlationId:number): AbstractEvent;
    }

    export class AbstractEvent
    {
        constructor(public eventName:string, public domain:string, public correlationId:number, public version:number) { }

        toString():string
        {
            return JSON.stringify(this);
        }
    }

    export class AddEntityEvent extends AbstractEvent implements IUndoableEvent
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

    export class RemoveEntityEvent extends AbstractEvent implements IUndoableEvent
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

    export class AddRelationshipEvent extends AbstractEvent implements IUndoableEvent
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

    export class RemoveRelationshipEvent extends AbstractEvent implements IUndoableEvent
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

    export class ChangePropertyValueEvent extends AbstractEvent implements IUndoableEvent
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

    export class RemovePropertyEvent extends AbstractEvent implements IUndoableEvent
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
        events: Array<AbstractEvent>;
        mode: SessionMode;
    }

    export class EventManager
    {
        private _subscriptions;
        static AddEntityEvent = "AddEntityEvent";
        static RemoveEntityEvent = "RemoveEntityEvent";
        static AddRelationshipEvent = "AddRelationshipEvent";
        static ChangePropertyValueEvent = "ChangePropertyValueEvent";
        static RemoveRelationshipEvent = "RemoveRelationshipEvent";
        static RemovePropertyEvent = "RemovePropertyEvent";
        static SessionCompleted = "SessionCompleted";

        constructor(private domain:string)
        {
        }

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

        public onAddEntity(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.AddEntityEvent, callback);
        }

        public onRemoveEntity(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.RemoveEntityEvent, callback);
        }

        public onAddRelationship(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.AddRelationshipEvent, callback);
        }

        public onRemoveRelationship(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.RemoveRelationshipEvent, callback);
        }

        public onChangeProperty(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.ChangePropertyValueEvent, callback);
        }

        public onSessionCompleted(callback: (s:SessionInfo, e:AddEntityEvent)=>void): any {
            return this.on(EventManager.SessionCompleted, callback);
        }

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