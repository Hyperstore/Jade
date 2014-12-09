// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// ----------------------------------------------------------------------------
// from https://github.com/Azure/azure-mobile-services/blob/master/sdk/Javascript/src/Utilities/Promises.js

/// <reference path="../_references.ts" />
module Hyperstore
{

    enum ResolutionState {
        success = 1,
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
        private isGenericPromise(obj)
        {
            return obj && (
                typeof obj.then === "function");
        }

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
                setTimeout(
                    this.bind(
                        function ()
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
                                // By returning a further promise from a callback, you can insert it into the chain. This is the basis for composition.
                                // This rule is in the Promises/A+ spec, but not Promises/A.
                                passthroughValue.then(
                                    frame.chainedPromise._resolveSuccess, frame.chainedPromise._resolveError
                                );
                            }
                            else
                            {
                                frame.chainedPromise._resolve(passthroughState, passthroughValue);
                            }
                        }, this
                    ), 1
                );
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
            this.then(success, error).then(
                null, function (err)
                {
                    // "done" throws any final errors as global uncaught exceptions. The setTimeout
                    // ensures the exception won't get caught in the Promises machinery or user code.
                    setTimeout(function () { throw new Error(err); }, 1);
                }
            );
            return undefined; // You can't chain onto a .done()
        }
    }
}