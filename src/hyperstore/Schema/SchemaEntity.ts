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
    export class SchemaEntity extends SchemaElement
    {
        // -------------------------------------------------------------------------------------
        //
        // -------------------------------------------------------------------------------------
        constructor(schema:Schema, id:string, public baseElement?:SchemaElement)
        {
            super(schema, SchemaKind.Entity, id, baseElement);
            schema.__addSchemaElement(this);
        }

        /**
         *
         * @param domain
         * @param id
         * @param version
         * @returns {ModelElement}
         */
        create(domain:DomainModel, id?:string, version?:number) : ModelElement {
            if(!domain) throw "domain is required.";
            return domain.createEntity(this, id, version);
        }
    }
}