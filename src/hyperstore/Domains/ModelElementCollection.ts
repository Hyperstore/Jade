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
class ElementArray
{
    all:Element[];
    private _sessionCompletedCookie;

    public reset()
    {
        this.all = [];

        var opposite = !!this._collection.source;
        var cursor = this._collection.domain.getRelationships(this._collection.schemaRelationship,
                                                               this._collection.source,
                                                               this._collection.end);
        while(cursor.hasNext())
        {
            var rel = cursor.next();
            var elem = opposite ? rel.getEnd() : rel.getStart();
            if (!this._collection.whereClause || this._collection.whereClause(elem))
            {
                this.add(elem);
            }
        }
    }

    constructor(private _collection:ElementCollection)
    {
        var self = this;
        this._sessionCompletedCookie = this._collection.domain.events.on(
            EventManager.SessionCompleted, function (s)
            {
                if (s.aborted)
                {
                    return;
                }

                var domain = self._collection.domain;
                var srcId = self._collection.source && self._collection.source.getInfo().id;
                var endId = self._collection.end && self._collection.end.getInfo().id;

                Utils.forEach(s.events, function (e)
                    {
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
                                var rel = <Relationship>domain.store.get(e.id);
                                if( !rel)
                                    return;

                                var mel = self._collection.source ? rel.getEnd() : rel.getStart();
                                if (!self._collection.whereClause || self._collection.whereClause(mel))
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
        this._collection.domain.events.remove(this._sessionCompletedCookie);
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

    add(mel:Element)
    {
        this.all.push(mel);
    }
}

    export class ElementCollection extends Cursor
    {
        source:Element;
        end:Element;
        schemaRelationship:SchemaRelationship;
        cursor;
        private _items : ElementArray;
        domain : Domain;
        public whereClause:(mel:Element) => boolean;

        public setFilter(whereClause:(mel:Element) => boolean)
        {
            this.whereClause = whereClause;
            if( this._items)
                this._items.reset();
        }

        /**
         * get all items as an array (for angular)
         * Changes will be take into account at the end of the session
         * @returns {Element[]}
         */
        get items() {
            if(!this._items) {
                this._items = new ElementArray(this);
            }
            return this._items.all;
        }

        constructor(source:Element, schemaRelationship:SchemaRelationship, opposite:boolean = false, filter?:(mel:Element) => boolean)
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
            this.domain = source.getDomain();
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
            this.cursor = Cursor.from(this.domain.getRelationships(this.schemaRelationship, this.source, this.end));
            if(this.whereClause)
                this.cursor = this.cursor.map(this.whereClause);
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

        remove(mel:Element)
        {
            if (mel == null)
            {
                return;
            }

            if( !mel.getInfo || mel.isDisposed) {
                var property = this.source ? this.schemaRelationship.startProperty : this.schemaRelationship.endProperty;
                throw "Invalid collection element '" + mel + "'. Must be a valid domain element for property " + property;
            }

            if ((this.source || this.end).isDisposed)
            {
                throw "Can not use a disposed element";
            }

            var source = this.source ? this.source : mel;
            var end = this.end ? this.end : mel;

            var cursor = this.domain.getRelationships(this.schemaRelationship, source, end);
            if (cursor.hasNext())
            {
                var rel = cursor.next();
                this.domain.remove(rel.getId());
            }
        }

        add(mel:Element)
        {
            if (mel == null)
            {
                return;
            }

            if( !mel.getInfo || mel.isDisposed) {
                var property = this.source ? this.schemaRelationship.startProperty : this.schemaRelationship.endProperty;
                throw "Invalid collection element '" + mel + "'. Must be a valid domain element for property " + property;
            }

            if ((this.source || this.end).isDisposed)
            {
                throw "Can not use a disposed element";
            }

            var source = this.source ? this.source : mel;
            var end = (this.end ? this.end : mel).getInfo();

            this.domain.createRelationship(this.schemaRelationship, source, end.id, end.schemaElement.id);
        }
    }
}