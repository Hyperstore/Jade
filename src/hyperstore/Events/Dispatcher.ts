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
     * Interface for event handler.
     *
     * Event handler are used when an event is received by the [[EventBus]]. Handlers for built-in events are registered
     * by the [[EventBus]].
     *
     * If you create a custom event, you must provide its event handler and register it in the [[EventDispatcher]] get
     *  from [[EventBus.defaultEventDispatcher]].
     *
     */
    export interface IEventHandler
    {
        eventName: string;
        execute(domain:Domain, event);
    }
}