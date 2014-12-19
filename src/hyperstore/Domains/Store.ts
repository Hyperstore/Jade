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

/**
 * Hyperstore is a domain model oriented database. It can be used in web or nodejs context.</br>
 *
 * A domain model database is a database with a meta model (or schema) allowing to specify more informations on an element
 * than only its type.</br>
 *
 * A schema can contains element, properties and relationship definitions each with theirs own constraints (simple or complex).</br>
 *
 * A domain model is instanciate in a store (Hyperstore) and raises event every time something change (Property, new
 * element, deleting element, new relationship...).</br>
 *
 */

/// <reference path="../_references.ts" />
/// <reference path="../../../Scripts/typings/Q/Q.d.ts" />

module Hyperstore
{

    export interface IStoreConfiguration
    {
        defaultDomainModel?:string;
        storeId?:string;
        channels?: any[];
        schemas : any;
        domains? : any;
    }

    class DomainManager implements ICursor {
        private _domains;
        private _keys;

        private _ix:number;

        constructor() {
            this._keys = {};
            this._domains = [];
        }

        reset() {
            this._ix = 0;
        }

        next() {
            return this._domains[this._ix-1];
        }

        hasNext() : boolean {
            return this._ix++ < this._keys.length;
        }

        addDomain(domain) {
            this._keys[domain.name] = this._domains.push( domain ) - 1;
        }

        public unload(domain:DomainModel)
        {
            domain.dispose();
            var i = this._keys[name];
            if(i)
            {
                if (domain.extension)
                    this._domains[i] = (<any>domain).domain;
                else
                {
                    this._domains.splice(i);
                    delete this._keys[domain.name];
                }
            }
        }

        getDomain(name:string) : DomainModel {
            var i = this._keys[name];
            return i !== undefined ? this._domains[i] : undefined;
        }

        all() : DomainModel[] {
            return this._domains;
        }

        dispose() {
            this._domains.forEach(d=> {
                var tmp = d;
                while(tmp.extension)
                {
                    tmp.dispose();
                    tmp = tmp.domain;
                }
                tmp.dispose();
            });
            this._domains = null;
            this._keys = null;
        }
    }

    /**
     *
     * store is the main hyperstore container for domains and schemas.
     *
     * It can contains many domains and schemas and supports references between domains.
     *
     * Every change made on a domain must be in a session which works like an unit of work. When the session is closed, constraints are check on every
     * involved elements generating potential diagnostic messages. Then events representing all changes made during the session are raised.
     *
     * <code>
     *    var session = store.beginSession(); // Start a session
     *    try {
 *      ... adds, removes or changes actions
 *      session.acceptChanges(); // commit all changes
 *    }
     *    finally {
 *      session.close();   // abort or commit changes and send events
 *    }
     * </code>
     */
    export class Store
    {
        private schemasBySimpleName;
        private schemas;
        private _domains:DomainManager;
        private _subscriptions;
        public storeId:string;
        public defaultDomainModel:DomainModel;

        /**
         * EventBus - Allow communication between stores.
         */
        public eventBus:EventBus;

        /**
         * language used for resources
         */
        public language:string;

        constructor()
        {
            this._subscriptions = [];
            this.eventBus = new EventBus(this);
            this.schemas = {};
            this.schemasBySimpleName = {};
            this._domains = new DomainManager();
            new Schema(this, "$", this.primitiveSchemaDefinition());
        }

        /**
         * create a new store. You can create many independent store. They can communicate between them with the eventBus.
         *
         * @param config - Contains all informations to initialize a new store.
         * @example
         * Sample to define a new config object
         *
         * <code>
         *    var hyperstore = require('hyperstore');
         *    module.exports = (function() {
     *    "use strict";
     *
     *      return {
     *         defaultDomainModel : 'test',
     *         // schemas definition
     *         schemas: {
     *              // Define a schema named mySchema
     *   	        mySchema : {
     *                  defineSchema: function (schema) {
     *                      this.libSchema = new hyperstore.SchemaEntity(schema, 'Library');
     *                      this.libSchema.defineProperty('name', 'string');
     *                  }
     *              }
     *          },
     *          domains : {
     *              // load a domain named test
     *              test: {
     *                  // adapters : [],
     *              }
     *          }
     *      };
     *    })();
         * </code>
         */
        init(config?:any):Q.Promise<any>
        {
            var p = Q.defer<any>();

            this.storeId = Utils.newGuid();
            if (!config)
            {
                p.resolve(this);
                return p.promise;
            }

            if (typeof config === 'function')
                config = config();

            if (!config.schemas)
            {
                this.storeId = config;
                p.resolve(this);
                return p.promise;
            }

            this["config"] = config;

            if (config.storeId)
                this.storeId = config.storeId;

            if (config.schemas)
            {
                for (var schemaName in config.schemas)
                {
                    if (!config.schemas.hasOwnProperty(schemaName))
                        continue;
                    var def = config.schemas[schemaName];
                    config.schemas[schemaName].instance = new Schema(this, schemaName, def);
                }
            }

            if (config.domains) {
                for (var domainName in config.domains) {
                    if (!config.domains.hasOwnProperty(domainName))
                        continue;

                    var def = config.domains[domainName];
                    var domain = new DomainModel(this, domainName);
                    config.domains[domainName] = domain;

                    if (def.$adapters) {
                        var adapters = typeof(def.$adapters) === "function" ? def.$adapters() : def.$adapters;
                        delete def.$adapters;
                    }

                    if (adapters && adapters.forEach) {
                        adapters.forEach(a=> domain.addAdapter(a));
                    }
                    var result = this.populateDomain(def, domain);
                        if( result)
                            result.async().then(() => p.resolve(this));
                        else
                            p.resolve(this);
                }

                this.defaultDomainModel = this.getDomain(config.defaultDomainModel);
            }

            return p.promise;
        }

