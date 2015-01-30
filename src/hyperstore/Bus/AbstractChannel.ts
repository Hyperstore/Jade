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
     * abstract channel.
     *
     * A channel is always associated with a domain and only send or receive events
     * involving this domain.
     */
    export class AbstractChannel
    {
        public eventBus:EventBus;
        public domain:DomainModel

        /**
         * Event dispatcher. See [[IEventHandler]].
         *
         * Initialized from [[EventBus.defaultEventDispatcher]]
         */
        public dispatcher:EventDispatcher;

        constructor()
        {
        }

        /**
         * associate a channel with a domain.
         * @param domain
         */
        associate(domain:DomainModel) {
            this.domain = domain;
        }

        /**
         * open channel
         * @param callback
         */
        start(callback?:(channel) => any)
        {
            this.dispatcher = this.domain.eventDispatcher || this.eventBus.defaultEventDispatcher;
        }

        /**
         * close channel
         */
        close()
        {
            this.eventBus = null;
            this.dispatcher = null;
        }

        /**
         * send events (internal use only) - Prepare the message from a session state
         * @param session
         * @private
         */
        _sendEvents(session:Session)
        {
            if (session.originStoreId !== this.domain.store.storeId)
            {
                return;
            }

            var self = this;
            var message = {
                origin     : self.domain.store.storeId,
                sessionId  : session.sessionId,
                sessionMode: session.mode,
                events     : Utils.select(
                    session.events, function (e:AbstractEvent)
                    {
                        if (self._shouldBePropagated(e))
                        {
                            return {eventName: e.eventName, Data: JSON.stringify(e)};
                        }
                    }
                )
            };

            this.sendMessage(message);
        }

        /**
         * override this function to send message over your custom channel
         * @param message
         */
        sendMessage(message:Message)
        {
            console.log("Message " + JSON.stringify(message));
        }

        /**
         * Filter - Send only top level events impacting the current domain.
         * Override it to filter events
         * @param evt - event to filter
         * @returns {boolean} - false to ignore this event
         * @private
         */
        _shouldBePropagated(evt:AbstractEvent):boolean
        {
            return evt.domain === this.domain.name && evt.TL;
        }
    }
}