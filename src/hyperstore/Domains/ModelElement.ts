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
 * Domain element
 */
export class ModelElement
{
    id:string;
    schemaElement:SchemaElement;
    domain:DomainModel;
    startId:string;
    startSchemaId:string;
    endId:string;
    endSchemaId:string;
    private _start:ModelElement;
    private _end:ModelElement;
    public disposed:boolean;

    /**
     *
     */
    dispose()
    {
        this.disposed = true;
        for (var p in this)
        {
            if (this.hasOwnProperty(p) && p.substr(0, 5) === "__ref")
            {
                var prop = this[p];
                if (prop && prop.dispose)
                {
                    prop.dispose();
                }
            }
        }
    }

    /**
     *
     * @param property
     * @returns {*}
     */
    getPropertyValue(property:SchemaProperty):any
    {
        if (this.disposed)
        {
            throw "Can not use a disposed element";
        }
        if(typeof(property) === "string")
            property = this.schemaElement.getProperty(<any>property, true);
        if( !property)
            return undefined;
        var pv = this.domain.getPropertyValue(this.id, property);
        if (!pv)
        {
            return undefined;
        }
        return pv.value;
    }

    /**
     *
     * @param property
     * @param value
     * @returns {PropertyValue}
     */
    setPropertyValue(property:SchemaProperty, value:any)
    {
        if (this.disposed)
        {
            throw "Can not use a disposed element";
        }
        if(typeof(property) === "string")
            property = this.schemaElement.getProperty(<any>property, true);

        return this.domain.setPropertyValue(this.id, property, value);
    }

    /**
     *
     * @param domain
     * @param id
     * @param schemaElement
     * @param startId
     * @param startSchemaId
     * @param endId
     * @param endSchemaId
     * @private
     */
    __initialize(domain:DomainModel, id:string, schemaElement:SchemaElement, startId?:string, startSchemaId?:string, endId?:string, endSchemaId?:string)
    {
        this.disposed = false;
        this.domain = domain;
        this.schemaElement = schemaElement;
        this.id = id;
        this.startId = startId;
        this.startSchemaId = startSchemaId;
        this.endId = endId;
        this.endSchemaId = endSchemaId;
    }

    /**
     *
     * @returns {ModelElement}
     */
    get start():ModelElement
    {
        if (this.disposed)
        {
            throw "Can not use a disposed element";
        }

        if (!this._start)
        {
            this._start = this.domain.get(this.startId);
        }
        return this._start;
    }

    /**
     *
     * @returns {ModelElement}
     */
    get end():ModelElement
    {
        if (this.disposed)
        {
            throw "Can not use a disposed element";
        }

        if (!this._end)
        {
            this._end = this.domain.store.get(this.endId);
        }
        return this._end;
    }

    /**
     *
     * @returns {string}
     */
    stringify():string
    {
        if (this.disposed)
        {
            throw "Can not use a disposed element";
        }

        var seen = [];

        var json = JSON.stringify(
            this, function (k, v)
            {
                if (k.length === 0 || !isNaN(parseInt(k)) || !v)
                {
                    return v;
                }

                switch (k)
                {
                    case "id":
                        if (seen.indexOf(v) !== -1)
                        {
                            return undefined;
                        }
                        seen.push(v);
                        return v;
                    case "startId":
                    case "startSchemaId":
                    case "endId":
                    case "endSchemaId":
                    case "$id":
                        return v;
                    case "schemaElement":
                        return v.id;
                    case "domain":
                    case "start":
                    case "end":
                    case "_start":
                    case "_end":
                        return undefined;
                }

                var p = this.schemaElement.getProperty(k, true);
                if (!p)
                {
                    var r = this.schemaElement.getReference(k, true);

                    if (r && (
                        !r.opposite && r.schemaRelationship.startProperty ||
                        r.opposite && r.schemaRelationship.endProperty ))
                    {
                        if (r.schemaRelationship.cardinality === Cardinality.ManyToMany ||
                            !r.opposite && r.schemaRelationship.cardinality === Cardinality.OneToMany
                            || r.opposite && r.schemaRelationship.cardinality === Cardinality.ManyToOne)
                        {
                            return Utils.select(
                                v.items, i => seen.indexOf(i.id) === -1
                                    ? i
                                    : {$id: i.id}
                            );
                        }

                        return seen.indexOf(v.id) === -1
                            ? v
                            : {$id: v.id};
                    }

                    return undefined;
                }
                return p.kind === PropertyKind.Calculated ? undefined : p.serialize(v);
            }
        );

        return json;
    }

    /**
     *
     * @param schemaElement
     * @param direction
     * @returns {ModelElement[]}
     */
    getRelationships(schemaElement?:SchemaRelationship, direction:Direction = Direction.Outgoing):ModelElement[]
    {
        var list;
        if ((
            direction & Direction.Outgoing) !== 0)
        {
            list = this.domain.findRelationships(schemaElement, this);
        }
        if ((
            direction & Direction.Incoming) !== 0)
        {
            var list2 = this.domain.findRelationships(schemaElement, undefined, this);
            if (list && list.any())
            {
                list = list.concat(list2);
            }
        }
        return list;
    }
}
}