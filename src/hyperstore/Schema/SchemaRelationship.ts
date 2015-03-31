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
    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    export class SchemaRelationship extends SchemaElement
    {
        private _startProperty:string;
        private _endProperty:string;

        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(schema:Schema, id:string, public startSchemaId:string, public endSchemaId:string, public embedded:boolean, public cardinality:Cardinality, startProperty?:string, endProperty?:string, public baseElement?:SchemaElement)
        {
            super(schema, SchemaKind.Relationship, id, baseElement);
            schema.__addSchemaElement(this);
            this.startProperty = startProperty;
            this.endProperty = endProperty;
        }

        set startProperty(name:string)
        {
            if (name)
            {
                this._startProperty = name;
                var source = <SchemaElement>this.schema.store.getSchemaElement(this.startSchemaId);
                source.__defineReferenceProperty(this, false);
            }
        }

        get startProperty()
        {
            return this._startProperty;
        }

        set endProperty(name:string)
        {
            if (name)
            {
                this._endProperty = name;
                var source = <SchemaElement>this.schema.store.getSchemaElement(this.endSchemaId);
                source.__defineReferenceProperty(this, true);
            }
        }

        get endProperty()
        {
            return this._endProperty;
        }

        /**
         *
          * @param domain
         * @param start
         * @param endId
         * @param endSchemaId
         * @param id
         * @param version
         * @returns {Element}
         */
        create(domain:Domain, start:Element, endId:string, endSchemaId:string, id?:string, version?:number) : Relationship {
            if(!domain) throw "domain is required.";
            return domain.createRelationship(this, start, endId, endSchemaId, id, version);
        }
    }
}