        private populateDomain(def, domain) : SessionResult {
            if( !def || domain.find().hasNext()) // already initialize
                return;

            if (def.$seed) {
                if (typeof(def.$seed) === "function")
                {
                    var session = domain.store.beginSession();
                    try
                    {
                        def.$seed(domain);
                        session.acceptChanges();
                    }
                    finally
                    {
                        var r = session.close();
                        return r.result;
                    }
                }
                else if (typeof(def.$seed) === "string")
                {
                    // url
                }
                return;
            }

            for (var name in def)
            {
                if( !def.hasOwnProperty(name))
                    continue;
                var root = domain.store.getSchemaElement(name);
                domain.loadFromJson(def[name], root);
            }
        }

        /**
         * unload all domains & close adapters
         */
        dispose()
        {
            this.eventBus.dispose();
            this.eventBus = undefined;
            this._domains.dispose();
            this._domains = undefined;
            this.schemas = undefined;
            this.schemasBySimpleName = undefined;
            this._subscriptions = undefined;
        }

        /**
         * Unload a domain. All domain elements are unaccessible.
         *
         * You can reload the same domain.
         *
         * @param domain
         */
        public unloadDomain(domain:DomainModel)
        {
            this._domains.unload(domain);
        }

        /**
         * Get the list of loaded domains
         * @returns {DomainModel[]}
         */
        public get domains():DomainModel[]
        {
            return this._domains.all();
        }

        /**
         * Subscribe to session completed event. This event is always raise even if the session is aborted.
         *
         * Returns a cookie allowing to unsubscribe to this event
         *
         * @param action
         * @returns {any}
         */
        onSessionCompleted(action:(s:Session) => any):number
        {
            var ix = this._subscriptions.length;
            this._subscriptions.push({ix: ix, fn: action});
            return ix;
        }

        /**
         * Unsubscribe to session completed event. Cookie is provided by the subscribe function.
         * @param cookie
         */
        removeSessionCompleted(cookie:number)
        {
            var pos = Utils.indexOf(this._subscriptions, s=> s.ix === cookie);
            if (pos >= 0)
            {
                this._subscriptions.splice(pos, 1);
            }
        }

        __sendSessionCompletedEvent(session:Session)
        {
            this._subscriptions.forEach(s=> s.fn(session));
        }

        private primitiveSchemaDefinition()
        {
            return {
                defineSchema: function (schema)
                {
                    new Primitive(schema, "string");
                    new Primitive(schema, "number");
                    new Primitive(schema, "bool");
                    new Primitive(schema, "[]");
                }
            };
        }

        /**
         * get a loaded domain by name or undefined if not exists
         * @param name
         * @returns {*}
         */
        getDomain(name:string):DomainModel
        {
            return this._domains.getDomain(name);
        }

        __addDomain(domain:DomainModel)
        {
            this._domains.addDomain(domain);
        }

        /**
         * begin a new session with optional configuration.
         * if a session already exist a nested session is created.
         * sessions are flatten, if your abort the top level session or any of a nested session, the top level session will be aborted.
         * @param config - session configuration has following options :
         *          - defaultDomain : if you create a new element during this session with no domain specified, the default domain will be use.
         * @returns {Session}
         */
        public beginSession(config?:SessionConfiguration):Session
        {
            if (!Session.current)
            {
                config = config || {};
                config.defaultDomain = config.defaultDomain || this.defaultDomainModel;
                Session.current = new Session(this, config);
            }
            else
            {
                Session.current.__nextLevel();
            }

            return Session.current;
        }

        public __addSchemaElement(schemaInfo:SchemaInfo)
        {
            var id = schemaInfo.id.toLowerCase();
            if (this.schemas[id])
            {
                throw "Duplicate schema " + schemaInfo.id;
            }

            this.schemas[id] = schemaInfo;
            var pos = id.indexOf(':');
            var simpleName = pos < 0 ? id : id.substr(pos + 1);

            if (!this.schemasBySimpleName[simpleName])
            {
                this.schemasBySimpleName[simpleName] = schemaInfo;
            }
            else
            {
                this.schemasBySimpleName[simpleName] = null; // duplicate
            }
        }

