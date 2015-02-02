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
export class SchemaInfo
{
    public name:string;

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    constructor(public schema:Schema, public kind:SchemaKind, public id:string)
    {
        this.name = id.indexOf('.') <= 0 || (schema.name && id.substr(0, schema.name.length) !== schema.name)
                    ? id
                    : id.substr(schema.name.length + 1);

        this.id = schema.name ? schema.name + "." + this.name : id;
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    deserialize(ctx:SerializationContext):any
    {
        return ctx.value;
    }

    // -------------------------------------------------------------------------------------
    //
    // -------------------------------------------------------------------------------------
    serialize(value:any):any
    {
        return value;
    }
}
}