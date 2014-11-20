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
    /**
     * Share message sending over the event bus with all session events.
     * There is one message by session
     */
    export interface Message
    {
        /**
         * store id initiating the change - UUID
         */
        origin: string;
        /**
         * session id - local sequential id
         */
        sessionId: number;
        /**
         * initial session mode
         */
        sessionMode: SessionMode;
        /**
         * session events
         */
        events: AbstractEvent[];
    }

    /**
     * abstract channel.
     *
     * A channel is always associated with a domain and only send or receive events
     * involving this domain.
     */
    export class AbstractChannel
    {
        public eventBus:EventBus;

        /**
         * Event dispatcher. See [[IEventHandler]].
         *
         * Initialized from [[EventBus.defaultEventDispatcher]]
         */
        public dispatcher:IEventDispatcher;

        constructor(public domain:DomainModel)
        {
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

    /**
     * SignalR channel - By default, connection is open on the context server.
     * the server hub must be named 'hyperstore' with the following interface :
     *
     * ~~~
     *  public void Send(Message msg)
     * {
     *     Clients.All.onEvents(msg);
     * }
     *
     * public void notify(Message msg)
     * {
     *    Clients.Others.onEvents(msg);
     * }
     * ~~~
     */
    export class SignalRChannel extends AbstractChannel
    {
        private proxy:HubProxy;

        /**
         * create a new SignalRChannel instance.
         * @param domain - associated domain. See [[AbstractChannel]]
         * @param hub - signalr hub if you want override default connection configuration.
         */
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
                    env.events.forEach(function (e)
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

        /**
         * send message over the channel
         * @private
         * @param message
         */
        sendMessage(message:Message)
        {
            this.proxy.invoke('notify', message);
        }

        /**
         * open the signalr connection
         *
         * Do not call directly - used [[EventBus.start]]
         *
         * @param callback - callback called when the channel is open
         */
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

        /**
         * Do not call directly.
         *
         * close when [[EventBus]] is closed
         */
        close()
        {
            super.close();
            this.hub.stop();
        }
    }
}