        /**
         * get a schema info by name. By default, an exception is thrown if no schema exists
         * @param schemaName
         * @param throwException
         * @returns {*}
         */
        public getSchemaInfo(schemaName:string, throwException:boolean = true):SchemaInfo
        {
            if (!schemaName)
                return undefined;

            var schemaElement;
            if (schemaName.indexOf(':') < 0)
            {
                schemaElement = this.schemasBySimpleName[schemaName.toLowerCase()];
                if (schemaElement === null)
                {
                    throw "Can not resolve schema element by its simple name due to duplicate elements. Use full name to resolve this schema element.";
                }
            }
            else
            {
                schemaElement = this.schemas[schemaName.toLowerCase()];
            }

            if (!schemaElement && throwException)
            {
                throw "Unknown schema " + schemaName;
            }

            return schemaElement;
        }

        /**
         * get schemaRelationship list
         * @param start : (optional) filter relationship starting from this element
         * @param end : (optional) filter relationship ending on this element.
         * @returns {SchemaRelationship[]}
         */
        public getSchemaRelationships(start?:any, end?:any):SchemaRelationship[]
        {
            if (typeof (
                    start) === "string")
            {
                start = this.getSchemaElement(<string>start);
            }
            if (typeof (
                    end) === "string")
            {
                end = this.getSchemaElement(<string>end);
            }

            var list = [];
            this.schemas.forEach(
                    v=>
                {
                    if (v.kind === SchemaKind.Relationship)
                    {
                        var r = <SchemaRelationship>v;
                        if ((
                            !start || r.startSchemaId === start.id) && (
                            !end || r.endSchemaId === end.id))
                        {
                            list.push(r);
                        }
                    }
                }
            );

            return list;
        }

        /**
         * get a schema element by name. A schema element can be a schemaEntity or a schemaRelationship
         * By default, an exception is thrown if no schema exists
         * @param schemaName
         * @param throwException
         * @returns {SchemaElement}
         */
        public getSchemaElement(schemaName:string, throwException:boolean = true):SchemaElement
        {
            var schemaElement = this.getSchemaInfo(schemaName, throwException);
            if ((
                !schemaElement || (
                schemaElement.kind !== SchemaKind.Relationship && schemaElement.kind !== SchemaKind.Entity)) &&
                throwException)
            {
                throw "Unknown schema " + schemaName;
            }

            return <SchemaElement>schemaElement;
        }

        /**
         * get a schema relationship by name. By default, an exception is thrown if no schema exists
         * @param schemaName
         * @param throwException
         * @returns {SchemaRelationship}
         */
        public getSchemaRelationship(schemaName:string, throwException:boolean = true):SchemaRelationship
        {
            var schemaElement = this.getSchemaInfo(schemaName, throwException);
            if ((
                !schemaElement || (
                schemaElement.kind !== SchemaKind.Relationship)) && throwException)
            {
                throw "Unknown schema " + schemaName;
            }

            return <SchemaRelationship>schemaElement;
        }

        /**
         * get a schema entity by name. By default, an exception is thrown if no schema exists
         * @param schemaName
         * @param throwException
         * @returns {SchemaEntity}
         */
        public getSchemaEntity(schemaName:string, throwException:boolean = true):SchemaEntity
        {
            var schemaElement = this.getSchemaInfo(schemaName, throwException);
            if ((
                !schemaElement || (
                schemaElement.kind !== SchemaKind.Entity)) && throwException)
            {
                throw "Unknown schema " + schemaName;
            }

            return <SchemaEntity>schemaElement;
        }

        /**
         * shortcut to execute an action in a session
         * @param action
         */
        public runInSession(action:() => void)
        {
            var session = this.beginSession();
            try
            {
                action();
                Session.current.acceptChanges();
            }
            finally
            {
                session.close();
            }
        }

        /**
         * get an element by id
         * @param id
         * @returns {*}
         */
        get(id:string):ModelElement
        {
            var domainName = id.substr(0, id.indexOf(':'));
            var domain = this.getDomain(domainName);
            return domain ? domain.get(id): undefined;
        }

        /**
         * Get a list of elements
         * @param schemaElement
         * @param kind
         * @returns {ModelElement[]}
         */
        find(schemaElement?:SchemaElement, kind:NodeType = NodeType.EntityOrRelationship): ICursor
        {
            return new SelectManyCursor(this._domains, function (domain)
                {
                    return domain.GetElements(schemaElement, kind);
                }
            );
        }
    }


    class SelectManyCursor implements ICursor {
        private _iter:ICursor;

        constructor(private _cursor:ICursor, private _select) {
            this.reset();
        }

        reset() {
            this._cursor.reset();
            this._iter = null;
        }

        hasNext() : boolean {
            while(true) {
                if(!this._iter)
                {
                    if (!this._cursor.hasNext())
                    {
                        return false;
                    }
                    this._iter = this._select(this._cursor.next());
                }
                if(this._iter.hasNext())
                    return true;
                this._iter = null;
            }
        }

        next() : any {
            return this._iter.next();
        }
    }

}