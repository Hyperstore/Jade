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
export class ModelElementCollection
{
    private _source:ModelElement;
    private _end:ModelElement;
    private _schemaRelationship:SchemaRelationship;
    private _domain:DomainModel;
    private _filter:(mel:ModelElement) => boolean;
    private _count:number;
    private _sessionCompletedCookie;

    public setFilter(where:(mel:ModelElement) => boolean)
    {
        this._filter = where;
        this.clear();
        this.loadItems();
    }

    private clear()
    {
        this._count = 0;
        var self = <any>this;
        while (self.length > 0)
        {
            self.pop();
        }
    }

    /**
     * create a collection where the source element is a terminal of a relationships depending of the opposite value
     * if opposite is false source is the start element otherwise the end element.
     * @param source
     * @param schemaRelationship
     * @param opposite
     * @param filter
     */
    constructor(source:ModelElement, schemaRelationship:SchemaRelationship, opposite:boolean = false, filter?:(mel:ModelElement) => boolean)
    {
        if (schemaRelationship.cardinality === Cardinality.OneToOne)
        {
            throw "Invalid cardinality. Use reference instead.";
        }

        if (!opposite && !source.schemaElement.isA(schemaRelationship.startSchemaId))
        {
            throw "Invalid source type";
        }
        if (opposite && !source.schemaElement.isA(schemaRelationship.endSchemaId))
        {
            throw "Invalid end type";
        }

        this._source = opposite ? undefined : source;
        this._end = opposite ? source : undefined;
        this._schemaRelationship = schemaRelationship;
        this._domain = source.domain;

        this._filter = filter;
        var self = this;

        this._sessionCompletedCookie = this._domain.events.on(
            EventManager.SessionCompleted, function (s)
            {
                if (s.aborted)
                {
                    return;
                }

                Utils.forEach(
                    s.events, function (e)
                    {
                        if (e.eventName !== EventManager.AddRelationshipEvent &&
                            e.eventName !== EventManager.RemoveRelationshipEvent)
                        {
                            return;
                        }

                        if (e.schemaId === self._schemaRelationship.id && (
                            self._source && e.startId === self._source.id)
                            || (
                            self._end && e.endId === self._end.id))
                        {
                            if (e.eventName === EventManager.AddRelationshipEvent)
                            {
                                var rel = self._domain.store.getElement(e.id);
                                var mel = self._source ? rel.end : rel.start;

                                if (!self._filter || self._filter(mel))
                                {
                                    Array.prototype.push.call(self, mel);
                                    self._count++;
                                }
                            }
                            else
                            {
                                var id = self._source ? e.endId : e.startId;

                                // Remove
                                for (var k = 0; k < self._count; k++)
                                {
                                    if (self[k].id === id)
                                    {
                                        if (Array.prototype.splice.call(self, k, 1).length === 1)
                                        {
                                            self._count--;
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                );
            }
        );

        for (var p in this)
        {
            if (this.hasOwnProperty(p))
            {
                var desc = Object.getOwnPropertyDescriptor(this, p);
                desc.configurable = false;
                Object.defineProperty(this, p, desc);
            }
        }

        this._count = 0;
        this.loadItems();
    }

    /**
     *
     * @returns {number}
     */
    get count():number
    {
        return this._count;
    }

    private loadItems()
    {
        var opposite = !!this._source;
        var cursor = this._domain.getRelationships(this._schemaRelationship, this._source, this._end);
        while(cursor.hasNext())
        {
            var rel = cursor.next();
            var elem = opposite ? rel.end : rel.start;
            if (!this._filter || this._filter(elem))
            {
                Array.prototype.push.call(this, elem);
                this._count++;
            }
        }
    }

    /**
     *
     */
    dispose()
    {
        this._domain.events.remove(this._sessionCompletedCookie);
        this.clear();
    }

    /**
     *
     * @param mel
     */
    remove(mel:ModelElement)
    {
        if ((
            this._source || this._end).disposed)
        {
            throw "Can not use a disposed element";
        }

        if (mel == null)
        {
            return;
        }

        var source = this._source ? this._source : mel;
        var end = this._end ? this._end : mel;

        var rel = (<any>this._domain.getRelationships(this._schemaRelationship, source, end)).firstOrDefault();
        if (rel)
        {
            this._domain.removeElement(rel.id);
        }
    }

    /**
     *
     * @param mel
     */
    add(mel:ModelElement)
    {
        if ((
            this._source || this._end).disposed)
        {
            throw "Can not use a disposed element";
        }

        if (mel == null)
        {
            return;
        }

        var source = this._source ? this._source : mel;
        var end = this._end ? this._end : mel;

        var rel = this._source.domain.createRelationship(
            this._schemaRelationship, source, end.id, end.schemaElement.id
        );
    }
}
    /*
    export class ModelElementsCursor extends Cursor
    {
        private _source:ModelElement;
        private _end:ModelElement;
        private _schemaRelationship:SchemaRelationship;
        private _domain:DomainModel;
        private _filter;
        private _cursor;

        public setFilter(where:(mel:ModelElement) => boolean)
        {
            this._cursor = Cursor.from(this._domain.getRelationships(this._schemaRelationship, this._source, this._end));
            if(where)
                this._cursor = this._cursor.map(where);
        }

        constructor(source:ModelElement, schemaRelationship:SchemaRelationship, opposite:boolean = false, filter?:(mel:ModelElement) => boolean)
        {
            if (schemaRelationship.cardinality === Cardinality.OneToOne)
            {
                throw "Invalid cardinality. Use reference instead.";
            }

            if (!opposite && !source.schemaElement.isA(schemaRelationship.startSchemaId))
            {
                throw "Invalid source type";
            }
            if (opposite && !source.schemaElement.isA(schemaRelationship.endSchemaId))
            {
                throw "Invalid end type";
            }

            this._source = opposite ? undefined : source;
            this._end = opposite ? source : undefined;
            this._schemaRelationship = schemaRelationship;
            this._domain = source.domain;
            this.setFilter(filter);
        }

        hasNext() {
            return this._cursor.hasNext();
        }

        reset() {
            this._cursor.reset();
        }

        next() {
            return this._cursor.next();
        }

        dispose()
        {
        }

        remove(mel:ModelElement)
        {
            if ((
                this._source || this._end).disposed)
            {
                throw "Can not use a disposed element";
            }

            if (mel == null)
            {
                return;
            }

            var source = this._source ? this._source : mel;
            var end = this._end ? this._end : mel;

            var cursor = this._domain.getRelationships(this._schemaRelationship, source, end);
            if (cursor.hasNext())
            {
                var rel = cursor.next();
                this._domain.removeElement(rel.id);
            }
        }

        add(mel:ModelElement)
        {
            if ((
                this._source || this._end).disposed)
            {
                throw "Can not use a disposed element";
            }

            if (mel == null)
            {
                return;
            }

            var source = this._source ? this._source : mel;
            var end = this._end ? this._end : mel;

            var rel = this._source.domain.createRelationship(
                this._schemaRelationship, source, end.id, end.schemaElement.id
            );
        }
    }*/
}