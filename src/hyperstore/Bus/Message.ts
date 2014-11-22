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
}
