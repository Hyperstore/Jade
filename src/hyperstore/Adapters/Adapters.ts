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
/// <reference path="../../../Scripts/typings/Q/Q.d.ts" />
module Hyperstore
{
// localForage
//pouchdb

    /**
     * Abstract adapter do not use directly.
     * An adapter is used to persist model element. It must be enable by domain with the [[Domain.addAdapter]] method.
     * Loading elements with an adapter must be made manually by calling the [[Adapter.loadElementsAsync]].
     * Elements are persisted when a session is completed, with no errors or warnings.
     */
    export class Adapter
    {
        private _cookie;
        /**
         * The associated domain model
         */
        public domain:Domain;

        /**
         * @private - abstract constructor
         * @param reset
         */
        constructor(public reset:boolean = false)
        {
        }

        /**
         * must be called by the concrete class.
         * Subscribe to the [[Store.onSessionCompleted]]
         * @param domain - domain to persist
         */
        init(domain:Domain)
        {
            this.domain = domain;
            this._cookie = domain.store.onSessionCompleted(
                (s:Session) =>
                {
                    var storeId = this.domain.store.storeId;
                    var originId = s.originStoreId;
                    if (s.aborted || s.result.hasErrorsOrWarnings || !s.events || (
                        originId && originId !== storeId) || (
                        s.mode & SessionMode.Loading) === SessionMode.Loading)
                    {
                        return;
                    }

                    var elements = Utils.filter(
                                     s.trackingData.involvedTrackedElements,
                                     (e:ITrackedElement) => e.domain === this.domain.name /*&& e.extension == this.domain.extension*/
                                    );

                    if (elements.length === 0)
                    {
                        return;
                    }

                    this.persistElements(s, elements);
                }
            );
        }

        /**
         * dispose the adapter. In this method, you can close properly external resources.
         * This method is always called when a domain is unloaded or when the store is closed.
         * You must always call this method if you override it.
         */
        dispose()
        {
            this.domain.store.removeSessionCompleted(this._cookie);
        }

        /**
         * Persistence implementation. Do not call this method directly
         * @param session - current session
         * @param elements - elements to persist [[ItrackedElement]] list
         */
        persistElements(session:Session, elements:ITrackedElement[])
        {
        }

        /**
         * load elements in the domain. Must be called manually.
         * @param filter - a function callback allowing to filter element before loading it in the domain.
         * @returns a promise with no special value.
         */
        loadElementsAsync(filter?:(id, schemaId) => boolean):Q.Promise<any>
        {
            return undefined;
        }
    }
}