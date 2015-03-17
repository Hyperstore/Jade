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

    class DomainManager extends Cursor {
        private _domains;
        private _keys;
        private _ix:number;
        private _iterations;

        constructor() {
            super();
            this._keys = {};
            this._domains = [];
            this._iterations = [];
        }

        reset() {
            this._ix = 0;
        }

        next() {
            return this._domains[this._iterations[this._ix-1]];
        }

        hasNext() : boolean {
            return this._ix++ < this._iterations.length;
        }

        hasExtensions() : boolean {
            return this._iterations.length !== this._domains.length;
        }

        addDomain(domain) {
            var idx = this._domains.push( domain ) - 1;
            this._keys[domain.name] = idx;
            this.resetIterations();
        }

        private resetIterations() {
            this._iterations = [];
            Utils.forEach(this._keys, v => this._iterations.push(v));
        }

        public unload(domain:DomainModel)
        {
            domain.dispose();
            var i = this._keys[domain.name];
            if(i)
            {
                this._domains.splice(i);
                i = undefined;
                if (domain.extension) {
                    var parent = (<any>domain).domain;
                    for(var x=0; this._domains.length;x++) {
                        if( this._domains[x] === parent ) {
                            i=x;
                            break;
                        }
                    }
                    if(i===undefined) throw "Inconsistant domain list when unloading an extension";
                    this._keys[domain.name] = i;
                }
                else
                {
                    delete this._keys[domain.name];
                }
                this.resetIterations();
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
        // Identity separator
        public static get IdSeparator() : string {
            return ":";
        }

        private schemasBySimpleName;
        private schemaElements;
        private _schemas : HashTable<string,Schema>;
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

        /**
         * Create a new store instance
         * @param id store id
         */
        constructor(id?:string)
        {
            this._schemas = new HashTable<string,Schema>();
            this._subscriptions = [];
            this.eventBus = new EventBus(this);
            this.schemaElements = {};
            this.schemasBySimpleName = {};
            this._domains = new DomainManager();
            new Schema(this, "$", this.primitiveSchemaDefinition());
            this.storeId = id || Utils.newGuid();
        }

        /**
         * internal use only
         * @param name
         * @param schema
         * @private
         */
        __addSchema(name:string, schema:Schema) {
            if( this.getSchema(name))
                throw "Duplicate schema " + name;
            this._schemas.add(name, schema);
        }

        get schemas() : Cursor {
            return new MapCursor(this._schemas, s => s);
        }

        /**
         * get schema by name
         * @param name
         * @returns {any}
         */
        getSchema(name:string):Schema {
            return this._schemas.get(name);
        }

        /**
         * load schemas
         * @param schemas - One (or an array of) schema configuration
         * @returns an object containing all created schemas
         */
        loadSchemas(schemas, overrides?) {
            if(!schemas) return null;
            if (typeof (schemas) === 'function')
                schemas = schemas();

            var loader = new Loader(this);
            return loader.loadSchemas(schemas, overrides);
        }

        createDomainAsync(config?:any):Q.Promise<DomainModel> {
            var p = Q.defer<DomainModel>();
            this.createDomain(config, p);
            return p.promise;
        }

        createDomain(config?:any, p?:Q.Deferred<any>):DomainModel {
            if (!config)
                return null;

            if(typeof(config) === "string") {
                var domain = new DomainModel(this, <string>config);
                if(p) {
                    p.resolve(domain);
                }
                return domain;
            }

            if( config.schema) {
                this.loadSchemas(config.schema, config.overrides);
            }

            var domainName = config.name;
            domain = new DomainModel(this, domainName);
            this["config"] = config;

            var self = this;
            var tasks;
            // Adapters must be asynchronous
            if (config.adapters) {
                tasks = [];
                // Get adapter list
                var adapters = typeof(config.adapters) === "function" ? config.adapters() : config.adapters;

                // Initialize and load data
                adapters.forEach(a=> {
                        domain.addAdapter(a)
                        tasks.push(a.loadElementsAsync());
                    }
                );
            }

            // If any adapter or channels,
            if (tasks) {
                if (!p) throw Error("You must use createDomainAsync when using adapters and/or channels.");

                Q.all(tasks).then(function () {
                        self.populateDomain(config, domain);
                        self.addChannels(config, domain);
                        self.defaultDomainModel = this.getDomain(config.defaultDomainModel);
                        p.resolve(domain);
                    }
                ).fail(function (err) {
                        p.reject(err);
                    }
                );
            }
            else {
                this.populateDomain(config, domain);
                self.addChannels(config, domain);
                this.defaultDomainModel = this.getDomain(config.defaultDomainModel);
                if (p) p.resolve(domain);
            }

            return domain;
        }

        private addChannels(config, domain:DomainModel) {
            if (config.channels) {
                var channels = typeof(config.channels) === "function" ? config.channels() : config.channels;

                // Initialize channels
                channels.forEach(channel=> {
                        channel.associate(domain);
                        domain.store.eventBus.addChannel(channel);
                    }
                );
            }
        }

        private populateDomain(def, domain:DomainModel) : SessionResult
        {
            if (!def || domain.getElements().hasNext()) // already initialize
                return;

            if (def.seed)
            {
                if (typeof(def.seed) === "function")
                {
                    var session = domain.store.beginSession();
                    try
                    {
                        def.seed(domain);
                        session.acceptChanges();
                    }
                    finally
                    {
                        var r = session.close();
                        return r;
                    }
                }
                else if (typeof(def.seed) === "string")
                {
                    // url
                }
                return;
            }

            if (def.data)
            {
                for (var name in def.data)
                {
                    if (!def.data.hasOwnProperty(name))
                        continue;
                    var root = domain.store.getSchemaElement(name);
                    var list = domain.loadFromJson(def.data[name], root);
                    domain["root"] = list && list.length === 1 ? Utils.firstOrDefault(list) : list;
                    break;
                }
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
            this.schemaElements = undefined;
            this.schemasBySimpleName = undefined;
            this._subscriptions = undefined;
            this._schemas = null;
        }

        /**
         * Unload a domain. All domain elements will be unreachable at the end of the current session.
         *
         * You can reload the same domain.
         *
         * @param domain - Domain or extension to unload
         * @param commitChanges - For an extension, persists changes in the parent domain.
         */
        public unloadDomain(domain:DomainModel, commitChanges:boolean=false)
        {
            var scope = <DomainModelScope>domain;
            if( scope.apply && commitChanges )
                scope.apply();
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
                    new Primitive(schema, "any"),
                    new Primitive(schema, "string", "{value} must be a string", (val, old, ctx) => !val || typeof(val) === "string", false, ConstraintKind.Check);
                    new Primitive(schema, "number", "{value} must be a number", (val, old, ctx) => !val || typeof(val) === "number", false, ConstraintKind.Check);
                    new Primitive(schema, "boolean", "{value} must be a boolean", (val, old, ctx) => !val || typeof(val) === "boolean", false, ConstraintKind.Check);
                }
            };
        }

        getActiveDomains() : HashTable<string,DomainModel> {
            var dic = new HashTable<string,DomainModel>();
            this._domains.all().forEach( d=> { dic._fastInsert(d.name, d);});
            return dic;
        }

        /**
         * is there any extensions loaded ?
         * @returns {boolean}
         */
        get hasDomainExtensions(): boolean {
            return this._domains.hasExtensions();
        }

        /**
         * get a loaded domain by name or undefined if not exists
         * @param name
         * @returns {*}
         */
        getDomain(name:string):DomainModel
        {
            if( Session.current) // optim
                return Session.current.getDomain(name, true) || this._domains.getDomain(name);
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
            if (this.schemaElements[id])
            {
                throw "Duplicate schema " + schemaInfo.id;
            }

            this.schemaElements[id] = schemaInfo;
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
                schemaElement = this.schemaElements[schemaName.toLowerCase()];
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
            this.schemaElements.forEach(v=>
                {
                    if (v.kind === SchemaKind.Relationship)
                    {
                        var r = <SchemaRelationship>v;
                        if ((!start || r.startSchemaId === start.id) && (!end || r.endSchemaId === end.id))
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
        public runInSession(action:() => void, mode:SessionMode=SessionMode.Normal)
        {
            var session = this.beginSession({mode:mode});
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
        getElements(schemaElement?:SchemaElement, kind:NodeType = NodeType.EntityOrRelationship): Cursor
        {
            return new SelectManyCursor(this._domains, function (domain:DomainModel)
                {
                    return domain.getElements(schemaElement, kind);
                }
            );
        }
    }


    class SelectManyCursor extends Cursor {
        private _iter:Cursor;

        constructor(private _cursor:Cursor, private _select) {
            super();
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