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
    export interface _IParseJsonResult {
        elem : Element;
        load : ()=>void;
    }

    /**
     * Represents a domain model
     */
    export class Domain {
        public events:EventManager;
        private _cache:{};
        public eventDispatcher:EventDispatcher;
        private _adapters:Adapter[];
        private _graph:Hypergraph;

        /**
         * Domain model constructor
         * @param store : the store the domain belong to
         * @param name : domain name
         * @param extension: __internal use only. Use DomainScope constructor to create a domain extension
         */
        constructor(public store:Store, public name:string, public extension?:string) {
            this.name = this.name.toLowerCase();
            this.extension = extension;
            this._graph = new Hypergraph(this);
            store.__addDomain(this);
            this.events = new EventManager(this.name);
            this._cache = {};
            this._adapters = [];
        }

        dispose() {
            Utils.forEach(this._adapters, a=> a.dispose());

            this._graph.dispose();
            this._graph = undefined;
            this.events.dispose();
            this.events = undefined;
            this._cache = undefined;
            this.eventDispatcher = undefined;
        }

        /**
         * Create a new domain scope
         * @param scopeName - Unique scope name
         * @param data - (optional) data to load
         * @returns {Hyperstore.DomainScope}
         */
        createScope(scopeName:string, data?) : DomainScope {
            var scope = new DomainScope(this, scopeName);
            if(data)
            {
                for (var name in data)
                {
                    if (!data.hasOwnProperty(name))
                        continue;
                    var root = this.store.getSchemaElement(name);
                    var list = scope.loadFromJson(data[name], root);
                    break;
                }
            }
            return scope;
        }

        getGraph() : any {
            return this._graph;
        }

        /**
         * validate all elements of the domain
         * @param schemaElement - filter on a specific schemaElement
         * @returns {Array} - diagnostic messages (warnings or errors)
         */
        validate(schemaElement?:SchemaElement) : DiagnosticMessage[] {
            var groups = new HashTable<string,any>();
            Utils.forEach(this.getElements(schemaElement), (m:Element) => {
                var sch = m.getInfo().schemaElement;
                var g = groups.get(sch.schema.name);
                if( !g) {
                    g = {schema:sch.schema, elems:[]};
                    groups.add(sch.schema.name,g);
                }
                g.elems.push(m);
            });

            var diags = [];
            Utils.forEach(groups, item => {
                diags = diags.concat( item.schema.constraints.validate(item.elems) );
            });
            return diags;
        }

        /**
         * create a new unique id for this domain.
         * An id is composed by two parts (the domain name and a unique id) separated by ':'
         * @param id - optional id. If not provided a new id will be generated
         * @returns {string} A domain id
         */
        createId(id?:string):string
        {
            id = id || (Domain._seq++).toString();
            return id.indexOf(Store.IdSeparator) < 0 ? this.name + Store.IdSeparator + (id || Utils.newGuid()) : id;
        }
        static _seq:number=0;
        /**
         * Add an adapter
         * @param adapter
         */
        addAdapter(adapter:Adapter)
        {
            var self = this;
            adapter.init(this);
            this._adapters.push(adapter);
        }

        /**
         *  Find a schema element by its id in the json compressed data
         * @param schemas - list of schema id from the json
         * @param id - index of the schema
         * @returns {any} - a valid schema id
         */
        private findSchemaId(schemas, id):string
        {
            if (schemas)
            {
                for (var k in schemas)
                {
                    var schema = schemas[k];
                    for (var ke in schema.elements)
                    {
                        var e = schema.elements[ke];
                        if (e.id === id)
                        {
                            var schemaId;
                            if (schema.name == null) // null or undefined
                            {
                                schemaId = e.name;
                            }
                            else
                            {
                                schemaId = schema.name + Store.IdSeparator + e.name;
                            }

                            return schemaId;
                        }
                    }
                }
            }
            return id;
        }

        /**
         * Load a domain from a json object. This object can have two specific format :
         * * hyperstore format. (generated by the hyperstore serializer)
         * * a poco object. For circular references, the newtonsoft format is used ($id and $ref) (http://james.newtonking.com/json/help/html/T_Newtonsoft_Json_PreserveReferencesHandling.htm)
         *
         * @param def
         * @param rootSchema
         * @returns {Element[]}
         */
        loadFromJson(def:any, rootSchema?:SchemaElement):Element[]
        {
            if (!def)
            {
                return;
            }

            if( typeof(def) === "string") {
                def = JSON.parse(def);
            }

            if (def.mode && def.mode === "HY") // Hyperstore format
            {
                this.store.runInSession(() => this.loadFromHyperstoreJson(def));
                return;
            }

            if (!rootSchema)
            {
                throw "rootSchema is required";
            }

            var refs = {};
            if (Utils.isArray(def))
            {
                var list = [];
                this.store.runInSession(
                    () =>
                    {
                        Utils.forEach(def, e => {
                            var result = this.__parseJson(e, rootSchema, refs);
                            if(result) {
                                list.push(result.elem);
                                result.load();
                            }
                        });
                    },
                    SessionMode.Loading
                );
                return list;
            }
            else
            {
                var r = [];
                this.store.runInSession(() => {
                    var result = this.__parseJson(def, rootSchema, refs);
                        if(result) {
                            r.push(result.elem);
                            result.load();
                        }
                    },
                    SessionMode.Loading
                );
                return r;
            }
        }

        __parseJson(obj:any, rootSchema:SchemaElement, refs, parent?):_IParseJsonResult {
            var schema = this.introspectSchema(rootSchema, obj);
            if (!schema)
                throw "Ambiguous schema finding for " + rootSchema.name + " (Use checkMarkerJson) on " + obj;

            if ((<any>schema).loadFromJson) {
                var mel:Element = (<any>schema).loadFromJson(this, obj, parent);
                if (mel)
                    return {
                        elem: mel, load: function () {
                        }
                    };
            }

            var id = obj.$id;
            if (!id && (<any>schema).getKeyValueFromJson) {
                id = (<any>schema).getKeyValueFromJson(obj, parent);
            }
            mel = this.extension && this.get(id) || this.create(schema, id);
            return {elem: mel, load: function() { mel.loadFromJson(obj, refs);}};
        }

        /**
         * try to identify schema from a json object in case of ambiguity (inheritance)
         * @param schema
         * @param json
         */
        private introspectSchema(schema:SchemaElement, json) : SchemaElement {
            if (typeof(schema) == "string")
                schema = this.store.getSchemaEntity(<any>schema);

            if (schema.subElements.length === 0)
                return schema; // no ambiguity

            // Try fo find the most appropriate schema by checking properties
            return this.recursiveIntrospect(schema, json);
        }

        private recursiveIntrospect(schema:SchemaElement, json) : SchemaElement {
            for(var i=0;i<schema.subElements.length;i++) {
                var subSchema = this.recursiveIntrospect( schema.subElements[i], json);
                if (subSchema)
                    return subSchema; // no ambiguity
            }
            if((<any>schema).checkJsonMarker) {
                return (<any>schema).checkJsonMarker(json) ? schema : undefined
            }
            for(var p in json){
                if( json.hasOwnProperty(p) && !schema.getProperty(p,true))
                    return undefined;
            }
            return schema;
        }

        private loadFromHyperstoreJson(def):Array<Element>
        {
            var list = [];
            var session = this.store.beginSession(SessionMode.Loading);
            try
            {
                for (var k = 0; k < def.entities.length; k++)
                {
                    var entity = def.entities[k];
                    var entityId = this.createId(entity["id"]);
                    if (entity.state && entity.state === "deleted")
                    {
                        this.remove(entityId, entity.v);
                        continue;
                    }

                    var elem;
                    var schemaId = this.findSchemaId(def.schemas, entity["schema"]);
                    var schema = this.store.getSchemaElement(schemaId);
                    if (!this.elementExists(entityId))
                    {
                        list.push(elem = this.create(schema, entityId));
                    }

                    if (entity.properties)
                    {
                        for (var kprop in entity.properties)
                        {
                            var prop = entity.properties[kprop];
                            var propDef = schema.getProperty(<string>prop.name, true);
                            if (propDef)
                            {
                                var v = prop.value;
                                this.setPropertyValue(entityId, propDef, v);
                            }
                        }
                    }
                }

                if (def.relationships)
                {
                    for (var k = 0; k < def.relationships.length; k++)
                    {
                        var relationship = def.relationships[k];
                        var entityId = this.createId(relationship["id"]);
                        if (relationship.state && relationship.state === "deleted")
                        {
                            this.remove(entityId, relationship.v);
                            continue;
                        }

                        var schemaId = this.findSchemaId(def.schemas, relationship["schema"]);
                        var schema = this.store.getSchemaElement(schemaId);

                        if (!this.elementExists(entityId))
                        {
                            var start = this.get(this.createId(relationship.startId));
                            this.createRelationship(
                                <SchemaRelationship>schema, start, this.createId(relationship.endId),
                                this.findSchemaId(def.schemas, relationship.endSchemaId), entityId
                            );
                        }

                        if (relationship.properties)
                        {
                            for (var kprop in relationship.properties)
                            {
                                var prop = relationship.properties[kprop];
                                var propDef = schema.getProperty(<string>prop.name, true);
                                if (propDef)
                                {
                                    var v = prop.value;
                                    this.setPropertyValue(entityId, propDef, v);
                                }
                            }
                        }
                    }
                }
                session.acceptChanges();
            }
            finally
            {
                session.close();
            }
            return list;
        }

        /**
         * Get relationships of the domain filtered by schema or terminal elements.
         * Filters can be combined.
         * @param schemaElement: Select only relationships of this schema (including inheritance)
         * @param start: Select outgoing relationships of 'start'
         * @param end : Select incoming relationships of 'end'
         * @returns {Element[]}
         */
        getRelationships(schemaElement?:SchemaRelationship, start?:Element, end?:Element):Cursor
        {
            var currentSchema = <SchemaElement>schemaElement;
            var tmpSchema = currentSchema;

            if (start)
            {
                var metadata = start.getInfo();
                var edges = this._graph.getEdges(metadata.id, Direction.Outgoing);
                if (edges)
                {
                    return edges.map( info => {
                        if (end && end.getInfo().id !== info.endId)
                        {
                            return null;
                        }

                        if (!tmpSchema || info.schemaId !== tmpSchema.id)
                        {
                            tmpSchema = this.store.getSchemaElement(info.schemaId);
                        }
                        if (schemaElement && !tmpSchema.isA(schemaElement.id))
                        {
                            return null;
                        }

                        return this.getFromCache(
                            tmpSchema, metadata.id, metadata.schemaElement.id, info.endId,
                            info.endSchemaId, info.id
                        );
                    });
                }
            }
            else if (end)
            {
                var metadata = end.getInfo();
                var edges = this._graph.getEdges(metadata.id, Direction.Incoming);
                if (edges)
                {
                    return edges.map(info => {
                        if (!tmpSchema || info.schemaId !== tmpSchema.id)
                        {
                            tmpSchema = this.store.getSchemaElement(info.schemaId);
                        }
                        if (schemaElement && !tmpSchema.isA(schemaElement.id))
                        {
                            return null;
                        }

                        return this.getFromCache(
                            tmpSchema, info.endId, info.endSchemaId, metadata.id, metadata.schemaElement.id, info.id
                        );
                    });
                }
            }
            else
            {
                return this._graph.getNodes(NodeType.Relationship, schemaElement)
                    .map(info=>
                      {
                          if (!tmpSchema || info.schemaId !== tmpSchema.id)
                          {
                              tmpSchema = this.store.getSchemaElement(info.schemaId);
                          }
                          if (!schemaElement || tmpSchema.isA(schemaElement.id))
                          {
                              return this.getFromCache(
                                  tmpSchema, info.startId, info.startSchemaId, info.endId, info.endSchemaId, info.id
                              );
                          }

                          return undefined;
                      }
                );
            }
            return Cursor.emptyCursor;
        }

        copy(mel:Element, options?) {
            options = options || {refs : {}};
            var refs = options.refs || (options.refs = {});
            var schema = mel.getSchemaElement();

            var ownerId = this.createId( options.mapId ? options.mapId(this, mel) : Utils.splitIdentity(mel.getId())[1] );

            var copy = options.refs[ownerId];
            if(copy) return copy;

            if( mel.getDomain().name === this.name || (copy = this.get(ownerId)) == null) // merge
                copy = (<any>schema).create(this, ownerId);
            options.refs[ownerId] = copy;

            var self = this;
            mel.getSchemaElement().getProperties(true).forEach(prop =>
                {
                    if( prop.kind !== PropertyKind.Normal)
                        return;
                    var pid = ownerId + "." + prop.name;
                    var pv = mel.getDomain().getPropertyValue(mel.getId(),prop);
                    if( pv && pv.version) {
                        var node = this._graph.addPropertyNode(pid, prop.schemaProperty.id, pv.value, Utils.getUtcNow());
                        this._raiseEvent(
                            new ChangePropertyValueEvent(
                                this.name,
                                ownerId,
                                schema.id,
                                prop.name,
                                prop.serialize(pv.value),
                                undefined,
                                node.version
                            )
                        );
                    }
                }
            );
            mel.getRelationships().forEach(rel=>
                {
                    var rs = <SchemaRelationship>rel.getSchemaElement();
                    var end = rel.getEnd();
                    if (!end )
                        return;

                    if (end.getDomain().name === mel.getDomain().name ) {
                        end = this.copy(end, options);
                    }
                    this.createRelationship(rs, copy, end.getId(), end.getSchemaElement().id);
                }
            );
            return copy;
        }

        /**
         * get value of an element property in the underlying hypergraph.
         * Returns 'undefined' if the value doesn't exist and no defaultValue is set in the property schema.
         * Otherwise, returns a PropertyValue {value, version}
         * @param ownerId
         * @param property
         * @returns {*}
         */
        getPropertyValue(ownerId:string, property:SchemaProperty):PropertyValue
        {
            var owner = this._graph.getNode(ownerId);
            if (!owner)
            {
                throw "Invalid element " + ownerId;
            }

            var pid = owner.id + "." + property.name;
            var node = this._graph.getPropertyNode(pid);
            var value = undefined;

            if (!node)
            {
                var def = property.defaultValue || (<any>property.schemaProperty).defaultValue;
                if (!def)
                {
                    return undefined;
                }
                return new PropertyValue(typeof(def) === "function" ? def() : def, undefined, 0);
            }

            return new PropertyValue(node.value, undefined, node.version);
        }

        /**
         * set value of an element property
         * @param ownerId
         * @param property
         * @param value
         * @param version
         * @returns {Hyperstore.PropertyValue} {value, oldValue, version}
         */
        setPropertyValue(ownerId:string, property:SchemaProperty, value:any, version?:number):PropertyValue {
            var owner = this.get(ownerId);
            if (!owner) {
                throw "Invalid element " + ownerId;
            }

            var session = this.store.beginSession();
            try {
                var pid = owner.getId() + "." + property.name;
                var node = this._graph.getPropertyNode(pid);
                var oldValue = undefined;

                if (!node) {
                    var r = property.onChange({mel: owner, value: value});
                    value = r.value;
                    node = this._graph.addPropertyNode(pid, property.schemaProperty.id, value, version || Utils.getUtcNow());
                }
                else {
                    var r = property.onChange({mel: owner, value: value, oldValue: node.value});
                    value = r.value;

                    oldValue = node.value;
                    node.value = value;
                    node.version = version || Utils.getUtcNow();
                    this._graph.updatePropertyNode(node);
                }

                var pv = new PropertyValue(value, oldValue, node.version);
                this._raiseEvent(
                    new ChangePropertyValueEvent(
                        this.name,
                        ownerId,
                        owner.getSchemaElement().id,
                        property.name,
                        property.serialize(pv.value),
                        property.serialize(pv.oldValue),
                        pv.version
                    )
                );
                session.acceptChanges();
                return pv;
            }
            finally {
                session.close();
            }
        }

        /**
         * create a new domain entity using the specified schema
         * @param schemaElement
         * @param id
         * @param version
         * @returns {Hyperstore.Element}
         */
        create(schemaElement:SchemaElement, id?:string, version?:number):Element
        {
            var session = this.store.beginSession();
            try {
                Utils.Requires(schemaElement, "schemaElement");
                if (typeof(schemaElement) == "string")
                    schemaElement = this.store.getSchemaEntity(<any>schemaElement);

                id = this.createId(id);
                schemaElement.onBefore({action: "Create", id: id});

                var node = this._graph.addNode(id, schemaElement.id, version);
                // after node creation
                var mel = <Element>schemaElement.deserialize(new SerializationContext(this, id));
                this._raiseEvent(
                    new AddEntityEvent(this.name, id, schemaElement.id, node.version)
                );
                this._cache[id] = mel; // TODO cache mel in node and remove _cache
                schemaElement.onAfter({action: "Create", mel: mel});
                session.acceptChanges();
                return mel;
            }
            finally {
                session.close();
            }
        }

        /**
         * create a new domain relationship using the specified schema
         * @param schemaRelationship
         * @param start
         * @param endId
         * @param endSchemaId
         * @param id
         * @param version
         * @returns {Hyperstore.Relationship}
         */
        createRelationship(schemaRelationship:SchemaRelationship, start:Element, endId:string, endSchemaId:string, id?:string, version?:number):Relationship {
            Utils.Requires(schemaRelationship, "schemaRelationship");
            Utils.Requires(start, "start");
            Utils.Requires(endId, "endId");
            if (typeof(schemaRelationship) == "string")
                schemaRelationship = this.store.getSchemaRelationship(<any>schemaRelationship);

            var session = this.store.beginSession();
            try {
                id = this.createId(id);
                schemaRelationship.onBefore({action: "Create", id: id});

                var src = start.getInfo();
                var node = this._graph.addRelationship(
                    id, schemaRelationship.id, src.id, src.schemaElement.id, endId, endSchemaId, version
                );
                // after node creation
                var mel = <Relationship>schemaRelationship.deserialize(
                    new SerializationContext(this, id, src.id, src.schemaElement.id, endId, endSchemaId)
                );

                this._raiseEvent(new AddRelationshipEvent(
                        this.name, id, schemaRelationship.id, src.id, src.schemaElement.id, endId, endSchemaId, node.version)
                );

                this._cache[id] = mel; // TODO cache mel in node
                schemaRelationship.onAfter({action: "Create", mel: mel});
                session.acceptChanges();
                return mel;
            }
            finally {
                session.close();
            }
        }

        onEventRaised(evt:AbstractEvent) {

        }

        private _raiseEvent(evt) {
            this.store.runInSession(
                () => {
                    if( Array.isArray(evt)) {
                        Utils.forEach(evt, e=> {Session.current.addEvent(e); this.onEventRaised(e);});
                    }
                    else {
                        Session.current.addEvent(evt);
                        this.onEventRaised(evt);
                    }
                }
            );
        }

        private normalizeId(id) {
            if(id == null)
                throw "Invalid id. Must not be null";
            var pos = id.indexOf(Store.IdSeparator);
            return pos <=0 ? this.name + Store.IdSeparator + id : id; // TODO remove domainName in key
        }

        /**
         * remove an element (entity or relationship)
         * @param id
         * @param version
         */
        remove(id:string, version?:number)
        {
            id = this.normalizeId(id);
            var mel = this.get(id);
            if(mel) {   //  mel is not an error but no interceptors will be called
                var schemaElement = mel.getSchemaElement();
                schemaElement.onBefore({action: "Remove", mel: mel});
            }

            var session = this.store.beginSession();
            try
            {
                var events = this._graph.removeNode(id, version);
                this._raiseEvent(events);

                if( schemaElement)
                    schemaElement.onAfter({action:"Remove", id: id, schema:schemaElement});

                // Clear cache
                Utils.forEach(events, e =>
                    {
                        var mel = this._cache[e.id];
                        if (mel)
                        {
                            mel.dispose();
                            delete mel;
                        }
                    }
                );

                session.acceptChanges();
            }
            finally {
                session.close();
            }
        }

        /**
         * check if an element (entity or relationship) exists
         * @param id
         * @returns {boolean}
         */
        elementExists(id:string):boolean
        {
            if(!id) return;
            id = this.normalizeId(id);
            return !!this._graph.getNode(id);
        }

        /**
         * get an element (entity or relationship) by its id
         * @param id
         * @returns {*}
         */
        get(id:string):Element
        {
            if(!id) return;
            id = this.normalizeId(id);
            var node = this._graph.getNode(id);
            if (!node)
            {
                return undefined;
            }

            var schemaElement = this.store.getSchemaElement(node.schemaId);
            return this.getFromCache(
                schemaElement, node.startId, node.startSchemaId, node.endId, node.endSchemaId, node.id
            );
        }

        /**
         * Get all entities
         * @param schemaElement - filter on a specific schemaElement
         * @returns {ICursor} - a cursor
         */
        getEntities(schemaElement?:SchemaElement):Cursor
        {
            return this.getElements(schemaElement, NodeType.Entity);
        }

        /**
         * get a list of elements
         * @param schemaElement - filter on a specific schemaElement
         * @param kind - filter on a specific node type (entity or relationship)
         * @returns {ICursor} - a cursor
         */
        getElements(schemaElement?:SchemaElement, kind:NodeType = NodeType.EntityOrRelationship):Cursor
        {
            if (typeof (schemaElement) === "string")
            {
                schemaElement = this.store.getSchemaElement(schemaElement.toString());
            }
            var _this = this;

            return this._graph.getNodes(kind, schemaElement)
                .map(
                function (node)
                {
                    var schemaElement = _this.store.getSchemaElement(node.schemaId);
                    return _this.getFromCache(
                        schemaElement, node.startId, node.startSchemaId, node.endId, node.endSchemaId, node.id
                    );
                }
            );
        }

        private getFromCache(schemaElement:SchemaElement, startId?:string, startSchemaId?:string, endId?:string, endSchemaId?:string, id?:string)
        {
            var mel = this._cache[id];
            if (mel)
            {
                return mel;
            }
            mel = schemaElement.deserialize(new SerializationContext(this, id, startId, startSchemaId, endId, endSchemaId));
            this._cache[mel.id] = mel;
            return mel;
        }
    }

    export class DomainScope extends Domain {
        private _events: AbstractEvent[];

        constructor(public domain:Domain, extension:string)
        {
            super(domain.store, domain.name, extension);

            if(!extension)
                throw "Invalid extension name";

            var that:any = this;
            // simulate graph property as protected
            that._graph = new HypergraphEx(domain);
            this._events = [];
        }

        /**
         * unload scope
         * @param commitChanges - apply changes on the parent domain
         */
        unload(commitChanges:boolean=false) {
            this.store.unloadDomain(this,commitChanges );
        }

        /**
         * get all local changes
         * @returns {ITrackedElement[]}
         */
        getChanges() : Cursor {
            var tracking = new TrackingData();
            this._events.forEach(e=> {
                tracking.__onEvent(e);
            });
            tracking.__prepareTrackedElements(this.store);
            return new MapCursor(Cursor.from(tracking.involvedTrackedElements), (e:ITrackedElement) =>
            {
                if(e.state === TrackingState.Unknown || e.state === TrackingState.Updated && !e.properties)
                    return null;
                return e;
            });
        }

        onEventRaised(evt:AbstractEvent) {
            this._events.push(evt);
        }

        apply(dispatcher?:EventDispatcher) {
            this.store.runInSession(() => {
                var d = new DomainEventDispatcher(this.domain, dispatcher || this.store.eventBus.defaultEventDispatcher);
                this._events.forEach(e => {
                    d.handleEvent(e);
                });
            });
        }

        // getFromCache(id) {}
    }

    class Hypergraph
    {
        _deletedNodes:number = 0;
        _nodes;
        _keys;
        _properties;
        static DELETED_NODE = '$';

        constructor(public domain:Domain)
        {
            this._properties = {};
            this._nodes = [];
            this._keys = {};
        }

        dispose()
        {
            this._keys = null;
            this._nodes = null;
            this._properties = null;
        }

        getKey(id) {
            return this._keys[id];
        }

        private addNodeCore(node) : GraphNode {
            var n = this.getKey(node.id);
            if (n !== undefined && n !== Hypergraph.DELETED_NODE)
            {
                throw "Duplicate element " + node.id;
            }

            this._keys[node.id] = this._nodes.push( node ) - 1;
            return node;
        }

        addNode(id:string, schemaId:string, version:number):GraphNode
        {
            var node = new GraphNode(id, schemaId, NodeType.Entity, version);
            return this.addNodeCore(node);
        }

        updateNode(node:GraphNode)
        {
            // when a node is update but doesn't exist yet in the extension
            // needsUpdate flag is set on the getPropertyNode of the hypergraphex
            if( (<any>node).needsUpdate)
                this._keys[node.id] = this._nodes.push( node ) - 1;
        }

        updatePropertyNode(node:GraphNode)
        {
            // when a node is update but doesn't exist yet in the extension
            // needsUpdate flag is set on the getPropertyNode of the hypergraphex
            if( (<any>node).needsUpdate)
                this._properties[node.id] = node;
        }

        addPropertyNode(id:string, schemaId:string, value:any, version:number):GraphNode
        {
            var node = new GraphNode(
                id, schemaId, NodeType.Property, version, undefined, undefined, undefined, undefined, value
            );
            return this._properties[node.id] = node;
        }

        getPropertyNode(id:string) : GraphNode {
            return this._properties[id];
        }

        addRelationship(id:string, schemaId:string, startId:string, startSchemaId:string, endId:string, endSchemaId:string, version:number):GraphNode
        {
            var start = this.getNode(startId);
            if (!start)
            {
                throw "Invalid start element " + startId + " when adding relationship " + id;
            }

            var node = new GraphNode(id, schemaId, NodeType.Relationship, version, startId, startSchemaId, endId, endSchemaId);
            this.addNodeCore(node);

            if (startId === endId)
            {
                start.addEdge(id, schemaId, Direction.Both, startId, startSchemaId);
                this.updateNode(start);
                return node;
            }

            start.addEdge(id, schemaId, Direction.Outgoing, endId, endSchemaId);
            this.updateNode(start);
            var end = this.getNode(endId);
            if (end)
            {
                end.addEdge(id, schemaId, Direction.Incoming, startId, startSchemaId);
                this.updateNode(end);
            }
            return node;
        }

        getEdges(id:string, direction:Direction) : Cursor {
            var n = this._keys[id];
            if (n !== undefined && n !== Hypergraph.DELETED_NODE)
            {
                var node = this._nodes[n];
                return direction === Direction.Incoming ? node.incomings : node.outgoings;
            }
            return null;
        }

        getNode(id:string):GraphNode
        {
            var n = this._keys[id];
            return (n !== undefined && n !== Hypergraph.DELETED_NODE) ? this._nodes[n] : undefined;
        }

        removeNode(id:string, version:number):AbstractEvent[]
        {
            var events = [];
            var revents = [];

            var node = this.getNode(id);
            if (!node)
            {
                return events;
            }
            if (!version)
            {
                version = Utils.getUtcNow();
            }

            var sawNodes = {};

            // Cascading
            this.traverseNodes(
                node, node=>
                {
                    sawNodes[node.id] = true;
                    var evt;
                    if (!node.startId)
                    {
                        evt = new RemoveEntityEvent(this.domain.name, node.id, node.schemaId, version);
                    }
                    else
                    {
                        evt = new RemoveRelationshipEvent(
                            this.domain.name, node.id, node.schemaId, node.startId, node.startSchemaId, node.endId,
                            node.endSchemaId, version
                        );
                    }
                    evt.TL = node.id === id; // top level event
                    events.push(evt)

                    // don't replay cascading during rollback or undo/redo
                    if (Session.current.mode & (SessionMode.Rollback | SessionMode.UndoOrRedo))
                        return null;

                    var nodes = [];
                    var edges = this.getEdges(node.id, Direction.Outgoing);
                    edges.forEach(edge =>
                                  {
                                      if (!sawNodes[edge.id])
                                      {
                                          sawNodes[edge.id] = true;
                                          nodes.push(this.getNode(edge.id));
                                      }
                                  });

                    edges = this.getEdges(node.id, Direction.Incoming);
                    edges.forEach(edge =>
                                  {
                                      if (!sawNodes[edge.id])
                                      {
                                          sawNodes[edge.id] = true;
                                          nodes.push(this.getNode(edge.id));
                                      }
                                  });

                    // If this is a relationship and embedded, remove end element
                    if (node.startId)
                    {
                        var schema = this.domain.store.getSchemaRelationship(node.schemaId);
                        if (schema.embedded)
                        {
                            if (!sawNodes[node.endId])
                            {
                                sawNodes[node.endId] = true;
                                nodes.push(this.getNode(node.endId));
                            }
                        }
                    }

                    return nodes;
                }
            );

            events = revents.concat(events);
            var pevents = [];
            events.forEach(e=> this.removeNodeInternal(e.id, sawNodes, pevents));
            if( this._deletedNodes > 1000)
                this.shrink();
            return pevents.concat(events);
        }

        private shrink() {
            var nodes = [];
            for(var key in this._keys) {
                var n = this._keys[key];
                if( n === Hypergraph.DELETED_NODE)
                    continue;
                this._keys[key] = nodes.push(this._nodes[n]) - 1;
            }
            this._nodes = nodes;
            this._deletedNodes = 0;
        }

        private removeNodeInternal(id:string, sawNodes, events:AbstractEvent[])
        {
            var index = this.getKey(id);
            if (index === undefined || index === Hypergraph.DELETED_NODE)
            {
                return;
            }

            var node = this.getNode(id);
            if(!node.needsUpdate)
                this._nodes[index] = null;
            this._deletedNodes++;
            // if( this.domain.store.keepDeletedNodes)
            this._keys[id] = Hypergraph.DELETED_NODE;
            // else
            //     delete this._keys[index];

            if (node.kind === NodeType.Relationship)
            {
                var start = this.getNode(node.startId);
                if (node.startId == node.endId)
                {
                    if(start) // already deleted
                    {
                        start.removeEdge(id, Direction.Both);
                        this.updateNode(start);
                    }
                    return node;
                }
                else {
                    if(start)
                    {
                        start.removeEdge(id, Direction.Outgoing);
                        this.updateNode(start);
                    }
                    var end = this.getNode(node.endId);
                    if (end) {
                        end.removeEdge(id, Direction.Incoming);
                        this.updateNode(end);
                    }
                }
            }

            var schema = this.domain.store.getSchemaElement(node.schemaId);
            var self = this;
            schema.getProperties(true).forEach(
                    p=>
                {
                    var pnode = node.properties[p.name];
                    if (pnode)
                    {
                        events.push(
                            new RemovePropertyEvent(
                                self.domain.name, node.id, node.schemaId, p.name, pnode.value,
                                pnode.version
                            )
                        );
                    }
                }
            );
        }

        traverseNodes(startNode:GraphNode, visit:(node:GraphNode) => GraphNode[])
        {
            var queue = [];
            queue.push(startNode);

            while (queue.length > 0)
            {
                var node = queue.pop();
                if (!node)
                {
                    continue;
                }

                var nodes = visit(node);
                if (!nodes)
                {
                    return;
                }

                for (var k in nodes)
                {
                    node = nodes[k];
                    queue.unshift(node);
                }
            }
        }

        getNodes(kind:NodeType, schema?:SchemaElement): Cursor
        {
            return new NodesCursor(this, kind, schema);
        }
    }

    class HypergraphEx extends Hypergraph {
        private _superHyperGraph:Hypergraph;

        constructor(domain:Domain) {
            super(domain);
            this._superHyperGraph = (<any>domain)._graph;
        }

        getKey(id) {
            var idx = this._keys[id];
            if( idx !== undefined) return idx;
            return this._superHyperGraph.getKey(id);
        }

        getPropertyNode(pid:string) : GraphNode {
            var node = super.getPropertyNode(pid);
            if( node )
                return node;

            node = this._superHyperGraph.getPropertyNode(pid);
            if( !node) return node;
            // add a flag to force the update if this read is for an update
            node = node.clone();
            node.needsUpdate = true;
            return node;
        }

        getNodes(kind:NodeType, schema?:SchemaElement): Cursor
        {
            return new ConcatCursor(
                new NodesCursor(this, kind, schema),
                new MapCursor(
                    new NodesCursor(this.domain.getGraph(), kind, schema),
                    n => this._keys[n.id] !== Hypergraph.DELETED_NODE ? n : undefined
                )
            );
        }

        getEdges(id:string, direction:Direction) : Cursor {
            var n = this._keys[id];
            if (n !== undefined )
            {
                if( n === Hypergraph.DELETED_NODE ) return null;
                var node = this._nodes[n];
                var cursor1 = direction === Direction.Incoming ? node.incomings : node.outgoings;
                var cursor2 = this._superHyperGraph.getEdges(id, direction);
                return cursor2 ?
                       new ConcatCursor(
                           cursor1,
                           new MapCursor(cursor2,
                                         n => this._keys[n.id] !== Hypergraph.DELETED_NODE ? n : undefined))
                    : cursor1;
            }
            return this._superHyperGraph.getEdges(id, direction);
        }

        getNode(id:string):GraphNode
        {
            var n = this._keys[id];
            if (n !== undefined ) {
                return n !== Hypergraph.DELETED_NODE ? this._nodes[n] : undefined;
            }
            var node = this._superHyperGraph.getNode(id);
            if( !node) return node;
            // add a flag to force the update if this read is for an update
            node = node.clone();
            node.needsUpdate = true;
            return node;
        }
    }

    export class Cursor  {
        reset() {}
        hasNext():boolean {return false;}
        next():any {return undefined;}

        static emptyCursor = new Cursor();

        firstOrDefault(callback?) {
            this.reset();
            while(this.hasNext()) {
                var r = this.next();
                if(!callback || callback(r))
                    return r;
            }
            return undefined;
        }

        selectMany(selector) {
            return Utils.selectMany(this, selector);
        }

        forEach(callback) {
            this.reset();
            while(this.hasNext()) {
                callback(this.next());
            }
        }

        count(callback?) : number {
            var cx=0;
            this.reset();
            while(this.hasNext()) {
                if( !callback || callback(this.next()))
                    cx++;
            }
            return cx;
        }

        concat(list:Cursor) : Cursor {
            return new ConcatCursor(this, list);
        }

        any(callback?) : boolean {
            this.reset();
            while(this.hasNext()) {
                if( !callback || callback(this.next()))
                    return true;
            }
            return false;
        }

        toArray() : any[] {
            var list = [];
            this.forEach(n=>list.push(n));
            return list;
        }

        map(callback) : Cursor {
            return new MapCursor(this, callback);
        }

        filter(callback) : Cursor {
            return new FilterCursor(this, callback);
        }

        static from(obj) : Cursor {
            if( Array.isArray(obj))
                return new ArrayCursor(obj);

            if(obj.hasNext)
                return obj;

            throw "Not implemented";
        }
    }

    class ConcatCursor extends Cursor {
        private _cursors : Cursor[];
        private _idx:number;
        private _set;
        private _current;

        constructor(...cursors : Cursor[]) {
            super();
            this._cursors = cursors;
            this.reset();
        }

        reset() {
            this._current = undefined;
            this._set = {};
            this._idx = 0;
            this._cursors.forEach( c => c.reset());
        }

        hasNext() : boolean {

            while(true)
            {
                if (this._idx < this._cursors.length)
                {
                    var r = this._cursors[this._idx].hasNext();
                    if (r)
                    {
                        this._current = this._cursors[this._idx].next();
                        if (!this._set[this._current.id])
                        {
                            this._set[this._current.id] = true;
                            return true;
                        }
                        continue;
                    }
                    this._idx++;
                }
                else
                {
                    this._current = undefined;
                    return false;
                }
            }
        }

        next() {
            return this._current;
        }
    }

    export class MapCursor extends Cursor {
        private _current;

        constructor( private _cursor:Cursor, private _filter) {
            super();
            this.reset();
        }

        reset() {
            this._cursor.reset();
            this._current = undefined;
        }

        hasNext() : boolean {
            while(true) {
                if (!this._cursor.hasNext()) {
                    this._current = undefined;
                    return false;
                }
                var r = this._filter(this._cursor.next());
                if(r != null) {
                    this._current = r;
                    return true;
                }
            }
        }

        next() {
            return this._current;
        }
    }

    export class FilterCursor extends Cursor {
        private _current;

        constructor( private _cursor:Cursor, private _filter) {
            super();
            this.reset();
        }

        reset() {
            this._cursor.reset();
            this._current = undefined;
        }

        hasNext() : boolean {
            while(true) {
                if( !this._cursor.hasNext())
                {
                    this._current = undefined;
                    return false;
                }
                var r = this._filter(this._cursor.next());
                if( r !== false) {
                    this._current = r;
                    return true;
                }
            }
        }

        next() {
            return this._current;
        }
    }

    export class ArrayCursor extends Cursor {
        private _index:number;

        constructor(private _array) {
            super();
            this.reset();
        }

        reset() {
            this._index = 0;
        }

        hasNext() : boolean {
            if( this._index === this._array.length)
                return false;
            this._index++;
            return true;
        }

        next() : any {
            return this._array[this._index-1];
        }
    }

    class NodesCursor extends Cursor  {
        private _index : number;
        private _current : GraphNode;

        constructor(private _graph:Hypergraph, private _kind:NodeType, private _schema:SchemaElement) {
            super();
            this.reset();
        }

        reset() {
            this._index = 0;
            this._current = undefined;
        }

        hasNext() : boolean {
            while(true) {
                if( this._index === this._graph._nodes.length) {
                    this._current = undefined;
                    return false;
                }
                var node = this._graph._nodes[this._index++];
                if (node && (node.kind & this._kind) !== 0 && (!this._schema || this._schema.id === node.schemaId))
                {
                    var key = this._graph._keys[node.id];
                    if( key !== Hypergraph.DELETED_NODE)
                    {
                        this._current = node;
                        return true;
                    }
                }
            }
        }

        next() : any {
            return this._current;
        }
    }
    /**
     *
     */
    export enum Direction
    {
        Incoming = 1,
        Outgoing = 2,
        Both = 3
    }

    /**
     * Type of element in the graph model
     */
    export enum NodeType
    {
        /**
         * Element is an entity
         */
        Entity = 1,
        /**
         * Element is a relationship
         */
        Relationship = 2,
        /**
         * Value used for query only
         */
        EntityOrRelationship = 3,
        /**
         * Element is a property (Do not use this value in a query)
         * @type {number}
         */
        Property = 4
    }

    class NodeInfo
    {
        constructor(public id:string, public schemaId:string, public version:number)
        {
            if (!version)
            {
                this.version = Utils.getUtcNow();
            }
        }
    }

    class EdgeInfo extends NodeInfo
    {
        constructor(id:string, schemaId:string, version:number, public endId?:string, public endSchemaId?:string)
        {
            super(id, schemaId, version);
        }
    }

    class GraphNode extends EdgeInfo
    {
        outgoings:HashTable<string, EdgeInfo>;
        incomings:HashTable<string, EdgeInfo>;

        public properties : GraphNode[];
        public kind:NodeType;
        public startId:string;
        public startSchemaId:string;
        public needsUpdate:boolean;

        constructor(id:string, schemaId:string, kind:NodeType, version:number, startId?:string, startSchemaId?:string, endId?:string, endSchemaId?:string, public value?:any, outgoings?:HashTable<string, EdgeInfo>, incomings?:HashTable<string, EdgeInfo>)
        {
            super(id, schemaId, version, endId, endSchemaId);

            this.kind = kind;
            this.startId = startId;
            this.startSchemaId = startSchemaId;

            this.properties = [];
            this.outgoings = outgoings && outgoings.clone() || new HashTable<string, EdgeInfo>();
            this.incomings = incomings && incomings.clone() || new HashTable<string, EdgeInfo>();
        }

        clone() : GraphNode  {
            var node = new GraphNode(this.id, this.schemaId, this.kind, this.version, this.startId, this.startSchemaId, this.endId, this.endSchemaId, this.value, this.outgoings, this.incomings);
            return node;
        }

        addEdge(id:string, edgeSchemaId:string, direction:Direction, endId:string, endSchemaId:string)
        {
            var edge = new EdgeInfo(id, edgeSchemaId, undefined, endId, endSchemaId);

            if ((direction & Direction.Incoming) === Direction.Incoming)
            {
                this.incomings.add(id, edge);
            }
            if ((direction & Direction.Outgoing) === Direction.Outgoing)
            {
                this.outgoings.add(id, edge);
            }
        }

        removeEdge(id:string, direction:Direction)
        {
            if ((direction & Direction.Incoming) === Direction.Incoming)
            {
                this.incomings.remove(id);
            }
            if ((direction & Direction.Outgoing) === Direction.Outgoing)
            {
                this.outgoings.remove(id);
            }
        }
    }
}