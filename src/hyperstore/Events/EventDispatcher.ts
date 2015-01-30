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
module Hyperstore {

    /**
     * Internal use only
     */
    export interface __HandlerInfo {
        domain: string;
        handler: IEventHandler;
    }

    /**
     *
     */
    export class EventDispatcher  {
        private _handlers;

        /**
         *
         * @param store
         */
        constructor(public store:Store) {
            this._handlers = {};
            this.registerHandler(
                {
                    eventName: EventManager.AddEntityEvent,
                    execute: function (d, evt) {
                        var schema = d.store.getSchemaEntity(evt.schemaId);
                        d.create(schema, evt.id, evt.version);
                    }
                }
            );

            this.registerHandler(
                {
                    eventName: EventManager.RemoveEntityEvent,
                    execute: function (d:DomainModel, evt) {
                        var mel = d.get(evt.id);
                        if (!mel) {
                            throw "Invalid element";
                        }
                        d.remove(evt.id, evt.version);
                    }
                }
            );

            this.registerHandler(
                {
                    eventName: EventManager.AddRelationshipEvent,
                    execute: function (d, evt) {
                        var schema = d.store.getSchemaRelationship(evt.schemaId);
                        var start = d.get(evt.startId);
                        if (!start) {
                            throw "Invalid source element for relationship " + evt.id;
                        }
                        d.createRelationship(schema, start, evt.endId, evt.endSchemaId, evt.id, evt.version);
                    }
                }
            );

            this.registerHandler(
                {
                    eventName: EventManager.RemoveRelationshipEvent, execute: function (d:DomainModel, evt) {
                    var mel = d.get(evt.id);
                    if (!mel) {
                        throw "Invalid element";
                    }
                    d.remove(evt.id, evt.version);
                }
                }
            );

            this.registerHandler(
                {
                    eventName: EventManager.ChangePropertyValueEvent,
                    execute: function (d, evt) {
                        var schema = <SchemaEntity>d.store.getSchemaEntity(evt.schemaId);
                        var property = schema.getProperty(evt.propertyName, true);
                        if (property) {
                            d.setPropertyValue(evt.id, property, evt.value, evt.version);
                        }
                    }
                }
            );
        }

        /**
         *
         * @param handler
         * @param domain
         */
        registerHandler(handler:IEventHandler, domain?:string) {
            var key = handler.eventName || "*";
            var handlers = this._handlers[key];
            if (!handlers) {
                handlers = [];
                this._handlers[key] = handlers;
            }
            handlers.push({domain: domain, handler: handler});
        }

        handleEvent(event:AbstractEvent) {
            if (!Session.current) {
                throw "Session required.";
            }

            var key = event.eventName;
            var flag = this.executeHandlers(key, event);
            if (this.executeHandlers("*", event)) {
                flag = true;
            }

            if (!flag && event.correlationId !== Session.current.sessionId && !Session.current.closed) {
                Session.current.addEvent(event);
            }
        }

        _getDomain(domainName:string):DomainModel {
            return Session.current  && this.store.hasDomainExtensions ? Session.current.getDomain(domainName) : this.store.getDomain(domainName);
        }

        _getHandlers(key:string) : __HandlerInfo[] {
            return this._handlers[key];
        }

        private executeHandlers(key:string, event:AbstractEvent):boolean {
            var handlers = this._getHandlers(key);
            if (!handlers) {
                return false;
            }
            var domain = this._getDomain(event.domain);
            if (!domain) {
                return false;
            }

            for (var i = 0; i < handlers.length; i++) {
                var handlerInfo = <__HandlerInfo>handlers[i];
                if (!handlerInfo.domain || event.domain === handlerInfo.domain) {
                    handlerInfo.handler.execute(domain, event);
                }
            }
            return handlers.length > 0;
        }
    }

    /**
     * Domain event dispatcher - Process only events targeting a domain
     */
    export class DomainEventDispatcher extends EventDispatcher {

        /**
         * create a new DomainEventDispatcher instance
         * @param domain - Domain to target
         */
        constructor(public domain:DomainModel, private _dispatcherToUse?:EventDispatcher) {
            super(domain.store);
        }

        _getHandler(key:string) : __HandlerInfo[] {
            return this._dispatcherToUse && this._dispatcherToUse._getHandlers(key) || super._getHandlers(key);
        }

        _getDomain(domainName:string) : DomainModel {
            return domainName === this.domain.name ? this.domain : null;
        }
    }
}