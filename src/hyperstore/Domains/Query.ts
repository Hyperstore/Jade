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

module Hyperstore {

    interface IIterator {
        moveNext() : boolean;
        current() : ModelElement;
    }

    class Iterator implements IIterator {
        private _list: any[];
        private _cx:number;

        constructor(obj)
        {
            this.setStart(obj);
        }

        setStart(obj) {
            if( obj.length)
                this._list = obj;
            else
                this._list = [obj];
            this._cx = -1;
        }

        moveNext() : boolean {
            this._cx++;
            return this._cx < this._list.length;
        }

        current() {
            return this._list[this._cx];
        }
    }

    export class Query  {

        private _iterator:IIterator;
        private _current: ModelElement;
        private _cx:number;
        private _subQueries : Query[];
        private _state:number=0;
        private _iter:number;

        constructor(store:Store, private _config:any, private _schema:SchemaElement) {
            this._subQueries = [];
            this._cx =  0;
            if( typeof(this._schema) == "string")
                this._schema = store.getSchemaElement(<any>this._schema);

            for(var field in this._config)
            {
                if (!this._config.hasOwnProperty(field) || field[0] === '$')
                    continue;
                var ref = this._schema.getReference(field, true);
                if( ref )
                {
                    var schema = store.getSchemaElement( ref.schemaRelationship.endSchemaId);
                    this._subQueries.push( new BranchIterator(this._config[field], schema, field));
                }
            }
        }

        setStart(obj) {
            this._iterator = new Iterator(obj);
        }

        moveNext() : boolean {
            while(true)
            {
                switch (this._state)
                {
                    case 0:
                        if(!this._iterator.moveNext())
                        {
                            this._state = 4;
                            break;
                        }
                        var elem = this._iterator.current();
                        if( !elem || !this.filter(elem, this._config))
                            break;
                        this._cx++;
                        if( this._config.$skip && this._cx <= this._config.$skip) break;
                        if( this._config.$take && this._cx > this._config.$take)  break;
                        if( this._subQueries.length) {
                            this._iter = -1;
                            this._subQueries.forEach(q=>q.setStart(elem));
                            this._state = 2;
                        }
                        if(!this._subQueries.length || this._config.$select)
                        {
                            this._current = elem;
                            return true;
                        }
                        break;
                    case 2:
                        this._iter++;
                        if( this._iter === this._subQueries.length)
                        {
                            this._state = 0;
                            break;
                        }
                        else {
                            this._state = 3;
                        }
                    case 3:
                        if( !this._subQueries[this._iter].moveNext())
                        {
                            this._state=2;
                        }
                        else {
                            this._current = this._subQueries[this._iter].current();
                            return true;
                        }
                        break;
                    case 4:
                        return false;
                }
            }
        }

        private filter(elem:ModelElement, config, flag:boolean=false) {

            for(var field in config) {
                if( !config.hasOwnProperty(field))
                    continue;

                var val;
                var data = config[field];
                switch(field) {
                    case "$schema":
                        val = elem.schemaElement.id;
                        break;
                    case "$filter":
                        if( data(elem) === flag)
                            return flag;
                        break;
                    case "$or":
                        if( this.filter(elem, data, true) === flag)
                            return flag;
                        break;
                    case "id":
                        val = elem.id;
                        break;
                    default:
                        if(field[0] == '$')
                            continue;
                        var prop = elem.schemaElement.getProperty(field, true);
                        if( !prop )
                            continue;
                        val = elem.getPropertyValue(field);
                }

                var r = !flag;
                if( data instanceof RegExp)
                {
                    r = data.test(val);
                }
                else if( typeof(data) === "object") {
                    r = this.evalExpression(val, data);
                }
                else
                {
                    r = val === data;
                }

                if( r === flag)
                    return flag;

            }

            return !flag;
        }

        private evalExpression(val, expr) : boolean { // TODO
            for(var m in expr) {
                var lit = expr[m];
                switch(m) {
                    case "=":
                        break;
                }
            }
            return true;
        }

        current() : any {
            return this._current;
        }
    }


    class BranchIterator extends Query {

        constructor( config:any, schema:SchemaElement, private _name:string) {
            super(schema.schema.store,  config, schema);
        }

        setStart(obj) {
            super.setStart(obj[this._name]);
        }
    }
}