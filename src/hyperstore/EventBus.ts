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

/// <reference path="../../scripts/typings/signalr/signalr.d.ts" />

module Hyperstore
{
    // ---------------------------------------------------------------------------------------
    // Share message sending over the event bus. There is one message by session
    // ---------------------------------------------------------------------------------------
    export interface Message
    {
        origin: string;             // store id initiating the change
        sessionId: number;
        sessionMode: SessionMode;
        events: AbstractEvent[];       // list of events
    }

    // ---------------------------------------------------------------------------------------
    // abstract Channel - 
    // ---------------------------------------------------------------------------------------
    export class Channel
    {

        public eventBus:EventBus;
        public dispatcher:IEventDispatcher;

        constructor(public domain:DomainModel)
        {
        }

        start(callback?:(channel) => any)
        {
            this.dispatcher = this.domain.eventDispatcher || this.eventBus.defaultEventDispatcher;
        }

        // ---------------------------------------------------------------------------------------
        // close channel
        // ---------------------------------------------------------------------------------------
        close()
        {
            this.eventBus = null;
            this.dispatcher = null;
        }

        // ---------------------------------------------------------------------------------------
        // send events (internal use only) - Prepare the message from a session state
        // ---------------------------------------------------------------------------------------
        _sendEvents(session:Session)
        {

            if (session.originStoreId !== this.domain.store.storeId)
            {
                return;
            }

            var self = this;
            var message = {
                origin:      self.domain.store.storeId,
                sessionId:   session.sessionId,
                sessionMode: session.mode,
                events:      Utils.select(session.events, function (e:AbstractEvent)
                {
                    if (self._shouldBePropagated(e))
                    {
                        return {eventName: e.eventName, Data: JSON.stringify(e)};
                    }
                })
            };

            this.sendMessage(message);
        }

        // ---------------------------------------------------------------------------------------
        // override this function to send message over your custom channel
        // ---------------------------------------------------------------------------------------
        sendMessage(message:Message)
        {
            console.log("Message " + JSON.stringify(message));
        }

        // ---------------------------------------------------------------------------------------
        // Filter - Send only events impacting the current domain.
        // Override it to filter events
        // ---------------------------------------------------------------------------------------
        _shouldBePropagated(evt:AbstractEvent):boolean
        {
            return evt.domain === this.domain.name;
        }
    }

    // ---------------------------------------------------------------------------------------
    // AbstractEvent bus - You must add a channel to define the protocol used to communicate
    // ---------------------------------------------------------------------------------------
    export class EventBus
    {
        private _channels:Array<Channel>;
        public defaultEventDispatcher:IEventDispatcher;
        private cookie;

        constructor(private store:Store, eventDispatcher?:IEventDispatcher)
        {
            this.cookie = store.onSessionCompleted(s=> this.sendEvents(s));
            this._channels = [];
            this.defaultEventDispatcher = eventDispatcher || new EventDispatcher(store);
        }

        dispose()
        {
            this.store.removeSessionCompleted(this.cookie);
            this._channels.forEach(c=> c.close());
            this._channels = undefined;
        }

        addChannel(channel:Channel)
        {
            this._channels.push(channel);

        }

        start(callback?:(channel) => any)
        {
            var self=this;
            this._channels.forEach(function(c)
            {
                c.eventBus = self;
                c.start(callback);
            });
        }

        private sendEvents(s:Session)
        {
            if (s.aborted || s.originStoreId !== this.store.storeId || s.result.hasErrorsOrWarnings)
            {
                return;
            }

            this._channels.forEach( c=> c._sendEvents(s));
        }
    }

    export class SignalRChannel extends Channel
    {
        private proxy:HubProxy;

        constructor(domain:DomainModel, public hub?)
        {
            super(domain);
            var self = this;

            this.hub = hub || $.hubConnection();
            //this.hub.logging = true;

            this.proxy = this.hub.createHubProxy('hyperstore');
            this.proxy.on('onEvents', function (env)
            {
                if (env.origin === self.domain.store.storeId)
                {
                    return;
                }

                var session = self.domain.store.beginSession({origin: env.origin});
                try
                {
                    Utils.forEach(env.events, function (e)
                    {
                        var evt = EventManager.createEvent(e.eventName);
                        if (!evt)
                        {
                            evt = {};
                            evt.eventName = e.eventName;
                        }

                        var obj = JSON.parse(e.data);
                        for (var f in obj)
                        {
                            if (obj.hasOwnProperty(f))
                            {
                                evt[f] = obj[f];
                            }
                        }

                        self.dispatcher.handleEvent(evt);
                    });

                    session.acceptChanges();
                }
                finally
                {
                    session.close();
                }
            });
        }

        sendMessage(message:Message)
        {
            this.proxy.invoke('notify', message);
        }

        start(callback?:(channel) => any)
        {
            super.start();

            this.hub.start().done(function ()
            {
                if (callback)
                {
                    callback(this);
                }
            });
        }

        close()
        {
            super.close();
            this.hub.stop();
        }
    }
}