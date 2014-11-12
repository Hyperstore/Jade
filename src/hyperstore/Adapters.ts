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
/// <reference path="../../scripts/typings/jquery/jquery.d.ts" />

module Hyperstore
{
    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class Adapter
    {
        private _cookie;
        public domain:DomainModel;

        constructor(public reset:boolean = false)
        {
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        initAsync(domain:DomainModel):JQueryPromise<any>
        {
            if (!$.Deferred)
            {
                throw "Adapter needs JQuery.";
            }

            var defer = $.Deferred();

            this.domain = domain;
            this._cookie = domain.store.subscribeSessionCompleted((s:Session) =>
            {
                var storeId = this.domain.store.storeId;
                var originId = s.originStoreId;
                if (s.aborted || !s.events || (originId != undefined && originId !== storeId) || (s.mode & SessionMode.Loading) === SessionMode.Loading)
                {
                    return;
                }

                var elements = new Queryable<ITrackedElement>(Utils.select(s.trackingData.involvedTrackedElements, (e:ITrackedElement) => (e.domain === this.domain.name /*&& e.extension == this.domain.extension*/)
                    ? e
                    : undefined));
                if (!elements.any())
                {
                    return;
                }

                this.persistElements(s, elements);
            });

            defer.resolve(this);
            return defer.promise();
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        dispose()
        {
            this.domain.store.unsubscribeSessionCompleted(this._cookie);
        }

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        persistElements(s:Session, elements:Queryable<ITrackedElement>)
        {
        }

        loadElementsAsync(filter?:(id, schemaId) => boolean):JQueryPromise<SessionResult>
        {
            return undefined;
        }
    }
}