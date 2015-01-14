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

module Hyperstore
{
    export class HashTable<TKey,TElem> extends Cursor  {
        _values : TElem[];
        _keys;
        _ix:number;
        _deleted:number;
        private _current:TElem;

        constructor(private _throttle = 10)
        {
            super();
            this._values = [];
            this._keys = {};
            this._deleted=0;
        }

        reset() {
            this._ix = 0;
        }

        hasNext() : boolean {
            while(true)
            {
                if (this._ix >= this._values.length)
                {
                    this._current = undefined;
                    return false;
                }
                this._current = this._values[this._ix++];
                if( this._current != null)
                    return true;
            }
        }

        next() {
            return this._current;
        }

        dispose()
        {
            this._keys = null;
            this._values = null;
        }

        keyExists(key:TKey) : boolean {
            return this._keys[key] !== undefined;
        }

        add(key:TKey, elem:TElem)  {
            var n = this._keys[key];
            if( n !== undefined)
                this._values[n] = elem;
            else
                this._keys[key] = this._values.push( elem ) - 1;
        }

        get(key:TKey) {
            var n = this._keys[key];
            return n !== undefined ? this._values[n] : undefined;
        }

        remove(key:TKey)
        {
            var n = this._keys[key];
            if (n !== undefined )
            {
                this._deleted++;
                delete this._keys[key];
                if (this._deleted > this._throttle)
                    this.shrink();
                else
                    this._values[n] = null;
            }
        }

        clone() : HashTable<TKey,TElem>  {
            var clone = new HashTable<TKey,TElem>();
            clone._values = new Array(this._values.length - this._deleted);
            for(var key in this._keys) {
                var n = this._keys[key];
                clone._keys[key] = n
            }
            clone._deleted = this._deleted;
            clone._values = this._values.slice();
            clone._throttle = this._throttle;
            return clone;
        }

        private shrink() {
            var values = [];
            for(var key in this._keys) {
                var n = this._keys[key];
                var val = this._values[n];
                this._keys[key] = values.push(val) - 1;
            }
            this._values = values;
            this._deleted = 0;
        }

        get keys() : TKey[] {
            var list = new Array(this._values.length-this._deleted);
            for(var k in this._keys)
                list.push(k);

            return list;
        }

        get values() : TElem[] {
            return Utils.select(this._values, v=> v);
        }
    }

    export class Utils
    {
        private static date = new Date();
        private static sequence;

        static Requires(val, name)
        {
            if (!val)
                throw name + " is required.";
        }

        // http://stackoverflow.com/questions/7966559/how-to-convert-javascript-date-object-to-ticks
        static getUtcNow():number
        {
            // the number of .net ticks at the unix epoch
            var epochTicks = 621355968000000000;

            // there are 10000 .net ticks per millisecond
            var ticksPerMillisecond = 10000;

            // calculate the total number of .net ticks for your date
            return epochTicks + (
                Utils.date.getTime() * ticksPerMillisecond);
        }

        // Thanks to broofa & Briguy37 : http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        static newGuid():string
        {
            var d = Utils.date.getTime();
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
                /[xy]/g, function (c)
                {
                    var r = (
                        d + Math.random() * 16) % 16 | 0;
                    d = Math.floor(d / 16);
                    return (
                        c === 'x'
                            ? r
                            : (
                        r & 0x7 | 0x8)).toString(16);
                }
            );
            return uuid;
        }

        static isArray(value):boolean
        {
            var s = typeof value;
            return value && typeof (
                    value) === 'object' && value instanceof Array;
        }

        static firstOrDefault(list, fn?):any
        {
            if (!list)
            {
                return;
            }

            if (list.length)
            {
                for (var i = 0; i < list.length; i++)
                {
                    var e = list[i];
                    if (e && (
                        !fn || fn(e)))
                    {
                        return e;
                    }
                }
            }
            else
            {
                for (var k in list)
                {
                    if (list.hasOwnProperty(k))
                    {
                        var e = list[k];
                        if (e && (
                            !fn || fn(e)))
                        {
                            return e;
                        }
                    }
                }
            }
            return undefined;
        }

        static forEach(list, fn) {
            if (!list) {
                return;
            }

            if (list.length) {
                for (var i = 0; i < list.length; i++) {
                    var e = list[i];
                    if (e) {
                        fn(e);
                    }
                }
                return;
            }
            if (list.hasNext) {
                list.reset();
                while(list.hasNext()) {
                    var e = list.next();
                    if(e) fn(e);
                }
                return;
            }

            for (var k in list) {
                if (list.hasOwnProperty(k)) {
                    var e = list[k];
                    if (e) {
                        fn(e);
                    }
                }
            }
        }

        static reverse(list)
        {
            if (!list)
            {
                return undefined;
            }

            var list2 = [];
            0
            if (list.length)
            {
                for (var i = list.length - 1; i >= 0; i--)
                {
                    var e = list[i];
                    if (e)
                    {
                        list2.push(e);
                    }
                }
            }
            else
            {
                for (var k in list)
                {
                    if (list.hasOwnProperty(k))
                    {
                        var e = list[k];
                        if (e)
                        {
                            list2.unshift(e);
                        }
                    }
                }
            }
            return list2;
        }

        static where(list, fn)
        {
            var list2 = [];
            Utils.forEach(
                list, e=>
                {
                    if (fn(e))
                    {
                        list2.push(e);
                    }
                }
            );
            return list2;
        }

        static indexOf(list, fn):number
        {
            var ix = -1;
            Utils.forEach(
                list, e=>
                {
                    ix++;
                    var r = fn(e);
                    if (r)
                    {
                        return ix;
                    }
                }
            );
            return -1;
        }

        static select(list, fn)
        {
            var list2 = [];
            Utils.forEach(
                list, e=>
                {
                    var r = fn(e);
                    if (r)
                    {
                        list2.push(r);
                    }
                }
            );
            return list2;
        }

        static selectMany(list, fn)
        {
            var list2 = [];
            Utils.forEach(
                list, e=>
                {
                    var r = fn(e);
                    Utils.forEach(
                        r, e2 =>
                        {
                            list2.push(e2);
                        }
                    );
                }
            );
            return list2;
        }

        static groupBy(list, fn)
        {
            var list2 = {};
            Utils.forEach(
                list, e=>
                {
                    var key = fn(e);
                    var tmp = list2[key];
                    if (!tmp)
                    {
                        tmp = {key: key, value: []}
                        list2[key] = tmp;
                    }

                    tmp.value.push(e);
                }
            );
            return list2;
        }
    }
}