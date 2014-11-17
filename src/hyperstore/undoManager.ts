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

    interface IUndoDomainInfo
    {
        dispatcher: IEventDispatcher;
        filter;
    }

    export class UndoManager
    {
        private _infos;
        public Enabled:boolean;
        private _undos;
        private _redos;

        constructor(private store:Store)
        {
            this._infos = {};
            this._undos = [];
            this._redos = [];
        }

        get canUndo()
        {
            return this._undos.length > 0;
        }

        get canRedo()
        {
            return this._redos.length > 0;
        }

        get savePoint():number
        {
            if (this._undos.length === 0)
            {
                return undefined;
            }
            return this._undos[this._undos.length - 1].sessionId;
        }

        clear()
        {
            this._undos = [];
            this._redos = [];
        }

        undo(toSavePoint?:number)
        {
            if (this.canUndo)
            {
                this.performPop(this._undos, this._redos, SessionMode.Undo, toSavePoint);
            }
        }

        redo(toSavePoint?:number)
        {
            if (this.canRedo)
            {
                this.performPop(this._redos, this._undos, SessionMode.Redo, toSavePoint);
            }
        }

        registerDomain(domain:DomainModel, dispatcher?:IEventDispatcher)
        {
            this._infos[domain.name] = {
                dispatcher: dispatcher || this.store.eventBus.defaultEventDispatcher,
                filter:     undefined
            };
            this.Enabled = true;
            var self = this;
            domain.events.on(EventManager.SessionCompleted, function (s:SessionInfo)
            {
                if (!s.aborted && self.Enabled && (s.mode & (SessionMode.UndoOrRedo | SessionMode.Loading)) === 0)
                {
                    self.push.call(self, s);
                }
            });
        }

        private performPop(mainStack, altStack, mode:SessionMode, toSavePoint?:number)
        {
            var events = [];
            var session = this.store.beginSession({mode: mode});
            var sid;

            try
            {
                var ln = mainStack.length - 1;
                for (var i = ln; i >= 0; i--)
                {
                    var info = mainStack[i];
                    if (toSavePoint && info.sessionId === toSavePoint)
                    {
                        break;
                    }

                    mainStack.pop();

                    for (var j = info.events.length - 1; j >= 0; j--)
                    {
                        var evt = info.events[j];
                        if (!evt.getReverseEvent)
                        {
                            continue;
                        }

                        var reverse = evt.getReverseEvent(session.sessionId);
                        if (!reverse)
                        {
                            continue;
                        }

                        this._infos[reverse.domain].dispatcher.handleEvent(reverse);
                        if (reverse.getReverseEvent)
                        {
                            events.push(reverse);
                        }
                    }

                    sid = info.sessionId;
                    if (!toSavePoint)
                    {
                        break;
                    }
                }

                session.acceptChanges();

                if (events.length > 0)
                {
                    altStack.push({sessionId: sid, events: events});
                }
            }
            finally
            {
                session.close();
            }
        }

        private push(session:SessionInfo)
        {
            var events = Utils.where(session.events, e =>
            {
                var infos = this._infos[e.domain];
                if (!infos)
                {
                    return false;
                }
                return infos.filter
                    ? infos.filter(e)
                    : true;
            });

            if (events.length === 0)
            {
                return;
            }

            this._redos = [];

            for (var i = this._undos.length - 1; i >= 0; i--)
            {
                var undo = this._undos[i];
                if (undo.sessionId === session.sessionId)
                {
                    undo.events = undo.events.concat(events);
                    return;
                }
            }

            this._undos.push({sessionId: session.sessionId, events: events});
        }
    }

}