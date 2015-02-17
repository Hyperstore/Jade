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

/// <reference path="../../.built/dist/hyperstore.d.ts"/>
/// <reference path="../../Scripts/typings/signalr/signalr.d.ts" />
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
    export class SignalRChannel extends Hyperstore.AbstractChannel
    {
        private proxy:HubProxy;

        /**
         * create a new SignalRChannel instance.
         * @param hub - signalr hub if you want override default connection configuration.
         */
        constructor(public hub?) {
            super();
            this.hub = hub || $.hubConnection();
            //this.hub.logging = true;
        }

        associate(domain:Hyperstore.DomainModel) {
            super.associate(domain);
            var self = this;
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
                        env.events.forEach(
                            function (e)
                            {
                                var evt = Hyperstore.EventManager.createEvent(e.eventName);
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
                            }
                        );

                        session.acceptChanges();
                    }
                    finally
                    {
                        session.close();
                    }
                }
            );
        }

        /**
         * send message over the channel
         * @private
         * @param message
         */
        sendMessage(message:Hyperstore.Message)
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

            this.hub.start().done(
                function ()
                {
                    if (callback)
                    {
                        callback(this);
                    }
                }
            );
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