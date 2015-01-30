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
     * tracking state.
     */
    export enum TrackingState
    {
        Added,
        Removed,
        Updated,
        Unknown
    }

    /**
     * Tracked element
     */
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

    /**
     *
     */
    export class TrackingData
    {
        private _trackings = {};

        /**
         * list of involved elements during a session
         * @returns {Array}
         */
        get involvedTrackedElements():ITrackedElement[]
        {
            return Utils.select(this._trackings, t=> t);
        }

        /**
         *
         * @param store
         * @returns {Array}
         * @private
         */
        __prepareTrackedElements(store:Store):ModelElement[]
        {
            var list = {};

            Utils.forEach(
                this.involvedTrackedElements, t=>
                {
                    if (list[t.id])
                    {
                        return;
                    }

                    if (t.state !== TrackingState.Removed)
                    {
                        var mel = store.get(t.id);
                        if (mel)
                        {
                            list[t.id] = mel;
                        }
                    }

                    if (!t.startId) // entity
                    {
                        return;
                    }

                    if (!list[t.startId] && this.getTrackedElementState(t.startId) !== TrackingState.Removed)
                    {
                        var mel = store.get(t.startId);
                        if (mel)
                        {
                            list[t.startId] = mel;
                            var info = this._trackings[t.startId];
                            if (!info)
                            {
                                this._trackings[t.startId] = {
                                    domain  : t.domain,
                                    state   : TrackingState.Unknown,
                                    id      : t.startId,
                                    schemaId: t.startSchemaId
                                };
                            }
                        }
                    }

                    if (!list[t.endId] && this.getTrackedElementState(t.endId) !== TrackingState.Removed)
                    {
                        var mel = store.get(t.endId);
                        if (mel)
                        {
                            list[t.endId] = mel;
                            var info = this._trackings[t.endId];
                            if (!info)
                            {
                                this._trackings[t.endId] = {
                                    domain  : t.domain,
                                    state   : TrackingState.Unknown,
                                    id      : t.endId,
                                    schemaId: t.endSchemaId
                                };
                            }
                        }
                    }
                }
            );

            return Utils.select(list, kv=> kv);
        }

        /**
         *
         * @param state
         * @returns {Array}
         */
        getTrackedElementsByState(state:TrackingState):ITrackedElement[]
        {
            return Utils.select(
                this._trackings, t=> t=> t.state === state
                    ? t
                    : undefined
            );
        }

        /**
         *
         * @param id
         * @returns {*}
         */
        getTrackedElementState(id:string):TrackingState
        {
            var info = this._trackings[id];
            if (!info)
            {
                return TrackingState.Unknown;
            }
            return info.state;
        }

        /**
         *
         * @param evt
         * @private
         */
        __onEvent(evt:any)
        {
            switch (evt.eventName)
            {
                case EventManager.AddEntityEvent:
                    this._trackings[evt.id] = {
                        domain  : evt.domain,
                        state   : TrackingState.Added,
                        id      : evt.id,
                        schemaId: evt.schemaId,
                        version : evt.version
                    };
                    break;
                case EventManager.RemoveEntityEvent:
                    var info = this._trackings[evt.id];
                    if (info)
                    {
                        info.state = TrackingState.Removed;
                    }
                    else
                    {
                        this._trackings[evt.id] = {
                            domain  : evt.domain,
                            state   : TrackingState.Removed,
                            id      : evt.id,
                            schemaId: evt.schemaId,
                            version : evt.version
                        };
                    }
                    break;
                case EventManager.AddRelationshipEvent:
                    this._trackings[evt.id] = {
                        domain       : evt.domain,
                        state        : TrackingState.Added,
                        id           : evt.id,
                        schemaId     : evt.schemaId,
                        version      : evt.version,
                        startId      : evt.startId,
                        startSchemaId: evt.startSchemaId,
                        endId        : evt.endId,
                        endSchemaId  : evt.endSchemaId
                    };
                    break;
                case EventManager.RemoveRelationshipEvent:
                    var info = this._trackings[evt.id];
                    if (info)
                    {
                        info.state = TrackingState.Removed;
                    }
                    else
                    {
                        this._trackings[evt.id] = {
                            domain       : evt.domain,
                            state        : TrackingState.Removed,
                            id           : evt.id,
                            schemaId     : evt.schemaId,
                            version      : evt.version,
                            startId      : evt.startId,
                            startSchemaId: evt.startSchemaId,
                            endId        : evt.endId,
                            endSchemaId  : evt.endSchemaId
                        };
                    }
                    break;
                case EventManager.ChangePropertyValueEvent:
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