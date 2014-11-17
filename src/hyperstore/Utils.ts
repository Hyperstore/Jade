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
    export class Utils
    {
        private static date = new Date();
        private static sequence;

        // http://stackoverflow.com/questions/7966559/how-to-convert-javascript-date-object-to-ticks
        static getUtcNow():number
        {
            // the number of .net ticks at the unix epoch
            var epochTicks = 621355968000000000;

            // there are 10000 .net ticks per millisecond
            var ticksPerMillisecond = 10000;

            // calculate the total number of .net ticks for your date
            return epochTicks + (Utils.date.getTime() * ticksPerMillisecond);
        }

        // Thanks to broofa & Briguy37 : http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        static newGuid():string
        {
            var d = Utils.date.getTime();
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c)
            {
                var r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c === 'x'
                    ? r
                    : (r & 0x7 | 0x8)).toString(16);
            });
            return uuid;
        }

        static isArray(value):boolean
        {
            var s = typeof value;
            return value && typeof (value) === 'object' && value instanceof Array;
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
                    if (e  && (!fn  || fn(e)))
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
                        if (e && (!fn || fn(e)))
                        {
                            return e;
                        }
                    }
                }
            }
            return undefined;
        }

        static forEach(list, fn)
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
                    if (e)
                    {
                        fn(e);
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
                            fn(e);
                        }
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
            Utils.forEach(list, e=>
            {
                if (fn(e))
                {
                    list2.push(e);
                }
            });
            return list2;
        }

        static indexOf(list, fn) : number
        {
            var ix = -1;
            Utils.forEach(list, e=>
            {
                ix++;
                var r = fn(e);
                if (r)
                {
                    return ix;
                }
            });
            return -1;
        }

        static select(list, fn)
        {
            var list2 = [];
            Utils.forEach(list, e=>
            {
                var r = fn(e);
                if (r)
                {
                    list2.push(r);
                }
            });
            return list2;
        }

        static selectMany(list, fn)
        {
            var list2 = [];
            Utils.forEach(list, e=>
            {
                var r = fn(e);
                Utils.forEach(r, e2 =>
                {
                    list2.push(e2);
                });
            });
            return list2;
        }

        static groupBy(list, fn)
        {
            var list2 = {};
            Utils.forEach(list, e=>
            {
                var key = fn(e);
                var tmp = list2[key];
                if (!tmp)
                {
                    tmp = {key: key, value: []}
                    list2[key] = tmp;
                }

                tmp.value.push(e);
            });
            return list2;
        }
    }

    export class Queryable<T>
    {
        private _count;

        constructor(public items)
        {
        }

        get count():number
        {
            if (!this._count)
            {
                if (this.items.length)
                {
                    this._count = this.items.length;
                }
                else
                {
                    var cx = 0;
                    Utils.forEach(this.items, e => cx++);
                    this._count = cx;
                }
            }
            return this._count;
        }

        concat(other:Queryable<T>)
        {
            return new Queryable<T>(this.items.concat(other.items));
        }

        any(fn?):boolean
        {
            return !!Utils.firstOrDefault(this.items, fn);
        }

        select(fn):Queryable<T>
        {
            return new Queryable<T>(Utils.select(this.items, fn));
        }

        reverse():Queryable<T>
        {
            return new Queryable<T>(Utils.reverse(this.items));
        }

        where(fn):Queryable<T>
        {
            return new Queryable<T>(Utils.where(this.items, fn));
        }

        selectMany(fn):Queryable<T>
        {
            return new Queryable<T>(Utils.selectMany(this.items, fn));
        }

        groupBy(fn)
        {
            return Utils.groupBy(this.items, fn);
        }

        forEach(fn)
        {
            return Utils.forEach(this.items, fn);
        }

        firstOrDefault(fn?):T
        {
            return Utils.firstOrDefault(this.items, fn);
        }
    }

// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// ----------------------------------------------------------------------------
// from https://github.com/Azure/azure-mobile-services/blob/master/sdk/Javascript/src/Utilities/Promises.js
    enum ResolutionState {
        success=1,
        error
    }

    export class Promise
    {

        private _callbackFrames;
        private _resolutionState;
        private _resolutionValueOrError;
        resolve:(val?:any)=>void;
        reject:(val:any)=>void;

        constructor()
        {
            this._callbackFrames = [];
            this._resolutionState = null;
            this._resolutionValueOrError = null;
            this.resolve = this.bind(this._resolveSuccess, this);
            this.reject = this.bind(this._resolveError, this);
        }

        then(success?, error?)
        {
            var callbackFrame = {success: success, error: error, chainedPromise: new Promise()};

            // If this promise is already resolved, invoke callbacks immediately. Otherwise queue them.
            if (this._resolutionState)
            {
                this._invokeCallback(callbackFrame);
            }
            else
            {
                this._callbackFrames.push(callbackFrame);
            }

            return callbackFrame.chainedPromise;
        }

        private bind(func, target) { return function () { func.apply(target, arguments); }; } // Older browsers lack Function.prototype.bind
        private isGenericPromise(obj) { return obj && (typeof obj.then === "function"); }

        private _resolveSuccess(val) { this._resolve(ResolutionState.success, val); }

        private _resolveError(err) { this._resolve(ResolutionState.error, err); }

        private _resolve(state, valueOrError)
        {
            if (this._resolutionState)
            {
                // Can't affect resolution state when already resolved. We silently ignore the request, without throwing an error,
                // to prevent concurrent resolvers from affecting each other during race conditions.
                return;
            }

            this._resolutionState = state;
            this._resolutionValueOrError = valueOrError;

            // Notify all queued callbacks
            for (var i = 0, j = this._callbackFrames.length; i < j; i++)
            {
                this._invokeCallback(this._callbackFrames[i]);
            }
        }

        private _invokeCallback(frame)
        {
            var callbackToInvoke = this._resolutionState === ResolutionState.success
                ? frame.success
                : frame.error;
            if (typeof callbackToInvoke === "function")
            {
                // Call the supplied callback either to transform the result (for success) or to handle the error (for error)
                // The setTimeout ensures handlers are always invoked asynchronosly, even if the promise was already resolved,
                // to avoid callers having to differentiate between sync/async cases
                setTimeout(this.bind(function ()
                {
                    var passthroughValue, passthroughState, callbackDidNotThrow = true;
                    try
                    {
                        passthroughValue = callbackToInvoke(this._resolutionValueOrError);
                        passthroughState = ResolutionState.success;
                    }
                    catch (ex)
                    {
                        callbackDidNotThrow = false;
                        passthroughValue = ex;
                        passthroughState = ResolutionState.error;
                    }

                    if (callbackDidNotThrow && this.isGenericPromise(passthroughValue))
                    {
                        // By returning a futher promise from a callback, you can insert it into the chain. This is the basis for composition.
                        // This rule is in the Promises/A+ spec, but not Promises/A.
                        passthroughValue.then(frame.chainedPromise._resolveSuccess, frame.chainedPromise._resolveError);
                    }
                    else
                    {
                        frame.chainedPromise._resolve(passthroughState, passthroughValue);
                    }
                }, this), 1);
            }
            else
            {
                // No callback of the applicable type, so transparently pass existing state/value down the chain
                frame.chainedPromise._resolve(this._resolutionState, this._resolutionValueOrError);
            }
        }

        // -----------
        // Everything from here on is extensions beyond the Promises/A+ spec intended to ease code
        // sharing between WinJS and browser-based Mobile Services apps

        done(success, error)
        {
            this.then(success, error).then(null, function (err)
            {
                // "done" throws any final errors as global uncaught exceptions. The setTimeout
                // ensures the exception won't get caught in the Promises machinery or user code.
                setTimeout(function () { throw new Error(err); }, 1);
            });
            return undefined; // You can't chain onto a .done()
        }
    }
}