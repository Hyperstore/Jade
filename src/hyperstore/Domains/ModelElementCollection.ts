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
 * encapsulates collection (many references)
 */
class ModelElementArray
{
    all:ModelElement[];
    private _sessionCompletedCookie;

    public reset()
    {
        this.all = [];

        var opposite = !!this._collection.source;
        var cursor = this._collection.getDomain().getRelationships(this._collection.schemaRelationship,
                                                               this._collection.source,
                                                               this._collection.end);
        while(cursor.hasNext())
        {
            var rel = cursor.next();
            var elem = opposite ? rel.getEnd() : rel.getStart();
            if (!this._collection.filter || this._collection.filter(elem))
            {
                this.add(elem);
            }
        }
    }

    constructor(private _collection:ModelElementCollection)
    {
        var self = this;
        this._sessionCompletedCookie = this._collection.getDomain().store.onSessionCompleted(
            function (s)
            {
                if (s.aborted)
                {
                    return;
                }

                var domain = self._collection.getDomain();
                var srcId = self._collection.source && self._collection.source.getInfo().id;
                var endId = self._collection.end && self._collection.end.getInfo().id;

                Utils.forEach(
                    s.events, function (e)
                    {
                        if( domain.name !== e.domain)
                            return;

                        if (e.eventName !== EventManager.AddRelationshipEvent &&
                            e.eventName !== EventManager.RemoveRelationshipEvent)
                        {
                            return;
                        }

                        if (e.schemaId === self._collection.schemaRelationship.id &&
                            ( e.startId === srcId) || (e.endId === endId))
                        {
                            if (e.eventName === EventManager.AddRelationshipEvent)
                            {
                                var rel = <ModelRelationship>domain.store.get(e.id);
                                if( !rel)
                                    return;

                                var mel = self._collection.source ? rel.getEnd() : rel.getStart();
                                if (!self._collection.filter || self._collection.filter(mel))
                                {
                                    self.add(mel);
                                }
                            }
                            else
                            {
                                var id = self._collection.source ? e.endId : e.startId;
                                self.remove(id);
                            }
                        }
                    }
                );
            }
        );

        this.reset();
    }

    /**
     *
     */
    dispose()
    {
        this._collection.getDomain().store.removeSessionCompleted(this._sessionCompletedCookie);
        this.all = null;
    }

    remove(id:string)
    {
        // Remove
        for (var k = 0; k < this.all.length; k++)
        {
            if (this.all[k].getId() === id)
            {
                this.all.splice(k,1);
                break;
            }
        }
    }

    add(mel:ModelElement)
    {
        this.all.push(mel);
    }
}

    export class ModelElementCollection extends Cursor
    {
        source:ModelElement;
        end:ModelElement
        schemaRelationship:SchemaRelationship;
        filter;
        cursor;
        private _lastCursorDomain;
        private _items : ModelElementArray;
        private _filter:(mel:ModelElement) => boolean;

        getDomain() {
            return this.source && this.source.getDomain() || this.end.getDomain();
        }

        public setFilter(where:(mel:ModelElement) => boolean)
        {
            this._filter = where;
        }

        /**
         * get all items as an array (for angular)
         * Changes will be take into account at the end of the session
         * @returns {ModelElement[]}
         */
        get items() {
            if(!this._items) {
                this._items = new ModelElementArray(this);
            }
            return this._items.all;
        }

        constructor(source:ModelElement, schemaRelationship:SchemaRelationship, opposite:boolean = false, filter?:(mel:ModelElement) => boolean)
        {
            super();
            if (schemaRelationship.cardinality === Cardinality.OneToOne)
            {
                throw "Invalid cardinality. Use reference instead.";
            }

            var src = source.getInfo();
            if (!opposite && !src.schemaElement.isA(schemaRelationship.startSchemaId))
            {
                throw "Invalid source type";
            }
            if (opposite && !src.schemaElement.isA(schemaRelationship.endSchemaId))
            {
                throw "Invalid end type";
            }

            this.source = opposite ? undefined : source;
            this.end = opposite ? source : undefined;
            this.schemaRelationship = schemaRelationship;
            this.setFilter(filter);
        }

        hasNext() {
            while(true)
            {
                if (!this.cursor.hasNext())
                    return false;
                var rel = this.cursor.next();
                if (rel && rel.getEnd())
                    return true;
            }
        }

        reset() {
            var domain = this.getDomain();
            if( !this.cursor || this._lastCursorDomain !== domain) {
                this.cursor = Cursor.from(domain.getRelationships(this.schemaRelationship, this.source, this.end));
                if (this._filter)
                    this.cursor = this.cursor.map(this._filter);
                if (this._items)
                    this._items.reset();
                this._lastCursorDomain = domain;
            }
            this.cursor.reset();
        }

        next() {
            return this.cursor.next().getEnd();
        }

        dispose()
        {
            if(this._items)
                this._items.dispose();
        }

        remove(mel:ModelElement)
        {
            if ((this.source || this.end).isDisposed)
            {
                throw "Can not use a disposed element";
            }

            if (mel == null)
            {
                return;
            }

            var source = this.source ? this.source : mel;
            var end = this.end ? this.end : mel;

            var domain = this.getDomain();
            var cursor = domain.getRelationships(this.schemaRelationship, source, end);
            if (cursor.hasNext())
            {
                var rel = cursor.next();
                domain.remove(rel.getId());
            }
        }

        add(mel:ModelElement)
        {
            if ((this.source || this.end).isDisposed)
            {
                throw "Can not use a disposed element";
            }

            if (mel == null)
            {
                return;
            }

            var source = this.source ? this.source : mel;
            var end = (this.end ? this.end : mel).getInfo();

            this.getDomain().createRelationship(this.schemaRelationship, source, end.id, end.schemaElement.id);
        }
    }
}