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
     * Event bus - You must add a channel to define the protocol used to communicate between store
     *
     * Every time a session is completed with no errors or warnings, a message is send by channels. If no channels
     * are configured nothing happens.
     */
    export class EventBus
    {
        private _channels:Array<AbstractChannel>;
        /**
         * Event dispatcher. See [[IEventHandler]]
         */
        public defaultEventDispatcher:IEventDispatcher;
        private cookie;

        /**
         * dot not call this constructor
         * @private
         * @param store
         * @param eventDispatcher
         */
        constructor(private store:Store, eventDispatcher?:IEventDispatcher)
        {
            this.cookie = store.onSessionCompleted(s=> this.sendEvents(s));
            this._channels = [];
            this.defaultEventDispatcher = eventDispatcher || new EventDispatcher(store);
        }

        /**
         * close all channels when the store is disposed
         */
        dispose()
        {
            this.store.removeSessionCompleted(this.cookie);
            this._channels.forEach(c=> c.close());
            this._channels = undefined;
        }

        /**
         * add a new [[AbstractChannel]] to the event bus. AbstractChannel are not enabled until [[EventBus.start]] is called.
         * @param channel - a channel instance
         */
        addChannel(channel:AbstractChannel)
        {
            this._channels.push(channel);

        }

        /**
         * start all registered channels. This is a async method, the callback function is called when all channels
         * are open.
         * @param callback
         */
        start(callback?:(channel) => any) // TODO Promise when all channels are opened
        {
            var self = this;
            this._channels.forEach(
                function (c)
                {
                    c.eventBus = self;
                    c.start(callback);
                }
            );
        }

        private sendEvents(s:Session)
        {
            if (s.aborted || s.originStoreId !== this.store.storeId || s.result.hasErrorsOrWarnings)
            {
                return;
            }

            this._channels.forEach(c=> c._sendEvents(s));
        }
    }
}