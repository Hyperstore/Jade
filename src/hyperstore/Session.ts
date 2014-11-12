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
    export enum SessionMode
    {
        Normal = 0,
        Loading = 4,
        Undo = 8,
        Redo = 16,
        UndoOrRedo = 24,
        Serializing = 32,
        SilentMode = 64,
    }

    export interface SessionConfiguration
    {
        defaultDomain?: DomainModel;
        mode?: SessionMode;
        sessionId?: number;
        origin?: string;
    }

    export class SessionResult
    {
        public aborted:boolean;
        public messages = [];
        public hasErrors:boolean = false;
        public hasWarnings:boolean = false;
        public involvedElements:ModelElement[];
        public maxVersionNumber:number;

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

    export class Session
    {
        public events:Array<Event>;
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

        constructor(public store:Store, private config?:SessionConfiguration)
        {
            this.events = new Array<Event>();
            this.aborted = false;
            this._depth = 0;
            this.closed = false;
            this.originStoreId = store.storeId;
            this.mode = SessionMode.Normal;
            this.trackingData = new TrackingData();
            this.result = new SessionResult();
            this.result.maxVersionNumber = 0;

            if (config != undefined && config.origin != undefined)
            {
                this.originStoreId = config.origin;
            }

            if (config != undefined && config.sessionId != undefined)
            {
                this.sessionId = config.sessionId;
            }
            else
            {
                Session._sequence++;
                this.sessionId = Session._sequence;
            }
            if (config != undefined)
            {
                if (config.mode != undefined)
                {
                    this.mode = config.mode;
                }
            }
            this.__nextLevel();
        }

        __nextLevel()
        {
            if (this.closed)
            {
                throw "Can not reused a closed session";
            }

            this._depth++;
            this._committed = false;
        }

        acceptChanges()
        {
            if (this.closed)
            {
                throw "Can not reused a closed session";
            }
            this._committed = true;
        }

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

            if (this.aborted)
            {
                // Rollback
                //var d = new EventDispatcher(this.store);
                //Utils.forEach(this.events.reverse(), e=> d.handleEvent(e.getReverseEvent()));
            }

            Session.current = undefined;

            var self = this;
            this.store.domains.forEach(d=> (<DomainModel>d).events.__onSessionCompleted(self));
            this.store.__sendSessionCompletedEvent(self);

            return this.result;
        }

        private executeConstraints(elements:ModelElement[])
        {
            var constraintsManager = Utils.groupBy(elements, e=> e.schemaElement.schema.constraints);

            var messages = [];
            Utils.forEach(constraintsManager, m =>
                {
                    var manager = m.key;
                    messages = messages.concat(manager.checkElements(m.value));
                }
            );
            return messages;
        }

        addEvent(evt:Event)
        {
            if (this.closed)
            {
                throw "Can not reused a closed session";
            }

            this.events.push(evt);
            this.trackingData.__onEvent(evt);
            if (evt.version > this.result.maxVersionNumber)
            {
                this.result.maxVersionNumber = evt.version;
            }
        }
    }

    export enum TrackingState
    {
        Added,
        Removed,
        Updated,
        Unknown
    }

    export interface ITrackedElement
    {
        domain: string;
        state: TrackingState;
        id: string;
        schemaId: string;
        version?: number;
        startId?: string;
        startSchemaId?: string;
        endId?: string;
        endSchemaId?: string;
        properties?;
    }

    export class TrackingData
    {
        private _trackings = {};

        get involvedTrackedElements():ITrackedElement[]
        {
            return Utils.select(this._trackings, t=> t);
        }

        __prepareTrackedElements(store:Store):ModelElement[]
        {
            var list = {};

            Utils.forEach(this.involvedTrackedElements, t=>
            {
                if (list[t.id] != undefined)
                {
                    return;
                }

                if (t.state != TrackingState.Removed)
                {
                    var mel = store.getElement(t.id);
                    if (mel != undefined)
                    {
                        list[mel.id] = mel;
                    }
                }

                if (!t.startId) // entity
                {
                    return;
                }

                if (!list[t.startId] && this.getTrackedElementState(t.startId) !== TrackingState.Removed)
                {
                    var mel = store.getElement(t.startId);
                    if (mel)
                    {
                        list[mel.id] = mel;
                        var info = this._trackings[t.startId];
                        if (!info)
                        {
                            this._trackings[t.startId] = {
                                domain:   t.domain,
                                state:    TrackingState.Unknown,
                                id:       t.startId,
                                schemaId: t.startSchemaId
                            };
                        }
                    }
                }

                if (!list[t.endId] && this.getTrackedElementState(t.endId) !== TrackingState.Removed)
                {
                    var mel = store.getElement(t.endId);
                    if (mel)
                    {
                        list[mel.id] = mel;
                        var info = this._trackings[t.endId];
                        if (!info)
                        {
                            this._trackings[t.endId] = {
                                domain:   t.domain,
                                state:    TrackingState.Unknown,
                                id:       t.endId,
                                schemaId: t.endSchemaId
                            };
                        }
                    }
                }
            });

            return Utils.select(list, kv=> kv);
        }

        getTrackedElementsByState(state:TrackingState):ITrackedElement[]
        {
            return Utils.select(this._trackings, t=> t=> t.state === state
                ? t
                : undefined);
        }

        getTrackedElementState(id:string):TrackingState
        {
            var info = this._trackings[id];
            if (!info)
            {
                return TrackingState.Unknown;
            }
            return info.state;
        }

        __onEvent(evt:any)
        {
            switch (evt.eventName)
            {
                case "AddEntityEvent":
                    this._trackings[evt.id] = {
                        domain:   evt.domain,
                        state:    TrackingState.Added,
                        id:       evt.id,
                        schemaId: evt.schemaId,
                        version:  evt.version
                    };
                    break;
                case "RemoveEntityEvent":
                    var info = this._trackings[evt.id];
                    if (!info)
                    {
                        info.state = TrackingState.Removed;
                    }
                    else
                    {
                        this._trackings[evt.id] = {
                            domain:   evt.domain,
                            state:    TrackingState.Removed,
                            id:       evt.id,
                            schemaId: evt.schemaId,
                            version:  evt.version
                        };
                    }
                    break;
                case "AddRelationshipEvent":
                    this._trackings[evt.id] = {
                        domain:        evt.domain,
                        state:         TrackingState.Added,
                        id:            evt.id,
                        schemaId:      evt.schemaId,
                        version:       evt.version,
                        startId:       evt.startId,
                        startSchemaId: evt.startSchemaId,
                        endId:         evt.endId,
                        endSchemaId:   evt.endSchemaId
                    };
                    break;
                case "RemoveRelationshipEvent":
                    var info = this._trackings[evt.id];
                    if (!info)
                    {
                        info.state = TrackingState.Removed;
                    }
                    else
                    {
                        this._trackings[evt.id] = {
                            domain:        evt.domain,
                            state:         TrackingState.Removed,
                            id:            evt.id,
                            schemaId:      evt.schemaId,
                            version:       evt.version,
                            startId:       evt.startId,
                            startSchemaId: evt.startSchemaId,
                            endId:         evt.endId,
                            endSchemaId:   evt.endSchemaId
                        };
                    }
                    break;
                case "ChangePropertyValueEvent":
                    var info = this._trackings[evt.id];
                    if (!info)
                    {
                        info = {domain: evt.domain, state: TrackingState.Updated, id: evt.id, schemaId: evt.schemaId};
                        this._trackings[evt.id] = info;
                    }

                    if (!info.properties)
                    {
                        info.properties = {};
                    }

                    var pv = new PropertyValue(evt.value, evt.oldValue, evt.version);

                    info.properties[evt.propertyName] = pv;
                    if (evt.version > info.version)
                    {
                        info.version = evt.version;
                    }
                    break;
            }
        }
    }
}