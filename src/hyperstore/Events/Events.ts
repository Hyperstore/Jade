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
         * @param version - element version
         * @param correlationId - session id
         */
        constructor(public eventName:string, public domain:string, public version:number, public correlationId?:number)
        { }

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
         * @param version - element version
         * @param correlationId - session id
         */
        constructor(domain:string, public id:string, public schemaId:string, version:number, correlationId?:number)
        {
            super(EventManager.AddEntityEvent, domain, version, correlationId);
        }

        getReverseEvent(correlationId:number)
        {
            return new RemoveEntityEvent(this.domain, this.id, this.schemaId, this.version, correlationId);
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
         * @param version - element version
         * @param correlationId - session id
         */
        constructor(domain:string, public id:string, public schemaId:string, version:number, correlationId?:number)
        {
            super(EventManager.RemoveEntityEvent, domain, version, correlationId);
        }

        getReverseEvent(correlationId:number)
        {
            return new AddEntityEvent(this.domain, this.id, this.schemaId, this.version, correlationId);
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
         * @param version - relationship version
         * @param correlationId - session id
         */
        constructor(
            domain:string, public id:string, public schemaId:string, public startId:string, public startSchemaId:string, public endId:string, public endSchemaId:string,
            version:number, correlationId?:number)
        {
            super(EventManager.AddRelationshipEvent, domain, version, correlationId);
        }

        getReverseEvent(correlationId:number)
        {
            return new RemoveRelationshipEvent(
                this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId,
                this.version, correlationId
            );
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
         * @param version - relationship version
         * @param correlationId - session id
         */
        constructor(
            domain:string, public id:string, public schemaId:string, public startId:string, public startSchemaId:string, public endId:string, public endSchemaId:string,
            version:number, correlationId?:number)
        {
            super(EventManager.RemoveRelationshipEvent, domain, version, correlationId);
        }

        getReverseEvent(correlationId:number)
        {
            return new AddRelationshipEvent(
                this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId,
                this.version, correlationId
            );
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
         * @param version - property value version
         * @param correlationId - session id
         */
        constructor(
            domain:string, public id:string, public schemaId:string, public propertyName:string, public value:any, public oldValue:any,
            version:number, correlationId?:number )
        {
            super(EventManager.ChangePropertyValueEvent, domain, version, correlationId);

        }

        getReverseEvent(correlationId:number)
        {
            return new ChangePropertyValueEvent(
                this.domain, this.id, this.schemaId, this.propertyName, this.oldValue, this.value,
                this.version, correlationId
            );
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
         * @param version - property value version
         * @param correlationId - session id
         */
        constructor(
            domain:string, public id:string, public schemaId:string, public propertyName:string, public value:any,
            version:number, correlationId?:number)
        {
            super(EventManager.RemovePropertyEvent, domain, version, correlationId);
            this.TL = false;
        }

        getReverseEvent(correlationId:number)
        {
            return new ChangePropertyValueEvent(
                this.domain, this.id, this.schemaId, this.propertyName, this.value, undefined,
                this.version, correlationId
            );
        }
    }

    export interface SessionInfo
    {
        aborted: boolean;
        sessionId: number;
        events: Array<AbstractEvent>;
        mode: SessionMode;
    }
}