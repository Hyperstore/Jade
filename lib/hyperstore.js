(function(global, name, definition) {if (typeof module != 'undefined')  definition(module.exports, require('q'));else if (typeof define == 'function' && typeof define.amd == 'object') define(['exports', 'require'], definition(exports));else {var namespace = {};global[name] = namespace;definition(namespace, Q);}}(this, 'Hyperstore', function(Hyperstore, Q) {var Hyperstore;
(function (Hyperstore) {
    (function (SchemaKind) {
        SchemaKind[SchemaKind["Entity"] = 0] = "Entity";
        SchemaKind[SchemaKind["Relationship"] = 1] = "Relationship";
        SchemaKind[SchemaKind["ValueObject"] = 2] = "ValueObject";
        SchemaKind[SchemaKind["Primitive"] = 3] = "Primitive";
    })(Hyperstore.SchemaKind || (Hyperstore.SchemaKind = {}));
    var SchemaKind = Hyperstore.SchemaKind;
    (function (Cardinality) {
        Cardinality[Cardinality["OneToOne"] = 0] = "OneToOne";
        Cardinality[Cardinality["OneToMany"] = 1] = "OneToMany";
        Cardinality[Cardinality["ManyToOne"] = 2] = "ManyToOne";
        Cardinality[Cardinality["ManyToMany"] = 3] = "ManyToMany";
    })(Hyperstore.Cardinality || (Hyperstore.Cardinality = {}));
    var Cardinality = Hyperstore.Cardinality;
    var SerializationContext = (function () {
        function SerializationContext(domain, id, startId, startSchemaId, endId, endSchemaId, value) {
            this.domain = domain;
            this.id = id;
            this.startId = startId;
            this.startSchemaId = startSchemaId;
            this.endId = endId;
            this.endSchemaId = endSchemaId;
            this.value = value;
        }
        return SerializationContext;
    })();
    Hyperstore.SerializationContext = SerializationContext;
    (function (PropertyKind) {
        PropertyKind[PropertyKind["Normal"] = 0] = "Normal";
        PropertyKind[PropertyKind["Calculated"] = 1] = "Calculated";
    })(Hyperstore.PropertyKind || (Hyperstore.PropertyKind = {}));
    var PropertyKind = Hyperstore.PropertyKind;
    var Schema = (function () {
        function Schema(store, name, def) {
            this.store = store;
            this.name = name;
            this._elements = new Hyperstore.HashTable();
            this.constraints = new Hyperstore.ConstraintsManager(this);
            if (def && def.defineSchema) {
                def.defineSchema(this);
            }
            store.__addSchema(name, this);
        }
        Schema.prototype.getSchemaElements = function () {
            return new Hyperstore.MapCursor(this._elements, function (s) { return s; });
        };
        Schema.prototype.getSchemaEntities = function () {
            return new Hyperstore.MapCursor(this._elements, function (s) { return s.kind === 0 /* Entity */ ? s : undefined; });
        };
        Schema.prototype.getSchemaRelationships = function (start, end) {
            return new Hyperstore.MapCursor(this._elements, function (s) {
                if (s.kind !== 1 /* Relationship */)
                    return;
                if (start && s.startProperty !== start.id)
                    return;
                if (end && s.endProperty !== end.id)
                    return;
                return s;
            });
        };
        Schema.prototype.__addSchemaElement = function (schemaInfo) {
            var id = schemaInfo.id.toLowerCase();
            var pos = id.indexOf(':');
            var simpleName = pos < 0 ? id : id.substr(pos + 1);
            if (this._elements.keyExists(simpleName))
                throw "Duplicate schema name " + id;
            this._elements.add(simpleName, schemaInfo);
            this.store.__addSchemaElement(schemaInfo);
        };
        return Schema;
    })();
    Hyperstore.Schema = Schema;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var SchemaInfo = (function () {
        function SchemaInfo(schema, kind, id) {
            this.schema = schema;
            this.kind = kind;
            this.id = id;
            this.name = id.indexOf('.') <= 0 || (schema.name && id.substr(0, schema.name.length) !== schema.name) ? id : id.substr(schema.name.length + 1);
            this.id = schema.name ? schema.name + Hyperstore.Store.IdSeparator + this.name : id;
        }
        SchemaInfo.prototype.deserialize = function (ctx) {
            return ctx.value;
        };
        SchemaInfo.prototype.serialize = function (value) {
            return value;
        };
        return SchemaInfo;
    })();
    Hyperstore.SchemaInfo = SchemaInfo;
})(Hyperstore || (Hyperstore = {}));
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Hyperstore;
(function (Hyperstore) {
    var SchemaElement = (function (_super) {
        __extends(SchemaElement, _super);
        function SchemaElement(schema, kind, id, baseElement) {
            _super.call(this, schema, kind, id);
            this.baseElement = baseElement;
            this.subElements = [];
            this._properties = {};
            this._references = {};
            this.proto = Object.create(baseElement ? baseElement.proto : (kind === 0 /* Entity */ ? Hyperstore.ModelElement.prototype : Hyperstore.ModelRelationship.prototype));
            if (baseElement)
                baseElement.subElements.push(this);
        }
        SchemaElement.prototype.addInterceptor = function (interceptor) {
            if (!interceptor)
                return;
            this._interceptors = this._interceptors || [];
            this._interceptors.push(interceptor);
        };
        SchemaElement.prototype.onAfter = function (ctx) {
            if (this._interceptors) {
                Hyperstore.Utils.forEach(this._interceptors, function (i) {
                    ctx.action === "Create" ? i.afterCreate && i.afterCreate(ctx.mel) : ctx.action == "Remove" ? i.afterRemove && i.afterRemove(ctx.id, ctx.schema) : i.afterLoad && i.afterLoad(ctx.mel);
                });
            }
            if (this.baseElement)
                this.baseElement.onAfter(ctx);
        };
        SchemaElement.prototype.onBefore = function (ctx) {
            if (this._interceptors) {
                Hyperstore.Utils.forEach(this._interceptors, function (i) {
                    ctx.action === "Create" ? i.beforeCreate && i.beforeCreate(ctx.mel) : ctx.action === "Remove" ? i.beforeRemove && i.beforeRemove(ctx.mel) : i.beforeLoad && i.beforeLoad(ctx.mel);
                });
            }
            if (this.baseElement)
                this.baseElement.onBefore(ctx);
        };
        SchemaElement.prototype.getKeyValueFromJson = function (data, parent) {
            var keyProperties = this.getKeyProperties().toArray();
            if (keyProperties.length === 0)
                return;
            var keys = [];
            if (parent) {
                var v = parent.getKey(true);
                if (v) {
                    keys.push(v);
                    keys.push(".");
                }
            }
            var ok = false;
            keyProperties.forEach(function (p) {
                var v = data[p.name];
                if (v) {
                    ok = true;
                    keys.push(v);
                }
            });
            if (ok)
                return keys.join("");
        };
        SchemaElement.prototype.getKeyProperties = function () {
            return new Hyperstore.ArrayCursor(this.getProperties(true)).map(function (p) { return p.isKey ? p : undefined; });
        };
        SchemaElement.prototype.getProperties = function (recursive) {
            var list = [];
            Hyperstore.Utils.forEach(this._properties, function (v) {
                list.push(v);
            });
            if (recursive && this.baseElement) {
                list = list.concat(this.baseElement.getProperties(true));
            }
            return list;
        };
        SchemaElement.prototype._getReferences = function (recursive) {
            var list = [];
            Hyperstore.Utils.forEach(this._references, function (v) {
                list.push(v);
            });
            if (recursive && this.baseElement) {
                list = list.concat(this.baseElement._getReferences(true));
            }
            return list;
        };
        SchemaElement.prototype.getReference = function (name, recursive) {
            if (recursive === void 0) { recursive = true; }
            var p = this._references[name];
            if (p) {
                return p;
            }
            if (recursive === false || !this.baseElement) {
                return undefined;
            }
            return this.baseElement.getReference(name, true);
        };
        SchemaElement.prototype.getProperty = function (name, recursive) {
            if (recursive === void 0) { recursive = true; }
            var p = this._properties[name];
            if (p) {
                return p;
            }
            if (recursive === false || !this.baseElement) {
                return undefined;
            }
            return this.baseElement.getProperty(name, true);
        };
        SchemaElement.prototype.__defineReferenceProperty = function (schemaRelationship, opposite) {
            var name = opposite ? schemaRelationship.endProperty : schemaRelationship.startProperty;
            if (this._references[name]) {
                throw "Duplicate property " + name;
            }
            var c = schemaRelationship.cardinality;
            var info = {
                name: name,
                opposite: opposite,
                schemaRelationship: schemaRelationship,
                isCollection: c === 3 /* ManyToMany */ || (!opposite && c === 1 /* OneToMany */) || (opposite && c === 2 /* ManyToOne */)
            };
            this._references[name] = info;
            var refName = "__ref" + name + "__";
            if (!info.isCollection) {
                var desc = {
                    configurable: true,
                    enumerable: true,
                    set: function (v) {
                        this[refName].setReference(v);
                    },
                    get: function () {
                        return this[refName].getReference();
                    }
                };
                Object.defineProperty(this.proto, info.name, desc);
            }
        };
        SchemaElement.prototype.defineProperty = function (name, schema, defaultValue, kind) {
            var _this = this;
            if (kind === void 0) { kind = 0 /* Normal */; }
            var desc;
            if (name.name) {
                desc = name;
                name = desc.name;
            }
            else {
                desc = new Hyperstore.SchemaProperty(this, name, schema, defaultValue, kind);
            }
            if (this.getProperty(name, true)) {
                throw "Duplicate property name " + name;
            }
            if (typeof (desc.schemaProperty) === "string") {
                desc.schemaProperty = this.schema.store.getSchemaInfo(desc.schemaProperty);
            }
            desc.owner = this;
            this._properties[name] = desc;
            this.schema.constraints.addPropertyConstraint(desc);
            var schema = desc.schemaProperty;
            while (schema) {
                Hyperstore.Utils.forEach(schema.constraints, function (c) { return _this.schema.constraints.__setPropertyConstraint(desc, c, schema); });
                schema = schema.parent;
            }
            if (desc.kind == 0 /* Normal */) {
                Object.defineProperty(this.proto, desc.name, {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        return Hyperstore.ModelElement.prototype.get.call(this, desc);
                    },
                    set: function (value) {
                        Hyperstore.ModelElement.prototype.set.call(this, desc, value);
                    }
                });
            }
            else {
                var code = desc.defaultValue;
                if (typeof (code) !== "function" && typeof (code) === "string" && code.length > 0) {
                    if (code.match(/{(.*)}/) == null) {
                        code = 'return ' + code + ';';
                    }
                    code = new Function(code);
                }
                if (!code) {
                    throw "Calculated property must provide code";
                }
                try {
                    Object.defineProperty(this.proto, desc.name, {
                        enumerable: true,
                        configurable: false,
                        get: code
                    });
                }
                catch (e) {
                    throw "Error on " + desc.name + "property definition for " + this.id + " - " + e;
                }
            }
            return desc;
        };
        SchemaElement.prototype.isA = function (schema) {
            if (typeof (schema) === "string")
                schema = this.schema.store.getSchemaInfo(schema);
            var id = schema.id;
            if (id === this.id) {
                return true;
            }
            if (this.baseElement) {
                return this.baseElement.isA(schema);
            }
            return false;
        };
        SchemaElement.prototype.deserialize = function (ctx) {
            var mel = Object.create(this.proto);
            mel.__initialize(ctx.domain, ctx.id, this, ctx.startId, ctx.startSchemaId, ctx.endId, ctx.endSchemaId);
            Hyperstore.Utils.forEach(this._references, function (info) {
                var refName = "__ref" + info.name + "__";
                if (!info.isCollection) {
                    mel[refName] = new ReferenceHandler(mel, info.schemaRelationship, info.opposite);
                }
                else {
                    mel[refName] = new Hyperstore.ModelElementCollection(mel, info.schemaRelationship, info.opposite);
                    Object.defineProperty(mel, info.name, {
                        configurable: true,
                        enumerable: true,
                        value: mel[refName]
                    });
                }
            });
            return mel;
        };
        SchemaElement.prototype.serialize = function (value) {
            return;
        };
        SchemaElement.prototype.addConstraint = function (message, constraint, asError, kind, propertyName) {
            if (asError === void 0) { asError = false; }
            if (kind === void 0) { kind = 0 /* Check */; }
            this.schema.constraints.addConstraint(this, {
                kind: kind,
                condition: constraint,
                message: message,
                messageType: asError ? 1 /* Error */ : 0 /* Warning */,
                propertyName: propertyName
            });
        };
        return SchemaElement;
    })(Hyperstore.SchemaInfo);
    Hyperstore.SchemaElement = SchemaElement;
    var ReferenceHandler = (function () {
        function ReferenceHandler(_source, _schemaRelationship, _opposite) {
            this._source = _source;
            this._schemaRelationship = _schemaRelationship;
            this._opposite = _opposite;
        }
        ReferenceHandler.prototype.getReference = function () {
            if (this._source.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (!this.relationship) {
                var start = this._opposite ? undefined : this._source;
                var end = this._opposite ? this._source : undefined;
                var cursor = this._source.getInfo().domain.getRelationships(this._schemaRelationship, start, end);
                this.relationship = cursor.hasNext() ? cursor.next() : undefined;
            }
            if (!this.relationship) {
                return undefined;
            }
            return this._opposite ? this.relationship.getStart() : this.relationship.getEnd();
        };
        ReferenceHandler.prototype.setReference = function (v) {
            if (v && !v.getInfo || v.isDisposed) {
                var property = !this._opposite ? this._schemaRelationship.startProperty : this._schemaRelationship.endProperty;
                throw "Invalid collection element '" + v + "'. Must be a valid domain element for property " + property;
            }
            if (this._source.isDisposed) {
                throw "Can not use a disposed element";
            }
            var other = v;
            var start = this._opposite ? undefined : this._source;
            var end = this._opposite ? this._source : undefined;
            var domain = this._source.getInfo().domain;
            if (this.relationship) {
                var cursor = domain.getRelationships(this._schemaRelationship, start, end);
                this.relationship = cursor.hasNext() ? cursor.next() : undefined;
            }
            start = this._opposite ? other : this._source;
            end = this._opposite ? this._source : other;
            if (this.relationship) {
                var info = this.relationship.getInfo();
                if (other && info.startId === start.getInfo().id && info.endId === other.getInfo().id) {
                    return;
                }
                domain.remove(info.id);
            }
            this.relationship = undefined;
            if (other) {
                this.relationship = domain.createRelationship(this._schemaRelationship, start, end.getInfo().id, end.getInfo().schemaElement.id);
            }
        };
        return ReferenceHandler;
    })();
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var SchemaEntity = (function (_super) {
        __extends(SchemaEntity, _super);
        function SchemaEntity(schema, id, baseElement) {
            _super.call(this, schema, 0 /* Entity */, id, baseElement);
            this.baseElement = baseElement;
            schema.__addSchemaElement(this);
        }
        SchemaEntity.prototype.create = function (domain, id, version) {
            if (!domain)
                throw "domain is required.";
            return domain.create(this, id, version);
        };
        return SchemaEntity;
    })(Hyperstore.SchemaElement);
    Hyperstore.SchemaEntity = SchemaEntity;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var SchemaProperty = (function () {
        function SchemaProperty(parent, name, schemaProperty, defaultValue, kind) {
            if (kind === void 0) { kind = 0 /* Normal */; }
            this.parent = parent;
            this.name = name;
            this.schemaProperty = schemaProperty;
            this.defaultValue = defaultValue;
            this.kind = kind;
            this.isKey = false;
            if (!schemaProperty)
                throw "Invalid schema property for property " + name;
        }
        SchemaProperty.prototype.deserialize = function (ctx) {
            return ctx.value && this.schemaProperty.deserialize(ctx);
        };
        SchemaProperty.prototype.serialize = function (value) {
            return value && this.schemaProperty.serialize(value);
        };
        SchemaProperty.prototype.addConstraint = function (message, condition, asError, kind) {
            if (kind === void 0) { kind = 1 /* Validate */; }
            this.owner.schema.constraints.addPropertyConstraint(this, condition, message, asError, kind);
            return this;
        };
        SchemaProperty.prototype.addInterceptor = function (interceptor) {
            if (!interceptor || !interceptor.onChange)
                return;
            this._interceptors = this._interceptors || [];
            this._interceptors.push(interceptor);
        };
        SchemaProperty.prototype.onChange = function (ctx) {
            if (this._interceptors) {
                Hyperstore.Utils.forEach(this._interceptors, function (i) { return ctx.action === "Create" ? i.onChange(ctx.mel, ctx.value, ctx.oldValue) : i.onChange(ctx.mel, ctx.value, ctx.oldValue); });
            }
            return ctx;
        };
        return SchemaProperty;
    })();
    Hyperstore.SchemaProperty = SchemaProperty;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var SchemaRelationship = (function (_super) {
        __extends(SchemaRelationship, _super);
        function SchemaRelationship(schema, id, startSchemaId, endSchemaId, embedded, cardinality, startProperty, endProperty, baseElement) {
            _super.call(this, schema, 1 /* Relationship */, id, baseElement);
            this.startSchemaId = startSchemaId;
            this.endSchemaId = endSchemaId;
            this.embedded = embedded;
            this.cardinality = cardinality;
            this.baseElement = baseElement;
            schema.__addSchemaElement(this);
            this.startProperty = startProperty;
            this.endProperty = endProperty;
        }
        Object.defineProperty(SchemaRelationship.prototype, "startProperty", {
            get: function () {
                return this._startProperty;
            },
            set: function (name) {
                if (name) {
                    this._startProperty = name;
                    var source = this.schema.store.getSchemaElement(this.startSchemaId);
                    source.__defineReferenceProperty(this, false);
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(SchemaRelationship.prototype, "endProperty", {
            get: function () {
                return this._endProperty;
            },
            set: function (name) {
                if (name) {
                    this._endProperty = name;
                    var source = this.schema.store.getSchemaElement(this.endSchemaId);
                    source.__defineReferenceProperty(this, true);
                }
            },
            enumerable: true,
            configurable: true
        });
        SchemaRelationship.prototype.create = function (domain, start, endId, endSchemaId, id, version) {
            if (!domain)
                throw "domain is required.";
            return domain.createRelationship(this, start, endId, endSchemaId, id, version);
        };
        return SchemaRelationship;
    })(Hyperstore.SchemaElement);
    Hyperstore.SchemaRelationship = SchemaRelationship;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var SchemaValueObject = (function (_super) {
        __extends(SchemaValueObject, _super);
        function SchemaValueObject(schema, id, parent) {
            _super.call(this, schema, 2 /* ValueObject */, id);
            this.parent = parent;
            schema.__addSchemaElement(this);
        }
        SchemaValueObject.prototype.addConstraint = function (message, condition, asError, kind) {
            if (asError === void 0) { asError = true; }
            if (kind === void 0) { kind = 1 /* Validate */; }
            this.constraints = this.constraints || [];
            this.constraints.push({
                kind: kind,
                condition: condition,
                message: message,
                messageType: asError ? 1 /* Error */ : 0 /* Warning */
            });
        };
        SchemaValueObject.prototype.deserialize = function (ctx) {
            return this.parent ? this.parent.deserialize(ctx) : ctx.value;
        };
        SchemaValueObject.prototype.serialize = function (value) {
            return this.parent ? this.parent.serialize(value) : value;
        };
        return SchemaValueObject;
    })(Hyperstore.SchemaInfo);
    Hyperstore.SchemaValueObject = SchemaValueObject;
    var Primitive = (function (_super) {
        __extends(Primitive, _super);
        function Primitive(schema, id, message, condition, asError, kind) {
            if (asError === void 0) { asError = true; }
            if (kind === void 0) { kind = 0 /* Check */; }
            _super.call(this, schema, id);
            if (condition)
                this.addConstraint(message, condition, asError, kind);
            this.kind = 3 /* Primitive */;
        }
        return Primitive;
    })(SchemaValueObject);
    Hyperstore.Primitive = Primitive;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var SchemaState = (function () {
        function SchemaState(store, id, config, schema, ext) {
            if (ext === void 0) { ext = false; }
            this.id = id;
            this.config = config;
            this.extension = false;
            this.extension = ext;
            this.constraints = {};
            this.meta = {};
            if (store) {
                this.schema = schema || new Hyperstore.Schema(store, this.id);
            }
        }
        SchemaState.Pending = new SchemaState(null, null, "$pending");
        return SchemaState;
    })();
    var Loader = (function () {
        function Loader(store) {
            this.store = store;
            this._resolver = store.fileResolver;
        }
        Loader.prototype.loadSchemas = function (schemas, overrides) {
            var _this = this;
            var meta = {};
            if (!schemas)
                return meta;
            this._overrides = overrides;
            if (!Array.isArray(schemas))
                schemas = [schemas];
            this._configs = schemas;
            this._schemas = new Hyperstore.HashTable();
            this.store.schemas.forEach(function (s) { return _this._schemas.add(s.name, new SchemaState(_this.store, s.name, null, s, false)); });
            this._configs.forEach(function (schema) {
                var state = _this._parseSchema(schema);
                meta[state.id] = state.meta;
            });
            return meta;
        };
        Loader.prototype._resolveUri = function (uri) {
            if (typeof (uri) === "object")
                return uri;
            if (!this._resolver)
                throw "Can not resolve '" + uri + "'. No file resolver are defined in the store.";
            return this._resolver.resolve(uri);
        };
        Loader.prototype._resolveSchema = function (id) {
            var _this = this;
            var configs = this._configs;
            if (typeof (id) === "object") {
                configs = [id];
                id = configs[0].id;
            }
            var state = this._schemas.get(id);
            if (state)
                return state;
            Hyperstore.Utils.forEach(configs, function (cfg) {
                if (cfg.id === id) {
                    state = _this._parseSchema(cfg);
                }
            });
            return state || this._parseSchema(id);
        };
        Loader.prototype._parseSchema = function (config) {
            config = this._resolveUri(config);
            if (!config.id)
                throw new SchemaLoaderException("id is required for schema ", config);
            var state = this._schemas.get(config.id);
            if (state) {
                return state;
            }
            this._schemas.add(config.id, SchemaState.Pending);
            var parser = new SchemaParser(this);
            state = parser.parse(this.mergeOverride(config));
            this._schemas.add(state.id, state);
            return state;
        };
        Loader.prototype.mergeOverride = function (config) {
            var _this = this;
            if (!this._overrides)
                return config;
            Hyperstore.Utils.forEach(this._overrides, function (over) {
                over = _this._resolveUri(over);
                if (over.extends !== config.id)
                    return;
                delete over.extends;
                _this.mergeJson(config, over);
            });
            return config;
        };
        Loader.prototype.mergeJson = function (result, source) {
            if (!source)
                return result;
            for (var prop in source) {
                if (!source.hasOwnProperty(prop))
                    continue;
                var val = source[prop];
                if (typeof (val) === "object") {
                    var t = result[prop];
                    if (t)
                        this.mergeJson(t, val);
                    else
                        result[prop] = val;
                }
                else if (Array.isArray(val)) {
                    if (result[prop])
                        result[prop] = result[prop].concat(val);
                    else
                        result[prop] = val;
                }
                else
                    result[prop] = val;
            }
        };
        return Loader;
    })();
    Hyperstore.Loader = Loader;
    var SchemaLoaderException = (function () {
        function SchemaLoaderException(message, object) {
            this.message = message;
            this.object = object;
        }
        SchemaLoaderException.prototype.toString = function () {
            return this.message;
        };
        return SchemaLoaderException;
    })();
    Hyperstore.SchemaLoaderException = SchemaLoaderException;
    var SchemaParser = (function () {
        function SchemaParser(_loader) {
            this._loader = _loader;
            this._imports = new Hyperstore.HashTable();
        }
        SchemaParser.prototype.parse = function (schemaDefinition) {
            var _this = this;
            if (!schemaDefinition)
                return undefined;
            var id = schemaDefinition.id;
            if (schemaDefinition.extends) {
                var schema = this._loader.store.schemas.firstOrDefault(function (s) { return s.name === schemaDefinition.extends; });
                if (!schema)
                    throw "Unknown schema to extends " + schemaDefinition.extends;
            }
            this._state = new SchemaState(this._loader.store, id, schemaDefinition, schema, !!schema);
            this.parseImports(schemaDefinition);
            this.parseConstraints(schemaDefinition.constraints, function (ct) { return _this._state.constraints[ct.name] = ct; });
            this.parseTypes(schemaDefinition.types);
            this.pendings = [];
            for (var name in schemaDefinition) {
                if (name[0] !== "$" && name !== "constraints" && name !== "types" && name !== "id" && name !== "extends") {
                    var o = schemaDefinition[name];
                    if (o.source)
                        this.parseRelationship(o, name);
                    else
                        this.parseEntity(o, name);
                }
            }
            this.pendings.forEach(function (p) { return _this.createRelationship(p); });
            return this._state;
        };
        SchemaParser.prototype.parseEntity = function (o, name) {
            var base;
            if (o.extends) {
                base = this._resolveType(o.extends);
                if (!base)
                    throw new SchemaLoaderException("Unknown extended entity " + o.extends, this._state.config);
            }
            var entity = (this._state.extension ? this._state.schema.store.getSchemaEntity(this._state.schema.name + ":" + name, false) : null) || new Hyperstore.SchemaEntity(this._state.schema, name, base);
            this.parseConstraints(o.constraints, function (c) { return entity.addConstraint(c.message, c.condition, c.error, c.kind); });
            this.parseInterceptors(entity, o.interceptors);
            this._state.meta[name] = entity;
            if (o.properties) {
                for (var prop in o.properties) {
                    if (prop[0] !== "$" && o.properties.hasOwnProperty(prop))
                        this.parseProperty(prop, o.properties[prop], entity);
                }
            }
            for (var prop in o.references) {
                if (prop[0] === "$" || !o.references.hasOwnProperty(prop))
                    continue;
                var d = o.references[prop];
                this.pendings.push({
                    src: entity.id,
                    end: d.end,
                    kind: d.kind || "1->*",
                    name: d.name,
                    property: prop,
                    obj: d,
                    const: d.constraints
                });
            }
            this.extends(entity, o.members);
        };
        SchemaParser.prototype.parseRelationship = function (o, name) {
            var base;
            if (o.extends) {
                base = this._resolveType(o.extends);
                if (!base)
                    throw "Unknown extended relationship " + o.extends;
            }
            this.pendings.push({
                src: o.source,
                end: o.end,
                kind: o.kind,
                obj: o,
                base: base,
                name: name,
                const: o.constraints
            });
        };
        SchemaParser.prototype.createRelationship = function (def) {
            var src = this._state.schema.store.getSchemaElement(def.src);
            var end = this._resolveType(def.end);
            if (!end)
                throw new SchemaLoaderException("Unknown end reference " + def.end + " for relationship " + def.name, this._state.schema);
            var c = this.parseCardinality(def.kind);
            if (c.opposite) {
                var t = src;
                src = end;
                end = t;
            }
            var name = def.name || src.name + (c.embedded ? 'Has' : 'References') + end.name;
            var rel = this._state.schema.store.getSchemaRelationship(name, false);
            if (rel) {
                if (rel.cardinality !== c.type || rel.startSchemaId !== src.id || rel.endSchemaId !== end.id || rel.embedded !== c.embedded)
                    throw "Relationship mismatch with a previous definition for " + name;
                rel.baseElement = rel.baseElement || def.base;
            }
            else {
                rel = new Hyperstore.SchemaRelationship(this._state.schema, name, src.id, end.id, c.embedded || false, c.type, undefined, undefined, def.base);
                this._state.meta[name] = rel;
            }
            this.parseConstraints(def.const, function (c) { return rel.addConstraint(c.message, c.condition, c.error, c.type); });
            this.parseInterceptors(rel, def.interceptors);
            if (def.property) {
                rel[c.opposite ? "endProperty" : "startProperty"] = def.property;
            }
            if (def.properties) {
                for (var prop in def.properties) {
                    if (prop[0] !== "$" && def.properties.hasOwnProperty(prop))
                        this.parseProperty(prop, def.properties[prop], rel);
                }
            }
            if (def.references)
                throw "References in relationship is not supported yet.";
            if (!def.obj)
                return;
            this.extends(rel, def.obj.members);
        };
        SchemaParser.prototype.parseCardinality = function (c) {
            var re = /([1\*])(=|-|<)(-|=|>)([1\*])/;
            var m = re.exec(c);
            if (!m)
                throw "Invalid reference format. Must be [1|*]xx[1|*] with xx = ->, =>, <- or <= .";
            var op = m[2] === "<";
            var src = m[op ? 4 : 1];
            var end = m[op ? 1 : 4];
            var type = SchemaParser.cardinalities[src + end];
            return {
                opposite: op,
                embedded: m[op ? 3 : 2] === "=",
                type: type
            };
        };
        SchemaParser.prototype.parseProperty = function (name, definition, entity) {
            if (typeof (definition) === "function") {
                entity.defineProperty(name, "any", definition, 1 /* Calculated */);
                return;
            }
            if (typeof (definition) === "string") {
                var t = this._resolveType(definition, name);
                if (!t)
                    throw new SchemaLoaderException("Invalid type " + definition + " for property " + name, this._state.schema);
                entity.defineProperty(name, t);
                return;
            }
            if (typeof (definition) !== "object")
                throw new SchemaLoaderException("Invalid property definition " + name, this._state.schema);
            if (this._state.extension) {
                var tmpProp = entity.getProperty(name, false);
                if (tmpProp && definition.default)
                    tmpProp.defaultValue = definition.default;
            }
            t = tmpProp ? tmpProp.schemaProperty : this._resolveType(definition.type, name);
            if (!t) {
                throw new SchemaLoaderException("Unknown type " + definition.type, this._state.schema);
            }
            if (t.kind !== 2 /* ValueObject */ && t.kind !== 3 /* Primitive */) {
                throw new SchemaLoaderException("Invalid type '" + definition.type + "' Only value object or primitive is allowed for property " + name + ". Use reference instead.", this._state.schema);
            }
            t = Object.create(t);
            this.extends(t, definition, function (n) {
                return (n === "type" || n === "constraints" || n === "isKey" || n === "default") ? null : n;
            });
            var p = tmpProp || entity.defineProperty(name, t, definition.default);
            p.isKey = !!definition.isKey;
            this.parseConstraints(definition.constraints, function (c) { return p.addConstraint(c.message, c.condition, c.error, c.kind); });
            this.parseInterceptors(p, definition.interceptors);
        };
        SchemaParser.prototype._resolveConstraint = function (name) {
            if (!name)
                return undefined;
            var parts = name.split('.');
            if (parts.length == 1) {
                return this._state.constraints[parts[0]];
            }
            var state = this._imports.get(parts[0]);
            if (state) {
                return state.constraints[parts[1]];
            }
            return undefined;
        };
        SchemaParser.prototype._resolveType = function (name, propertyName) {
            if (!name)
                return undefined;
            var fullName;
            var parts = name.split('.');
            if (parts.length == 1) {
                fullName = this._state.id + Hyperstore.Store.IdSeparator + name;
            }
            else {
                var state = this._imports.get(parts[0]);
                if (!state) {
                    return undefined;
                }
                var n = parts[1];
                fullName = state.id + Hyperstore.Store.IdSeparator + n;
            }
            var valueObject = this._loader.store.getSchemaInfo(fullName, false);
            if (valueObject)
                return valueObject;
            valueObject = this._loader.store.getSchemaInfo(name, false);
            if (valueObject && valueObject.kind === 3 /* Primitive */) {
                valueObject = new Hyperstore.SchemaValueObject(this._state.schema, propertyName + "_" + valueObject.name + (++SchemaParser.typeSequence).toString(), valueObject);
            }
            return valueObject;
        };
        SchemaParser.prototype.parseTypes = function (types) {
            var _this = this;
            if (!types)
                return;
            for (var name in types) {
                if (!name || !types.hasOwnProperty(name))
                    continue;
                var val = types[name];
                var valueObject = new Hyperstore.SchemaValueObject(this._state.schema, name);
                this.extends(valueObject, val, function (p) {
                    if (p === "type") {
                        var s = _this._resolveType(val[p]);
                        if (!s)
                            throw new SchemaLoaderException("Unknown type " + val[p], val);
                        valueObject.parent = s;
                        return null;
                    }
                    else if (p === "constraints") {
                        _this.parseConstraints(val.constraints, function (c) { return valueObject.addConstraint(c.message, c.condition, c.error, c.kind); });
                        return null;
                    }
                    return p;
                });
            }
        };
        SchemaParser.prototype.extends = function (v, o, callback) {
            if (!o)
                return;
            for (var p in o) {
                if (o.hasOwnProperty(p)) {
                    if (callback && !callback(p))
                        continue;
                    v[p] = o[p];
                }
            }
        };
        SchemaParser.prototype.parseInterceptors = function (schema, interceptors) {
            if (!interceptors)
                return;
            Hyperstore.Utils.forEach(interceptors, function (i) { return schema.addInterceptor(i); });
        };
        SchemaParser.prototype.parseConstraints = function (constraints, callback) {
            if (!constraints)
                return;
            var defaultValues = constraints.$default || { kind: "check", error: false };
            defaultValues.kind = defaultValues.kind === "check" ? 0 /* Check */ : 1 /* Validate */;
            for (var name in constraints) {
                if (!name || !constraints.hasOwnProperty(name))
                    continue;
                var def = constraints[name];
                var constraint;
                if (typeof (def) === "function") {
                    callback({
                        message: name,
                        kind: defaultValues.kind,
                        error: defaultValues.error,
                        condition: def
                    });
                    continue;
                }
                if (name[0] === '$') {
                    if (name !== "$ref")
                        continue;
                    var refs = Array.isArray(def) ? def : [def];
                    for (var i = 0; i < refs.length; i++) {
                        var ct = this._resolveConstraint(refs[i]);
                        if (!ct)
                            throw new SchemaLoaderException("Unknown constraint " + refs[i], constraints);
                        callback(ct);
                    }
                    continue;
                }
                if (typeof (def) !== "object")
                    throw new SchemaLoaderException("Invalid constraint definition " + name, constraints);
                var ct2 = {
                    name: name,
                    message: def.message,
                    kind: def.check ? 0 /* Check */ : 1 /* Validate */,
                    error: def.error || defaultValues.error,
                    condition: def.validate || def.check
                };
                if (!ct2.message)
                    throw new SchemaLoaderException("Message is required for constraint " + name, constraints);
                if (!ct2.condition || typeof (ct2.condition) !== "function")
                    throw new SchemaLoaderException("A check or validate function is required for constraint " + name, constraints);
                callback(ct2);
            }
        };
        SchemaParser.prototype.parseImports = function (schema) {
            var imports = schema.$import;
            if (!imports)
                return;
            for (var alias in imports) {
                if (!imports.hasOwnProperty(alias))
                    continue;
                var id = imports[alias];
                var state = this._loader._resolveSchema(id);
                if (!state)
                    throw new SchemaLoaderException("Unknown schema import " + id, schema);
                if (state === SchemaState.Pending)
                    throw new SchemaLoaderException("Circular reference " + id, schema);
                this._imports.add(alias, state);
            }
        };
        SchemaParser.typeSequence = 0;
        SchemaParser.cardinalities = {
            "11": 0 /* OneToOne */,
            "1*": 1 /* OneToMany */,
            "*1": 2 /* ManyToOne */,
            "**": 3 /* ManyToMany */
        };
        return SchemaParser;
    })();
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    (function (SessionMode) {
        SessionMode[SessionMode["Normal"] = 0] = "Normal";
        SessionMode[SessionMode["Loading"] = 4] = "Loading";
        SessionMode[SessionMode["Undo"] = 8] = "Undo";
        SessionMode[SessionMode["Redo"] = 16] = "Redo";
        SessionMode[SessionMode["UndoOrRedo"] = 24] = "UndoOrRedo";
        SessionMode[SessionMode["Serializing"] = 32] = "Serializing";
        SessionMode[SessionMode["SilentMode"] = 64] = "SilentMode";
        SessionMode[SessionMode["AbortOnWarning"] = 128] = "AbortOnWarning";
        SessionMode[SessionMode["Rollback"] = 2048] = "Rollback";
    })(Hyperstore.SessionMode || (Hyperstore.SessionMode = {}));
    var SessionMode = Hyperstore.SessionMode;
    var Session = (function () {
        function Session(store, config) {
            this.store = store;
            this.config = config;
            this.events = new Array();
            this.aborted = false;
            this._depth = 0;
            this.closed = false;
            this.originStoreId = store.storeId;
            this.mode = 0 /* Normal */;
            this.trackingData = new Hyperstore.TrackingData();
            this.result = new Hyperstore.SessionResult(this);
            this.result.maxVersionNumber = 0;
            if (config && config.origin) {
                this.originStoreId = config.origin;
            }
            if (config && config.sessionId) {
                this.sessionId = config.sessionId;
            }
            else {
                Session._sequence++;
                this.sessionId = Session._sequence;
            }
            if (config && config.mode) {
                this.mode = config.mode;
            }
            if (store.hasDomainExtensions)
                this._activeDomains = store.getActiveDomains();
            this._store = store;
            this.__nextLevel();
        }
        Session.prototype.getDomain = function (domain, activeOnly) {
            if (activeOnly === void 0) { activeOnly = false; }
            return this._activeDomains ? this._activeDomains.get(domain) : activeOnly ? undefined : this._store.getDomain(domain);
        };
        Session.prototype.__nextLevel = function () {
            if (this.mode & 2048 /* Rollback */)
                return;
            if (this.closed)
                throw "Can not reused a closed session";
            this._depth++;
            this._committed = false;
        };
        Session.prototype.acceptChanges = function () {
            if (this.mode & 2048 /* Rollback */)
                return;
            if (this.closed)
                throw "Can not reused a closed session";
            this._committed = true;
        };
        Session.prototype.close = function () {
            var _this = this;
            if (this.closed) {
                return this.result;
            }
            if (!this._committed) {
                this.aborted = true;
            }
            this._depth--;
            if (this._depth > 0) {
                this._committed = false;
                return undefined;
            }
            this.closed = true;
            this.result.aborted = this.aborted;
            if (!this.aborted && (this.mode & (4 /* Loading */ | 24 /* UndoOrRedo */)) === 0) {
                var elements = this.trackingData.__prepareTrackedElements(this.store);
                this.result.involvedElements = elements;
                if (!this.aborted) {
                    this.result.__addMessages(this.executeConstraints(elements));
                }
            }
            var hasErrors = this.result.hasErrors || ((this.mode & 128 /* AbortOnWarning */) && this.result.hasWarnings);
            this.aborted = this.aborted || hasErrors;
            if (this.aborted) {
                this.mode = this.mode | 2048 /* Rollback */;
                var d = this.store.eventBus.defaultEventDispatcher;
                this.events.reverse().forEach(function (e) {
                    if (e.getReverseEvent)
                        d.handleEvent(e.getReverseEvent(_this.sessionId));
                });
            }
            Session.current = undefined;
            var self = this;
            if (!this.aborted) {
                this.store.domains.forEach(function (d) {
                    d.events.__notifySessionCompleted(self);
                });
            }
            this.store.__sendSessionCompletedEvent(self);
            if (hasErrors && !(this.mode & 64 /* SilentMode */)) {
                var txt = "Session failed : ";
                for (var i in this.result.messages) {
                    if (!this.result.messages.hasOwnProperty(i))
                        continue;
                    var msg = this.result.messages[i];
                    if (msg.messageType === 1 /* Error */)
                        txt = txt + msg.message + "\r\n";
                }
                throw { message: txt, result: this.result };
            }
            return this.result;
        };
        Session.prototype.executeConstraints = function (elements) {
            var constraintsManager = Hyperstore.Utils.groupBy(elements, function (e) { return e.getInfo().schemaElement.schema.constraints; });
            var messages = [];
            Hyperstore.Utils.forEach(constraintsManager, function (m) {
                var manager = m.key;
                messages = messages.concat(manager.__checkElements(m.value));
            });
            return messages;
        };
        Session.prototype.addEvent = function (evt) {
            if (this.mode & 2048 /* Rollback */)
                return;
            if (this.closed)
                throw "Can not reused a closed session";
            evt.correlationId = this.sessionId;
            this.events.push(evt);
            this.trackingData.__onEvent(evt);
            if (evt.version > this.result.maxVersionNumber) {
                this.result.maxVersionNumber = evt.version;
            }
        };
        Session._sequence = 0;
        return Session;
    })();
    Hyperstore.Session = Session;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var SessionResult = (function () {
        function SessionResult(_session) {
            this._session = _session;
            this.messages = [];
            this.hasErrors = false;
            this.hasWarnings = false;
            this._promises = [];
        }
        SessionResult.prototype.addPromise = function (q) {
            this._promises.push(q);
        };
        SessionResult.prototype.registerPromise = function (obj, method, callback) {
            var args = [];
            for (var _i = 3; _i < arguments.length; _i++) {
                args[_i - 3] = arguments[_i];
            }
            var p = Q.defer();
            var func = obj[method];
            var self = this;
            var fargs = args;
            for (var i = args.length; i < func.length - 1; i++)
                args.push(undefined);
            func.apply(obj, fargs.concat(function (err, r) {
                if (err) {
                    p.reject(err);
                    return;
                }
                p.resolve(r);
                callback(err, r, self._session);
            }));
            this._promises.push(p.promise);
        };
        SessionResult.prototype.async = function () {
            if (this._promises.length) {
                var p = Q.allSettled(this._promises);
                this._promises = [];
                return p;
            }
            var q = Q.defer();
            q.resolve(false);
            return q.promise;
        };
        Object.defineProperty(SessionResult.prototype, "hasErrorsOrWarnings", {
            get: function () {
                return this.hasErrors || this.hasWarnings;
            },
            enumerable: true,
            configurable: true
        });
        SessionResult.prototype.__addMessages = function (messages) {
            for (var k in messages) {
                var diag = messages[k];
                this.log(diag);
            }
        };
        SessionResult.prototype.log = function (message) {
            if (message.messageType === 1 /* Error */) {
                this.hasErrors = true;
            }
            if (message.messageType === 0 /* Warning */) {
                this.hasWarnings = true;
            }
            this.messages.push(message);
        };
        SessionResult.prototype.logError = function (message) {
            var diag = new Hyperstore.DiagnosticMessage(1 /* Error */, message);
            this.log(diag);
        };
        return SessionResult;
    })();
    Hyperstore.SessionResult = SessionResult;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    (function (TrackingState) {
        TrackingState[TrackingState["Added"] = 0] = "Added";
        TrackingState[TrackingState["Removed"] = 1] = "Removed";
        TrackingState[TrackingState["Updated"] = 2] = "Updated";
        TrackingState[TrackingState["Unknown"] = 3] = "Unknown";
    })(Hyperstore.TrackingState || (Hyperstore.TrackingState = {}));
    var TrackingState = Hyperstore.TrackingState;
    var TrackingData = (function () {
        function TrackingData() {
            this._trackings = {};
        }
        Object.defineProperty(TrackingData.prototype, "involvedTrackedElements", {
            get: function () {
                return Hyperstore.Utils.select(this._trackings, function (t) { return t; });
            },
            enumerable: true,
            configurable: true
        });
        TrackingData.prototype.__prepareTrackedElements = function (store) {
            var _this = this;
            var list = {};
            Hyperstore.Utils.forEach(this.involvedTrackedElements, function (t) {
                if (list[t.id]) {
                    return;
                }
                if (t.state !== 1 /* Removed */) {
                    var mel = store.get(t.id);
                    if (mel) {
                        list[t.id] = mel;
                    }
                }
                if (!t.startId) {
                    return;
                }
                if (!list[t.startId] && _this.getTrackedElementState(t.startId) !== 1 /* Removed */) {
                    var mel = store.get(t.startId);
                    if (mel) {
                        list[t.startId] = mel;
                        var info = _this._trackings[t.startId];
                        if (!info) {
                            _this._trackings[t.startId] = {
                                domain: t.domain,
                                state: 3 /* Unknown */,
                                id: t.startId,
                                schemaId: t.startSchemaId
                            };
                        }
                    }
                }
                if (!list[t.endId] && _this.getTrackedElementState(t.endId) !== 1 /* Removed */) {
                    var mel = store.get(t.endId);
                    if (mel) {
                        list[t.endId] = mel;
                        var info = _this._trackings[t.endId];
                        if (!info) {
                            _this._trackings[t.endId] = {
                                domain: t.domain,
                                state: 3 /* Unknown */,
                                id: t.endId,
                                schemaId: t.endSchemaId
                            };
                        }
                    }
                }
            });
            return Hyperstore.Utils.select(list, function (kv) { return kv; });
        };
        TrackingData.prototype.getTrackedElementsByState = function (state) {
            return Hyperstore.Utils.select(this._trackings, function (t) { return function (t) { return t.state === state ? t : undefined; }; });
        };
        TrackingData.prototype.getTrackedElementState = function (id) {
            var info = this._trackings[id];
            if (!info) {
                return 3 /* Unknown */;
            }
            return info.state;
        };
        TrackingData.prototype.__onEvent = function (evt) {
            switch (evt.eventName) {
                case Hyperstore.EventManager.AddEntityEvent:
                    this._trackings[evt.id] = {
                        domain: evt.domain,
                        state: 0 /* Added */,
                        id: evt.id,
                        schemaId: evt.schemaId,
                        version: evt.version
                    };
                    break;
                case Hyperstore.EventManager.RemoveEntityEvent:
                    var info = this._trackings[evt.id];
                    if (info) {
                        delete this._trackings[evt.id];
                    }
                    else {
                        this._trackings[evt.id] = {
                            domain: evt.domain,
                            state: 1 /* Removed */,
                            id: evt.id,
                            schemaId: evt.schemaId,
                            version: evt.version
                        };
                    }
                    break;
                case Hyperstore.EventManager.AddRelationshipEvent:
                    this._trackings[evt.id] = {
                        domain: evt.domain,
                        state: 0 /* Added */,
                        id: evt.id,
                        schemaId: evt.schemaId,
                        version: evt.version,
                        startId: evt.startId,
                        startSchemaId: evt.startSchemaId,
                        endId: evt.endId,
                        endSchemaId: evt.endSchemaId
                    };
                    break;
                case Hyperstore.EventManager.RemoveRelationshipEvent:
                    var info = this._trackings[evt.id];
                    if (info) {
                        delete this._trackings[evt.id];
                    }
                    else {
                        this._trackings[evt.id] = {
                            domain: evt.domain,
                            state: 1 /* Removed */,
                            id: evt.id,
                            schemaId: evt.schemaId,
                            version: evt.version,
                            startId: evt.startId,
                            startSchemaId: evt.startSchemaId,
                            endId: evt.endId,
                            endSchemaId: evt.endSchemaId
                        };
                    }
                    break;
                case Hyperstore.EventManager.ChangePropertyValueEvent:
                    var info = this._trackings[evt.id];
                    if (!info) {
                        info = { domain: evt.domain, state: 2 /* Updated */, id: evt.id, schemaId: evt.schemaId };
                        this._trackings[evt.id] = info;
                    }
                    if (!info.properties) {
                        info.properties = {};
                    }
                    var pv = new Hyperstore.PropertyValue(evt.value, evt.oldValue, evt.version);
                    info.properties[evt.propertyName] = pv;
                    if (evt.version > info.version) {
                        info.version = evt.version;
                    }
                    break;
            }
        };
        return TrackingData;
    })();
    Hyperstore.TrackingData = TrackingData;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var AbstractEvent = (function () {
        function AbstractEvent(eventName, domain, version, correlationId) {
            this.eventName = eventName;
            this.domain = domain;
            this.version = version;
            this.correlationId = correlationId;
            this.TL = true;
        }
        AbstractEvent.prototype.toString = function () {
            return JSON.stringify(this);
        };
        return AbstractEvent;
    })();
    Hyperstore.AbstractEvent = AbstractEvent;
    var AddEntityEvent = (function (_super) {
        __extends(AddEntityEvent, _super);
        function AddEntityEvent(domain, id, schemaId, version, correlationId) {
            _super.call(this, Hyperstore.EventManager.AddEntityEvent, domain, version, correlationId);
            this.id = id;
            this.schemaId = schemaId;
        }
        AddEntityEvent.prototype.getReverseEvent = function (correlationId) {
            return new RemoveEntityEvent(this.domain, this.id, this.schemaId, this.version, correlationId);
        };
        return AddEntityEvent;
    })(AbstractEvent);
    Hyperstore.AddEntityEvent = AddEntityEvent;
    var RemoveEntityEvent = (function (_super) {
        __extends(RemoveEntityEvent, _super);
        function RemoveEntityEvent(domain, id, schemaId, version, correlationId) {
            _super.call(this, Hyperstore.EventManager.RemoveEntityEvent, domain, version, correlationId);
            this.id = id;
            this.schemaId = schemaId;
        }
        RemoveEntityEvent.prototype.getReverseEvent = function (correlationId) {
            return new AddEntityEvent(this.domain, this.id, this.schemaId, this.version, correlationId);
        };
        return RemoveEntityEvent;
    })(AbstractEvent);
    Hyperstore.RemoveEntityEvent = RemoveEntityEvent;
    var AddRelationshipEvent = (function (_super) {
        __extends(AddRelationshipEvent, _super);
        function AddRelationshipEvent(domain, id, schemaId, startId, startSchemaId, endId, endSchemaId, version, correlationId) {
            _super.call(this, Hyperstore.EventManager.AddRelationshipEvent, domain, version, correlationId);
            this.id = id;
            this.schemaId = schemaId;
            this.startId = startId;
            this.startSchemaId = startSchemaId;
            this.endId = endId;
            this.endSchemaId = endSchemaId;
        }
        AddRelationshipEvent.prototype.getReverseEvent = function (correlationId) {
            return new RemoveRelationshipEvent(this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId, this.version, correlationId);
        };
        return AddRelationshipEvent;
    })(AbstractEvent);
    Hyperstore.AddRelationshipEvent = AddRelationshipEvent;
    var RemoveRelationshipEvent = (function (_super) {
        __extends(RemoveRelationshipEvent, _super);
        function RemoveRelationshipEvent(domain, id, schemaId, startId, startSchemaId, endId, endSchemaId, version, correlationId) {
            _super.call(this, Hyperstore.EventManager.RemoveRelationshipEvent, domain, version, correlationId);
            this.id = id;
            this.schemaId = schemaId;
            this.startId = startId;
            this.startSchemaId = startSchemaId;
            this.endId = endId;
            this.endSchemaId = endSchemaId;
        }
        RemoveRelationshipEvent.prototype.getReverseEvent = function (correlationId) {
            return new AddRelationshipEvent(this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId, this.version, correlationId);
        };
        return RemoveRelationshipEvent;
    })(AbstractEvent);
    Hyperstore.RemoveRelationshipEvent = RemoveRelationshipEvent;
    var ChangePropertyValueEvent = (function (_super) {
        __extends(ChangePropertyValueEvent, _super);
        function ChangePropertyValueEvent(domain, id, schemaId, propertyName, value, oldValue, version, correlationId) {
            _super.call(this, Hyperstore.EventManager.ChangePropertyValueEvent, domain, version, correlationId);
            this.id = id;
            this.schemaId = schemaId;
            this.propertyName = propertyName;
            this.value = value;
            this.oldValue = oldValue;
        }
        ChangePropertyValueEvent.prototype.getReverseEvent = function (correlationId) {
            return new ChangePropertyValueEvent(this.domain, this.id, this.schemaId, this.propertyName, this.oldValue, this.value, this.version, correlationId);
        };
        return ChangePropertyValueEvent;
    })(AbstractEvent);
    Hyperstore.ChangePropertyValueEvent = ChangePropertyValueEvent;
    var RemovePropertyEvent = (function (_super) {
        __extends(RemovePropertyEvent, _super);
        function RemovePropertyEvent(domain, id, schemaId, propertyName, value, version, correlationId) {
            _super.call(this, Hyperstore.EventManager.RemovePropertyEvent, domain, version, correlationId);
            this.id = id;
            this.schemaId = schemaId;
            this.propertyName = propertyName;
            this.value = value;
            this.TL = false;
        }
        RemovePropertyEvent.prototype.getReverseEvent = function (correlationId) {
            return new ChangePropertyValueEvent(this.domain, this.id, this.schemaId, this.propertyName, this.value, undefined, this.version, correlationId);
        };
        return RemovePropertyEvent;
    })(AbstractEvent);
    Hyperstore.RemovePropertyEvent = RemovePropertyEvent;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var EventDispatcher = (function () {
        function EventDispatcher(store) {
            this.store = store;
            this._handlers = {};
            this.registerHandler({
                eventName: Hyperstore.EventManager.AddEntityEvent,
                execute: function (d, evt) {
                    var schema = d.store.getSchemaEntity(evt.schemaId);
                    d.create(schema, evt.id, evt.version);
                }
            });
            this.registerHandler({
                eventName: Hyperstore.EventManager.RemoveEntityEvent,
                execute: function (d, evt) {
                    var mel = d.get(evt.id);
                    if (!mel) {
                        throw "Invalid element";
                    }
                    d.remove(evt.id, evt.version);
                }
            });
            this.registerHandler({
                eventName: Hyperstore.EventManager.AddRelationshipEvent,
                execute: function (d, evt) {
                    var schema = d.store.getSchemaRelationship(evt.schemaId);
                    var start = d.get(evt.startId);
                    if (!start) {
                        throw "Invalid source element for relationship " + evt.id;
                    }
                    d.createRelationship(schema, start, evt.endId, evt.endSchemaId, evt.id, evt.version);
                }
            });
            this.registerHandler({
                eventName: Hyperstore.EventManager.RemoveRelationshipEvent,
                execute: function (d, evt) {
                    var mel = d.get(evt.id);
                    if (!mel) {
                        throw "Invalid element";
                    }
                    d.remove(evt.id, evt.version);
                }
            });
            this.registerHandler({
                eventName: Hyperstore.EventManager.ChangePropertyValueEvent,
                execute: function (d, evt) {
                    var schema = d.store.getSchemaEntity(evt.schemaId);
                    var property = schema.getProperty(evt.propertyName, true);
                    if (property) {
                        d.setPropertyValue(evt.id, property, evt.value, evt.version);
                    }
                }
            });
        }
        EventDispatcher.prototype.registerHandler = function (handler, domain) {
            var key = handler.eventName || "*";
            var handlers = this._handlers[key];
            if (!handlers) {
                handlers = [];
                this._handlers[key] = handlers;
            }
            handlers.push({ domain: domain, handler: handler });
        };
        EventDispatcher.prototype.handleEvent = function (event) {
            if (!Hyperstore.Session.current) {
                throw "Session required.";
            }
            var key = event.eventName;
            var flag = this.executeHandlers(key, event);
            if (this.executeHandlers("*", event)) {
                flag = true;
            }
            if (!flag && event.correlationId !== Hyperstore.Session.current.sessionId && !Hyperstore.Session.current.closed) {
                Hyperstore.Session.current.addEvent(event);
            }
        };
        EventDispatcher.prototype._getDomain = function (domainName) {
            return Hyperstore.Session.current && this.store.hasDomainExtensions ? Hyperstore.Session.current.getDomain(domainName) : this.store.getDomain(domainName);
        };
        EventDispatcher.prototype._getHandlers = function (key) {
            return this._handlers[key];
        };
        EventDispatcher.prototype.executeHandlers = function (key, event) {
            var handlers = this._getHandlers(key);
            if (!handlers) {
                return false;
            }
            var domain = this._getDomain(event.domain);
            if (!domain) {
                return false;
            }
            for (var i = 0; i < handlers.length; i++) {
                var handlerInfo = handlers[i];
                if (!handlerInfo.domain || event.domain === handlerInfo.domain) {
                    handlerInfo.handler.execute(domain, event);
                }
            }
            return handlers.length > 0;
        };
        return EventDispatcher;
    })();
    Hyperstore.EventDispatcher = EventDispatcher;
    var DomainEventDispatcher = (function (_super) {
        __extends(DomainEventDispatcher, _super);
        function DomainEventDispatcher(domain, _dispatcherToUse) {
            _super.call(this, domain.store);
            this.domain = domain;
            this._dispatcherToUse = _dispatcherToUse;
        }
        DomainEventDispatcher.prototype._getHandler = function (key) {
            return this._dispatcherToUse && this._dispatcherToUse._getHandlers(key) || _super.prototype._getHandlers.call(this, key);
        };
        DomainEventDispatcher.prototype._getDomain = function (domainName) {
            return domainName === this.domain.name ? this.domain : null;
        };
        return DomainEventDispatcher;
    })(EventDispatcher);
    Hyperstore.DomainEventDispatcher = DomainEventDispatcher;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var EventManager = (function () {
        function EventManager(domain) {
            this.domain = domain;
        }
        EventManager.prototype.dispose = function () {
            this._subscriptions = undefined;
        };
        EventManager.createEvent = function (eventName) {
            switch (eventName) {
                case EventManager.AddEntityEvent:
                    return Object.create(Hyperstore.AddEntityEvent);
                case EventManager.RemoveEntityEvent:
                    return Object.create(Hyperstore.RemoveEntityEvent);
                case EventManager.AddRelationshipEvent:
                    return Object.create(Hyperstore.AddRelationshipEvent);
                case EventManager.ChangePropertyValueEvent:
                    return Object.create(Hyperstore.ChangePropertyValueEvent);
                case EventManager.RemoveRelationshipEvent:
                    return Object.create(Hyperstore.RemoveRelationshipEvent);
                case EventManager.RemovePropertyEvent:
                    return Object.create(Hyperstore.RemovePropertyEvent);
                default:
                    return undefined;
            }
        };
        EventManager.prototype.onEntityAdded = function (callback) {
            return this.on(EventManager.AddEntityEvent, callback);
        };
        EventManager.prototype.onEntityRemoved = function (callback) {
            return this.on(EventManager.RemoveEntityEvent, callback);
        };
        EventManager.prototype.onRelationshipAdded = function (callback) {
            return this.on(EventManager.AddRelationshipEvent, callback);
        };
        EventManager.prototype.onRelationshipRemoved = function (callback) {
            return this.on(EventManager.RemoveRelationshipEvent, callback);
        };
        EventManager.prototype.onPropertyChanged = function (callback) {
            return this.on(EventManager.ChangePropertyValueEvent, callback);
        };
        EventManager.prototype.onSessionCompleted = function (callback) {
            return this.on(EventManager.SessionCompleted, callback);
        };
        EventManager.prototype.on = function (eventName, callback) {
            if (!eventName || !callback)
                return;
            if (!this._subscriptions)
                this._subscriptions = {};
            var list = this._subscriptions[eventName];
            if (!list)
                this._subscriptions[eventName] = list = [];
            var ix = list.length;
            list.push({ ix: ix, fn: callback });
            return { e: eventName, ix: ix };
        };
        EventManager.prototype.remove = function (cookie) {
            if (!cookie || !cookie.ix)
                return this;
            var list = this._subscriptions[cookie.e];
            if (!list)
                return this;
            var pos = Hyperstore.Utils.indexOf(this._subscriptions, function (s) { return s.ix === cookie; });
            if (pos >= 0) {
                list.splice(cookie.ix, 1);
                if (list.length === 0)
                    delete this._subscriptions[cookie.e];
            }
            return this;
        };
        EventManager.prototype.__notifySessionCompleted = function (session) {
            var _this = this;
            if (!this._subscriptions)
                return;
            var si = {
                aborted: session.aborted,
                mode: session.mode,
                sessionId: session.sessionId,
                events: session.events.filter(function (e) { return e.domain === _this.domain; })
            };
            for (var i = 0; i < si.events.length; i++) {
                var evt = si.events[i];
                var list = this._subscriptions[evt.eventName];
                if (!list)
                    continue;
                Hyperstore.Utils.forEach(list, function (s) { return s.fn(si, evt); });
            }
            var list = this._subscriptions[EventManager.SessionCompleted];
            if (!list)
                return;
            Hyperstore.Utils.forEach(list, function (s) { return s.fn(si); });
        };
        EventManager.AddEntityEvent = "addEntity";
        EventManager.RemoveEntityEvent = "removeEntity";
        EventManager.AddRelationshipEvent = "addRelationship";
        EventManager.ChangePropertyValueEvent = "change";
        EventManager.RemoveRelationshipEvent = "removeRelationship";
        EventManager.RemovePropertyEvent = "removeProperty";
        EventManager.SessionCompleted = "sessionCompleted";
        EventManager.OnErrors = "onErrors";
        return EventManager;
    })();
    Hyperstore.EventManager = EventManager;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var PropertyValue = (function () {
        function PropertyValue(value, oldValue, version) {
            this.value = value;
            this.oldValue = oldValue;
            this.version = version;
        }
        return PropertyValue;
    })();
    Hyperstore.PropertyValue = PropertyValue;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var DomainModel = (function () {
        function DomainModel(store, name, extension) {
            this.store = store;
            this.name = name;
            this.extension = extension;
            this.name = this.name.toLowerCase();
            this.extension = extension;
            this._graph = new Hypergraph(this);
            store.__addDomain(this);
            this.events = new Hyperstore.EventManager(this.name);
            this._cache = {};
            this._adapters = [];
        }
        DomainModel.prototype.dispose = function () {
            Hyperstore.Utils.forEach(this._adapters, function (a) { return a.dispose(); });
            this._graph.dispose();
            this._graph = undefined;
            this.events.dispose();
            this.events = undefined;
            this._cache = undefined;
            this.eventDispatcher = undefined;
        };
        DomainModel.prototype.newScope = function (extensionName, data) {
            var scope = new DomainModelScope(this, extensionName);
            if (data) {
                for (var name in data) {
                    if (!data.hasOwnProperty(name))
                        continue;
                    var root = this.store.getSchemaElement(name);
                    var list = scope.loadFromJson(data[name], root);
                    break;
                }
            }
            return scope;
        };
        DomainModel.prototype.getGraph = function () {
            return this._graph;
        };
        DomainModel.prototype.validate = function (schemaElement) {
            var groups = new Hyperstore.HashTable();
            Hyperstore.Utils.forEach(this.getElements(schemaElement), function (m) {
                var sch = m.getInfo().schemaElement;
                var g = groups.get(sch.schema.name);
                if (!g) {
                    g = { schema: sch.schema, elems: [] };
                    groups.add(sch.schema.name, g);
                }
                g.elems.push(m);
            });
            var diags = [];
            Hyperstore.Utils.forEach(groups, function (item) {
                diags = diags.concat(item.schema.constraints.validate(item.elems));
            });
            return diags;
        };
        DomainModel.prototype.createId = function (id) {
            id = id || (DomainModel._seq++).toString();
            return id.indexOf(Hyperstore.Store.IdSeparator) < 0 ? this.name + Hyperstore.Store.IdSeparator + (id || Hyperstore.Utils.newGuid()) : id;
        };
        DomainModel.prototype.addAdapter = function (adapter) {
            var self = this;
            adapter.init(this);
            this._adapters.push(adapter);
        };
        DomainModel.prototype.findSchemaId = function (schemas, id) {
            if (schemas) {
                for (var k in schemas) {
                    var schema = schemas[k];
                    for (var ke in schema.elements) {
                        var e = schema.elements[ke];
                        if (e.id === id) {
                            var schemaId;
                            if (schema.name == null) {
                                schemaId = e.name;
                            }
                            else {
                                schemaId = schema.name + Hyperstore.Store.IdSeparator + e.name;
                            }
                            return schemaId;
                        }
                    }
                }
            }
            return id;
        };
        DomainModel.prototype.loadFromJson = function (def, rootSchema) {
            var _this = this;
            if (!def) {
                return;
            }
            if (typeof (def) === "string") {
                def = JSON.parse(def);
            }
            if (def.mode && def.mode === "HY") {
                this.store.runInSession(function () { return _this.loadFromHyperstoreJson(def); });
                return;
            }
            if (!rootSchema) {
                throw "rootSchema is required";
            }
            var refs = {};
            if (Hyperstore.Utils.isArray(def)) {
                var list = [];
                this.store.runInSession(function () {
                    Hyperstore.Utils.forEach(def, function (e) {
                        var result = _this.__parseJson(e, rootSchema, refs);
                        if (result) {
                            list.push(result.elem);
                            result.load();
                        }
                    });
                }, 4 /* Loading */);
                return list;
            }
            else {
                var r = [];
                this.store.runInSession(function () {
                    var result = _this.__parseJson(def, rootSchema, refs);
                    if (result) {
                        r.push(result.elem);
                        result.load();
                    }
                }, 4 /* Loading */);
                return r;
            }
        };
        DomainModel.prototype.__parseJson = function (obj, rootSchema, refs, parent) {
            var schema = this.introspectSchema(rootSchema, obj);
            if (!schema)
                throw "Ambiguous schema finding for " + rootSchema.name + " (Use checkMarkerJson) on " + obj;
            if (schema.loadFromJson) {
                var mel = schema.loadFromJson(this, obj, parent);
                if (mel)
                    return {
                        elem: mel,
                        load: function () {
                        }
                    };
            }
            var id = obj.$id;
            if (!id && schema.getKeyValueFromJson) {
                id = schema.getKeyValueFromJson(obj, parent);
            }
            mel = this.extension && this.get(id) || this.create(schema, id);
            return { elem: mel, load: function () {
                mel.loadFromJson(obj, refs);
            } };
        };
        DomainModel.prototype.introspectSchema = function (schema, json) {
            if (typeof (schema) == "string")
                schema = this.store.getSchemaEntity(schema);
            if (schema.subElements.length === 0)
                return schema;
            return this.recursiveIntrospect(schema, json);
        };
        DomainModel.prototype.recursiveIntrospect = function (schema, json) {
            for (var i = 0; i < schema.subElements.length; i++) {
                var subSchema = this.recursiveIntrospect(schema.subElements[i], json);
                if (subSchema)
                    return subSchema;
            }
            if (schema.checkJsonMarker) {
                return schema.checkJsonMarker(json) ? schema : undefined;
            }
            for (var p in json) {
                if (json.hasOwnProperty(p) && !schema.getProperty(p, true))
                    return undefined;
            }
            return schema;
        };
        DomainModel.prototype.loadFromHyperstoreJson = function (def) {
            var list = [];
            var session = this.store.beginSession(4 /* Loading */);
            try {
                for (var k = 0; k < def.entities.length; k++) {
                    var entity = def.entities[k];
                    var entityId = this.createId(entity["id"]);
                    if (entity.state && entity.state === "deleted") {
                        this.remove(entityId, entity.v);
                        continue;
                    }
                    var elem;
                    var schemaId = this.findSchemaId(def.schemas, entity["schema"]);
                    var schema = this.store.getSchemaElement(schemaId);
                    if (!this.elementExists(entityId)) {
                        list.push(elem = this.create(schema, entityId));
                    }
                    if (entity.properties) {
                        for (var kprop in entity.properties) {
                            var prop = entity.properties[kprop];
                            var propDef = schema.getProperty(prop.name, true);
                            if (propDef) {
                                var v = prop.value;
                                this.setPropertyValue(entityId, propDef, v);
                            }
                        }
                    }
                }
                if (def.relationships) {
                    for (var k = 0; k < def.relationships.length; k++) {
                        var relationship = def.relationships[k];
                        var entityId = this.createId(relationship["id"]);
                        if (relationship.state && relationship.state === "deleted") {
                            this.remove(entityId, relationship.v);
                            continue;
                        }
                        var schemaId = this.findSchemaId(def.schemas, relationship["schema"]);
                        var schema = this.store.getSchemaElement(schemaId);
                        if (!this.elementExists(entityId)) {
                            var start = this.get(this.createId(relationship.startId));
                            this.createRelationship(schema, start, this.createId(relationship.endId), this.findSchemaId(def.schemas, relationship.endSchemaId), entityId);
                        }
                        if (relationship.properties) {
                            for (var kprop in relationship.properties) {
                                var prop = relationship.properties[kprop];
                                var propDef = schema.getProperty(prop.name, true);
                                if (propDef) {
                                    var v = prop.value;
                                    this.setPropertyValue(entityId, propDef, v);
                                }
                            }
                        }
                    }
                }
                session.acceptChanges();
            }
            finally {
                session.close();
            }
            return list;
        };
        DomainModel.prototype.getRelationships = function (schemaElement, start, end) {
            var _this = this;
            var currentSchema = schemaElement;
            var tmpSchema = currentSchema;
            if (start) {
                var metadata = start.getInfo();
                var edges = this._graph.getEdges(metadata.id, 2 /* Outgoing */);
                if (edges) {
                    return edges.map(function (info) {
                        if (end && end.getInfo().id !== info.endId) {
                            return null;
                        }
                        if (!tmpSchema || info.schemaId !== tmpSchema.id) {
                            tmpSchema = _this.store.getSchemaElement(info.schemaId);
                        }
                        if (schemaElement && !tmpSchema.isA(schemaElement.id)) {
                            return null;
                        }
                        return _this.getFromCache(tmpSchema, metadata.id, metadata.schemaElement.id, info.endId, info.endSchemaId, info.id);
                    });
                }
            }
            else if (end) {
                var metadata = end.getInfo();
                var edges = this._graph.getEdges(metadata.id, 1 /* Incoming */);
                if (edges) {
                    return edges.map(function (info) {
                        if (!tmpSchema || info.schemaId !== tmpSchema.id) {
                            tmpSchema = _this.store.getSchemaElement(info.schemaId);
                        }
                        if (schemaElement && !tmpSchema.isA(schemaElement.id)) {
                            return null;
                        }
                        return _this.getFromCache(tmpSchema, info.endId, info.endSchemaId, metadata.id, metadata.schemaElement.id, info.id);
                    });
                }
            }
            else {
                return this._graph.getNodes(2 /* Relationship */, schemaElement).map(function (info) {
                    if (!tmpSchema || info.schemaId !== tmpSchema.id) {
                        tmpSchema = _this.store.getSchemaElement(info.schemaId);
                    }
                    if (!schemaElement || tmpSchema.isA(schemaElement.id)) {
                        return _this.getFromCache(tmpSchema, info.startId, info.startSchemaId, info.endId, info.endSchemaId, info.id);
                    }
                    return undefined;
                });
            }
            return Cursor.emptyCursor;
        };
        DomainModel.prototype.copy = function (mel, options) {
            var _this = this;
            options = options || { refs: {} };
            var refs = options.refs || (options.refs = {});
            var schema = mel.getSchemaElement();
            var ownerId = this.createId(options.mapId ? options.mapId(this, mel) : Hyperstore.Utils.splitIdentity(mel.getId())[1]);
            var copy = options.refs[ownerId];
            if (copy)
                return copy;
            if (mel.getDomain().name === this.name || (copy = this.get(ownerId)) == null)
                copy = schema.create(this, ownerId);
            options.refs[ownerId] = copy;
            var self = this;
            mel.getSchemaElement().getProperties(true).forEach(function (prop) {
                if (prop.kind !== 0 /* Normal */)
                    return;
                var pid = ownerId + "." + prop.name;
                var pv = mel.getDomain().getPropertyValue(mel.getId(), prop);
                if (pv && pv.version) {
                    var node = _this._graph.addPropertyNode(pid, prop.schemaProperty.id, pv.value, Hyperstore.Utils.getUtcNow());
                    _this._raiseEvent(new Hyperstore.ChangePropertyValueEvent(_this.name, ownerId, schema.id, prop.name, prop.serialize(pv.value), undefined, node.version));
                }
            });
            mel.getRelationships().forEach(function (rel) {
                var rs = rel.getSchemaElement();
                var end = rel.getEnd();
                if (!end)
                    return;
                if (end.getDomain().name === mel.getDomain().name) {
                    end = _this.copy(end, options);
                }
                _this.createRelationship(rs, copy, end.getId(), end.getSchemaElement().id);
            });
            return copy;
        };
        DomainModel.prototype.getPropertyValue = function (ownerId, property) {
            var owner = this._graph.getNode(ownerId);
            if (!owner) {
                throw "Invalid element " + ownerId;
            }
            var pid = owner.id + "." + property.name;
            var node = this._graph.getPropertyNode(pid);
            var value = undefined;
            if (!node) {
                var def = property.defaultValue || property.schemaProperty.defaultValue;
                if (!def) {
                    return undefined;
                }
                return new Hyperstore.PropertyValue(typeof (def) === "function" ? def() : def, undefined, 0);
            }
            return new Hyperstore.PropertyValue(node.value, undefined, node.version);
        };
        DomainModel.prototype.setPropertyValue = function (ownerId, property, value, version) {
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
                    var r = property.onChange({ mel: owner, value: value });
                    value = r.value;
                    node = this._graph.addPropertyNode(pid, property.schemaProperty.id, value, version || Hyperstore.Utils.getUtcNow());
                }
                else {
                    var r = property.onChange({ mel: owner, value: value, oldValue: node.value });
                    value = r.value;
                    oldValue = node.value;
                    node.value = value;
                    node.version = version || Hyperstore.Utils.getUtcNow();
                    this._graph.updatePropertyNode(node);
                }
                var pv = new Hyperstore.PropertyValue(value, oldValue, node.version);
                this._raiseEvent(new Hyperstore.ChangePropertyValueEvent(this.name, ownerId, owner.getSchemaElement().id, property.name, property.serialize(pv.value), property.serialize(pv.oldValue), pv.version));
                session.acceptChanges();
                return pv;
            }
            finally {
                session.close();
            }
        };
        DomainModel.prototype.create = function (schemaElement, id, version) {
            var session = this.store.beginSession();
            try {
                Hyperstore.Utils.Requires(schemaElement, "schemaElement");
                if (typeof (schemaElement) == "string")
                    schemaElement = this.store.getSchemaEntity(schemaElement);
                id = this.createId(id);
                schemaElement.onBefore({ action: "Create", id: id });
                var node = this._graph.addNode(id, schemaElement.id, version);
                var mel = schemaElement.deserialize(new Hyperstore.SerializationContext(this, id));
                this._raiseEvent(new Hyperstore.AddEntityEvent(this.name, id, schemaElement.id, node.version));
                this._cache[id] = mel;
                schemaElement.onAfter({ action: "Create", mel: mel });
                session.acceptChanges();
                return mel;
            }
            finally {
                session.close();
            }
        };
        DomainModel.prototype.createRelationship = function (schemaRelationship, start, endId, endSchemaId, id, version) {
            Hyperstore.Utils.Requires(schemaRelationship, "schemaRelationship");
            Hyperstore.Utils.Requires(start, "start");
            Hyperstore.Utils.Requires(endId, "endId");
            if (typeof (schemaRelationship) == "string")
                schemaRelationship = this.store.getSchemaRelationship(schemaRelationship);
            var session = this.store.beginSession();
            try {
                id = this.createId(id);
                schemaRelationship.onBefore({ action: "Create", id: id });
                var src = start.getInfo();
                var node = this._graph.addRelationship(id, schemaRelationship.id, src.id, src.schemaElement.id, endId, endSchemaId, version);
                var mel = schemaRelationship.deserialize(new Hyperstore.SerializationContext(this, id, src.id, src.schemaElement.id, endId, endSchemaId));
                this._raiseEvent(new Hyperstore.AddRelationshipEvent(this.name, id, schemaRelationship.id, src.id, src.schemaElement.id, endId, endSchemaId, node.version));
                this._cache[id] = mel;
                schemaRelationship.onAfter({ action: "Create", mel: mel });
                session.acceptChanges();
                return mel;
            }
            finally {
                session.close();
            }
        };
        DomainModel.prototype.onEventRaised = function (evt) {
        };
        DomainModel.prototype._raiseEvent = function (evt) {
            var _this = this;
            this.store.runInSession(function () {
                if (Array.isArray(evt)) {
                    Hyperstore.Utils.forEach(evt, function (e) {
                        Hyperstore.Session.current.addEvent(e);
                        _this.onEventRaised(e);
                    });
                }
                else {
                    Hyperstore.Session.current.addEvent(evt);
                    _this.onEventRaised(evt);
                }
            });
        };
        DomainModel.prototype.normalizeId = function (id) {
            if (id == null)
                throw "Invalid id. Must not be null";
            var pos = id.indexOf(Hyperstore.Store.IdSeparator);
            return pos <= 0 ? this.name + Hyperstore.Store.IdSeparator + id : id;
        };
        DomainModel.prototype.remove = function (id, version) {
            var _this = this;
            id = this.normalizeId(id);
            var mel = this.get(id);
            if (mel) {
                var schemaElement = mel.getSchemaElement();
                schemaElement.onBefore({ action: "Remove", mel: mel });
            }
            var session = this.store.beginSession();
            try {
                var events = this._graph.removeNode(id, version);
                this._raiseEvent(events);
                if (schemaElement)
                    schemaElement.onAfter({ action: "Remove", id: id, schema: schemaElement });
                Hyperstore.Utils.forEach(events, function (e) {
                    var mel = _this._cache[e.id];
                    if (mel) {
                        mel.dispose();
                        delete mel;
                    }
                });
                session.acceptChanges();
            }
            finally {
                session.close();
            }
        };
        DomainModel.prototype.elementExists = function (id) {
            if (!id)
                return;
            id = this.normalizeId(id);
            return !!this._graph.getNode(id);
        };
        DomainModel.prototype.get = function (id) {
            if (!id)
                return;
            id = this.normalizeId(id);
            var node = this._graph.getNode(id);
            if (!node) {
                return undefined;
            }
            var schemaElement = this.store.getSchemaElement(node.schemaId);
            return this.getFromCache(schemaElement, node.startId, node.startSchemaId, node.endId, node.endSchemaId, node.id);
        };
        DomainModel.prototype.getEntities = function (schemaElement) {
            return this.getElements(schemaElement, 1 /* Entity */);
        };
        DomainModel.prototype.getElements = function (schemaElement, kind) {
            if (kind === void 0) { kind = 3 /* EntityOrRelationship */; }
            if (typeof (schemaElement) === "string") {
                schemaElement = this.store.getSchemaElement(schemaElement.toString());
            }
            var _this = this;
            return this._graph.getNodes(kind, schemaElement).map(function (node) {
                var schemaElement = _this.store.getSchemaElement(node.schemaId);
                return _this.getFromCache(schemaElement, node.startId, node.startSchemaId, node.endId, node.endSchemaId, node.id);
            });
        };
        DomainModel.prototype.getFromCache = function (schemaElement, startId, startSchemaId, endId, endSchemaId, id) {
            var mel = this._cache[id];
            if (mel) {
                return mel;
            }
            mel = schemaElement.deserialize(new Hyperstore.SerializationContext(this, id, startId, startSchemaId, endId, endSchemaId));
            this._cache[mel.id] = mel;
            return mel;
        };
        DomainModel._seq = 0;
        return DomainModel;
    })();
    Hyperstore.DomainModel = DomainModel;
    var DomainModelScope = (function (_super) {
        __extends(DomainModelScope, _super);
        function DomainModelScope(domain, extension) {
            _super.call(this, domain.store, domain.name, extension);
            this.domain = domain;
            var that = this;
            that._graph = new HypergraphEx(domain);
            this._events = [];
        }
        DomainModelScope.prototype.unload = function (commitChanges) {
            if (commitChanges === void 0) { commitChanges = false; }
            this.store.unloadDomain(this, commitChanges);
        };
        DomainModelScope.prototype.getChanges = function () {
            var tracking = new Hyperstore.TrackingData();
            this._events.forEach(function (e) {
                tracking.__onEvent(e);
            });
            tracking.__prepareTrackedElements(this.store);
            return new MapCursor(Cursor.from(tracking.involvedTrackedElements), function (e) {
                if (e.state === 3 /* Unknown */ || e.state === 2 /* Updated */ && !e.properties)
                    return null;
                return e;
            });
        };
        DomainModelScope.prototype.onEventRaised = function (evt) {
            this._events.push(evt);
        };
        DomainModelScope.prototype.apply = function (dispatcher) {
            var _this = this;
            this.store.runInSession(function () {
                var d = new Hyperstore.DomainEventDispatcher(_this.domain, dispatcher || _this.store.eventBus.defaultEventDispatcher);
                _this._events.forEach(function (e) {
                    d.handleEvent(e);
                });
            });
        };
        return DomainModelScope;
    })(DomainModel);
    Hyperstore.DomainModelScope = DomainModelScope;
    var Hypergraph = (function () {
        function Hypergraph(domain) {
            this.domain = domain;
            this._deletedNodes = 0;
            this._properties = {};
            this._nodes = [];
            this._keys = {};
        }
        Hypergraph.prototype.dispose = function () {
            this._keys = null;
            this._nodes = null;
            this._properties = null;
        };
        Hypergraph.prototype.getKey = function (id) {
            return this._keys[id];
        };
        Hypergraph.prototype.addNodeCore = function (node) {
            var n = this.getKey(node.id);
            if (n !== undefined && n !== Hypergraph.DELETED_NODE) {
                throw "Duplicate element " + node.id;
            }
            this._keys[node.id] = this._nodes.push(node) - 1;
            return node;
        };
        Hypergraph.prototype.addNode = function (id, schemaId, version) {
            var node = new GraphNode(id, schemaId, 1 /* Entity */, version);
            return this.addNodeCore(node);
        };
        Hypergraph.prototype.updateNode = function (node) {
            if (node.needsUpdate)
                this._keys[node.id] = this._nodes.push(node) - 1;
        };
        Hypergraph.prototype.updatePropertyNode = function (node) {
            if (node.needsUpdate)
                this._properties[node.id] = node;
        };
        Hypergraph.prototype.addPropertyNode = function (id, schemaId, value, version) {
            var node = new GraphNode(id, schemaId, 4 /* Property */, version, undefined, undefined, undefined, undefined, value);
            return this._properties[node.id] = node;
        };
        Hypergraph.prototype.getPropertyNode = function (id) {
            return this._properties[id];
        };
        Hypergraph.prototype.addRelationship = function (id, schemaId, startId, startSchemaId, endId, endSchemaId, version) {
            var start = this.getNode(startId);
            if (!start) {
                throw "Invalid start element " + startId + " when adding relationship " + id;
            }
            var node = new GraphNode(id, schemaId, 2 /* Relationship */, version, startId, startSchemaId, endId, endSchemaId);
            this.addNodeCore(node);
            if (startId === endId) {
                start.addEdge(id, schemaId, 3 /* Both */, startId, startSchemaId);
                this.updateNode(start);
                return node;
            }
            start.addEdge(id, schemaId, 2 /* Outgoing */, endId, endSchemaId);
            this.updateNode(start);
            var end = this.getNode(endId);
            if (end) {
                end.addEdge(id, schemaId, 1 /* Incoming */, startId, startSchemaId);
                this.updateNode(end);
            }
            return node;
        };
        Hypergraph.prototype.getEdges = function (id, direction) {
            var n = this._keys[id];
            if (n !== undefined && n !== Hypergraph.DELETED_NODE) {
                var node = this._nodes[n];
                return direction === 1 /* Incoming */ ? node.incomings : node.outgoings;
            }
            return null;
        };
        Hypergraph.prototype.getNode = function (id) {
            var n = this._keys[id];
            return (n !== undefined && n !== Hypergraph.DELETED_NODE) ? this._nodes[n] : undefined;
        };
        Hypergraph.prototype.removeNode = function (id, version) {
            var _this = this;
            var events = [];
            var revents = [];
            var node = this.getNode(id);
            if (!node) {
                return events;
            }
            if (!version) {
                version = Hyperstore.Utils.getUtcNow();
            }
            var sawNodes = {};
            this.traverseNodes(node, function (node) {
                sawNodes[node.id] = true;
                var evt;
                if (!node.startId) {
                    evt = new Hyperstore.RemoveEntityEvent(_this.domain.name, node.id, node.schemaId, version);
                }
                else {
                    evt = new Hyperstore.RemoveRelationshipEvent(_this.domain.name, node.id, node.schemaId, node.startId, node.startSchemaId, node.endId, node.endSchemaId, version);
                }
                evt.TL = node.id === id;
                events.push(evt);
                if (Hyperstore.Session.current.mode & (2048 /* Rollback */ | 24 /* UndoOrRedo */))
                    return null;
                var nodes = [];
                var edges = _this.getEdges(node.id, 2 /* Outgoing */);
                edges.forEach(function (edge) {
                    if (!sawNodes[edge.id]) {
                        sawNodes[edge.id] = true;
                        nodes.push(_this.getNode(edge.id));
                    }
                });
                edges = _this.getEdges(node.id, 1 /* Incoming */);
                edges.forEach(function (edge) {
                    if (!sawNodes[edge.id]) {
                        sawNodes[edge.id] = true;
                        nodes.push(_this.getNode(edge.id));
                    }
                });
                if (node.startId) {
                    var schema = _this.domain.store.getSchemaRelationship(node.schemaId);
                    if (schema.embedded) {
                        if (!sawNodes[node.endId]) {
                            sawNodes[node.endId] = true;
                            nodes.push(_this.getNode(node.endId));
                        }
                    }
                }
                return nodes;
            });
            events = revents.concat(events);
            var pevents = [];
            events.forEach(function (e) { return _this.removeNodeInternal(e.id, sawNodes, pevents); });
            if (this._deletedNodes > 1000)
                this.shrink();
            return pevents.concat(events);
        };
        Hypergraph.prototype.shrink = function () {
            var nodes = [];
            for (var key in this._keys) {
                var n = this._keys[key];
                if (n === Hypergraph.DELETED_NODE)
                    continue;
                this._keys[key] = nodes.push(this._nodes[n]) - 1;
            }
            this._nodes = nodes;
            this._deletedNodes = 0;
        };
        Hypergraph.prototype.removeNodeInternal = function (id, sawNodes, events) {
            var index = this.getKey(id);
            if (index === undefined || index === Hypergraph.DELETED_NODE) {
                return;
            }
            var node = this.getNode(id);
            if (!node.needsUpdate)
                this._nodes[index] = null;
            this._deletedNodes++;
            this._keys[id] = Hypergraph.DELETED_NODE;
            if (node.kind === 2 /* Relationship */) {
                var start = this.getNode(node.startId);
                if (node.startId == node.endId) {
                    if (start) {
                        start.removeEdge(id, 3 /* Both */);
                        this.updateNode(start);
                    }
                    return node;
                }
                else {
                    if (start) {
                        start.removeEdge(id, 2 /* Outgoing */);
                        this.updateNode(start);
                    }
                    var end = this.getNode(node.endId);
                    if (end) {
                        end.removeEdge(id, 1 /* Incoming */);
                        this.updateNode(end);
                    }
                }
            }
            var schema = this.domain.store.getSchemaElement(node.schemaId);
            var self = this;
            schema.getProperties(true).forEach(function (p) {
                var pnode = node.properties[p.name];
                if (pnode) {
                    events.push(new Hyperstore.RemovePropertyEvent(self.domain.name, node.id, node.schemaId, p.name, pnode.value, pnode.version));
                }
            });
        };
        Hypergraph.prototype.traverseNodes = function (startNode, visit) {
            var queue = [];
            queue.push(startNode);
            while (queue.length > 0) {
                var node = queue.pop();
                if (!node) {
                    continue;
                }
                var nodes = visit(node);
                if (!nodes) {
                    return;
                }
                for (var k in nodes) {
                    node = nodes[k];
                    queue.unshift(node);
                }
            }
        };
        Hypergraph.prototype.getNodes = function (kind, schema) {
            return new NodesCursor(this, kind, schema);
        };
        Hypergraph.DELETED_NODE = '$';
        return Hypergraph;
    })();
    var HypergraphEx = (function (_super) {
        __extends(HypergraphEx, _super);
        function HypergraphEx(domain) {
            _super.call(this, domain);
            this._superHyperGraph = domain._graph;
        }
        HypergraphEx.prototype.getKey = function (id) {
            var idx = this._keys[id];
            if (idx !== undefined)
                return idx;
            return this._superHyperGraph.getKey(id);
        };
        HypergraphEx.prototype.getPropertyNode = function (pid) {
            var node = _super.prototype.getPropertyNode.call(this, pid);
            if (node)
                return node;
            node = this._superHyperGraph.getPropertyNode(pid);
            if (!node)
                return node;
            node = node.clone();
            node.needsUpdate = true;
            return node;
        };
        HypergraphEx.prototype.getNodes = function (kind, schema) {
            var _this = this;
            return new ConcatCursor(new NodesCursor(this, kind, schema), new MapCursor(new NodesCursor(this.domain.getGraph(), kind, schema), function (n) { return _this._keys[n.id] !== Hypergraph.DELETED_NODE ? n : undefined; }));
        };
        HypergraphEx.prototype.getEdges = function (id, direction) {
            var _this = this;
            var n = this._keys[id];
            if (n !== undefined) {
                if (n === Hypergraph.DELETED_NODE)
                    return null;
                var node = this._nodes[n];
                var cursor1 = direction === 1 /* Incoming */ ? node.incomings : node.outgoings;
                var cursor2 = this._superHyperGraph.getEdges(id, direction);
                return cursor2 ? new ConcatCursor(cursor1, new MapCursor(cursor2, function (n) { return _this._keys[n.id] !== Hypergraph.DELETED_NODE ? n : undefined; })) : cursor1;
            }
            return this._superHyperGraph.getEdges(id, direction);
        };
        HypergraphEx.prototype.getNode = function (id) {
            var n = this._keys[id];
            if (n !== undefined) {
                return n !== Hypergraph.DELETED_NODE ? this._nodes[n] : undefined;
            }
            var node = this._superHyperGraph.getNode(id);
            if (!node)
                return node;
            node = node.clone();
            node.needsUpdate = true;
            return node;
        };
        return HypergraphEx;
    })(Hypergraph);
    var Cursor = (function () {
        function Cursor() {
        }
        Cursor.prototype.reset = function () {
        };
        Cursor.prototype.hasNext = function () {
            return false;
        };
        Cursor.prototype.next = function () {
            return undefined;
        };
        Cursor.prototype.firstOrDefault = function (callback) {
            this.reset();
            while (this.hasNext()) {
                var r = this.next();
                if (!callback || callback(r))
                    return r;
            }
            return undefined;
        };
        Cursor.prototype.forEach = function (callback) {
            this.reset();
            while (this.hasNext()) {
                callback(this.next());
            }
        };
        Cursor.prototype.count = function (callback) {
            var cx = 0;
            this.reset();
            while (this.hasNext()) {
                if (!callback || callback(this.next()))
                    cx++;
            }
            return cx;
        };
        Cursor.prototype.concat = function (list) {
            return new ConcatCursor(this, list);
        };
        Cursor.prototype.any = function (callback) {
            this.reset();
            while (this.hasNext()) {
                if (!callback || callback(this.next()))
                    return true;
            }
            return false;
        };
        Cursor.prototype.toArray = function () {
            var list = [];
            this.forEach(function (n) { return list.push(n); });
            return list;
        };
        Cursor.prototype.map = function (callback) {
            return new MapCursor(this, callback);
        };
        Cursor.from = function (obj) {
            if (Array.isArray(obj))
                return new ArrayCursor(obj);
            if (obj.hasNext)
                return obj;
            throw "Not implemented";
        };
        Cursor.emptyCursor = new Cursor();
        return Cursor;
    })();
    Hyperstore.Cursor = Cursor;
    var ConcatCursor = (function (_super) {
        __extends(ConcatCursor, _super);
        function ConcatCursor() {
            var cursors = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                cursors[_i - 0] = arguments[_i];
            }
            _super.call(this);
            this._cursors = cursors;
            this.reset();
        }
        ConcatCursor.prototype.reset = function () {
            this._current = undefined;
            this._set = {};
            this._idx = 0;
            this._cursors.forEach(function (c) { return c.reset(); });
        };
        ConcatCursor.prototype.hasNext = function () {
            while (true) {
                if (this._idx < this._cursors.length) {
                    var r = this._cursors[this._idx].hasNext();
                    if (r) {
                        this._current = this._cursors[this._idx].next();
                        if (!this._set[this._current.id]) {
                            this._set[this._current.id] = true;
                            return true;
                        }
                        continue;
                    }
                    this._idx++;
                }
                else {
                    this._current = undefined;
                    return false;
                }
            }
        };
        ConcatCursor.prototype.next = function () {
            return this._current;
        };
        return ConcatCursor;
    })(Cursor);
    var MapCursor = (function (_super) {
        __extends(MapCursor, _super);
        function MapCursor(_cursor, _filter) {
            _super.call(this);
            this._cursor = _cursor;
            this._filter = _filter;
            this.reset();
        }
        MapCursor.prototype.reset = function () {
            this._cursor.reset();
            this._current = undefined;
        };
        MapCursor.prototype.hasNext = function () {
            while (true) {
                if (!this._cursor.hasNext()) {
                    this._current = undefined;
                    return false;
                }
                var r = this._filter(this._cursor.next());
                if (r != null) {
                    this._current = r;
                    return true;
                }
            }
        };
        MapCursor.prototype.next = function () {
            return this._current;
        };
        return MapCursor;
    })(Cursor);
    Hyperstore.MapCursor = MapCursor;
    var ArrayCursor = (function (_super) {
        __extends(ArrayCursor, _super);
        function ArrayCursor(_array) {
            _super.call(this);
            this._array = _array;
            this.reset();
        }
        ArrayCursor.prototype.reset = function () {
            this._index = 0;
        };
        ArrayCursor.prototype.hasNext = function () {
            if (this._index === this._array.length)
                return false;
            this._index++;
            return true;
        };
        ArrayCursor.prototype.next = function () {
            return this._array[this._index - 1];
        };
        return ArrayCursor;
    })(Cursor);
    Hyperstore.ArrayCursor = ArrayCursor;
    var NodesCursor = (function (_super) {
        __extends(NodesCursor, _super);
        function NodesCursor(_graph, _kind, _schema) {
            _super.call(this);
            this._graph = _graph;
            this._kind = _kind;
            this._schema = _schema;
            this.reset();
        }
        NodesCursor.prototype.reset = function () {
            this._index = 0;
            this._current = undefined;
        };
        NodesCursor.prototype.hasNext = function () {
            while (true) {
                if (this._index === this._graph._nodes.length) {
                    this._current = undefined;
                    return false;
                }
                var node = this._graph._nodes[this._index++];
                if (node && (node.kind & this._kind) !== 0 && (!this._schema || this._schema.id === node.schemaId)) {
                    var key = this._graph._keys[node.id];
                    if (key !== Hypergraph.DELETED_NODE) {
                        this._current = node;
                        return true;
                    }
                }
            }
        };
        NodesCursor.prototype.next = function () {
            return this._current;
        };
        return NodesCursor;
    })(Cursor);
    (function (Direction) {
        Direction[Direction["Incoming"] = 1] = "Incoming";
        Direction[Direction["Outgoing"] = 2] = "Outgoing";
        Direction[Direction["Both"] = 3] = "Both";
    })(Hyperstore.Direction || (Hyperstore.Direction = {}));
    var Direction = Hyperstore.Direction;
    (function (NodeType) {
        NodeType[NodeType["Entity"] = 1] = "Entity";
        NodeType[NodeType["Relationship"] = 2] = "Relationship";
        NodeType[NodeType["EntityOrRelationship"] = 3] = "EntityOrRelationship";
        NodeType[NodeType["Property"] = 4] = "Property";
    })(Hyperstore.NodeType || (Hyperstore.NodeType = {}));
    var NodeType = Hyperstore.NodeType;
    var NodeInfo = (function () {
        function NodeInfo(id, schemaId, version) {
            this.id = id;
            this.schemaId = schemaId;
            this.version = version;
            if (!version) {
                this.version = Hyperstore.Utils.getUtcNow();
            }
        }
        return NodeInfo;
    })();
    var EdgeInfo = (function (_super) {
        __extends(EdgeInfo, _super);
        function EdgeInfo(id, schemaId, version, endId, endSchemaId) {
            _super.call(this, id, schemaId, version);
            this.endId = endId;
            this.endSchemaId = endSchemaId;
        }
        return EdgeInfo;
    })(NodeInfo);
    var GraphNode = (function (_super) {
        __extends(GraphNode, _super);
        function GraphNode(id, schemaId, kind, version, startId, startSchemaId, endId, endSchemaId, value, outgoings, incomings) {
            _super.call(this, id, schemaId, version, endId, endSchemaId);
            this.value = value;
            this.kind = kind;
            this.startId = startId;
            this.startSchemaId = startSchemaId;
            this.properties = [];
            this.outgoings = outgoings && outgoings.clone() || new Hyperstore.HashTable();
            this.incomings = incomings && incomings.clone() || new Hyperstore.HashTable();
        }
        GraphNode.prototype.clone = function () {
            var node = new GraphNode(this.id, this.schemaId, this.kind, this.version, this.startId, this.startSchemaId, this.endId, this.endSchemaId, this.value, this.outgoings, this.incomings);
            return node;
        };
        GraphNode.prototype.addEdge = function (id, edgeSchemaId, direction, endId, endSchemaId) {
            var edge = new EdgeInfo(id, edgeSchemaId, undefined, endId, endSchemaId);
            if ((direction & 1 /* Incoming */) === 1 /* Incoming */) {
                this.incomings.add(id, edge);
            }
            if ((direction & 2 /* Outgoing */) === 2 /* Outgoing */) {
                this.outgoings.add(id, edge);
            }
        };
        GraphNode.prototype.removeEdge = function (id, direction) {
            if ((direction & 1 /* Incoming */) === 1 /* Incoming */) {
                this.incomings.remove(id);
            }
            if ((direction & 2 /* Outgoing */) === 2 /* Outgoing */) {
                this.outgoings.remove(id);
            }
        };
        return GraphNode;
    })(EdgeInfo);
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var DomainManager = (function (_super) {
        __extends(DomainManager, _super);
        function DomainManager() {
            _super.call(this);
            this._keys = {};
            this._domains = [];
            this._iterations = [];
        }
        DomainManager.prototype.reset = function () {
            this._ix = 0;
        };
        DomainManager.prototype.next = function () {
            return this._domains[this._iterations[this._ix - 1]];
        };
        DomainManager.prototype.hasNext = function () {
            return this._ix++ < this._iterations.length;
        };
        DomainManager.prototype.hasExtensions = function () {
            return this._iterations.length !== this._domains.length;
        };
        DomainManager.prototype.addDomain = function (domain) {
            var idx = this._domains.push(domain) - 1;
            this._keys[domain.name] = idx;
            this.resetIterations();
        };
        DomainManager.prototype.resetIterations = function () {
            var _this = this;
            this._iterations = [];
            Hyperstore.Utils.forEach(this._keys, function (v) { return _this._iterations.push(v); });
        };
        DomainManager.prototype.unload = function (domain) {
            domain.dispose();
            var i = this._keys[domain.name];
            if (i) {
                this._domains.splice(i);
                i = undefined;
                if (domain.extension) {
                    var parent = domain.domain;
                    for (var x = 0; this._domains.length; x++) {
                        if (this._domains[x] === parent) {
                            i = x;
                            break;
                        }
                    }
                    if (i === undefined)
                        throw "Inconsistant domain list when unloading an extension";
                    this._keys[domain.name] = i;
                }
                else {
                    delete this._keys[domain.name];
                }
                this.resetIterations();
            }
        };
        DomainManager.prototype.getDomain = function (name) {
            var i = this._keys[name];
            return i !== undefined ? this._domains[i] : undefined;
        };
        DomainManager.prototype.all = function () {
            return this._domains;
        };
        DomainManager.prototype.dispose = function () {
            this._domains.forEach(function (d) {
                var tmp = d;
                while (tmp.extension) {
                    tmp.dispose();
                    tmp = tmp.domain;
                }
                tmp.dispose();
            });
            this._domains = null;
            this._keys = null;
        };
        return DomainManager;
    })(Hyperstore.Cursor);
    var Store = (function () {
        function Store(id) {
            this._schemas = new Hyperstore.HashTable();
            this._subscriptions = [];
            this.eventBus = new Hyperstore.EventBus(this);
            this.schemaElements = {};
            this.schemasBySimpleName = {};
            this._domains = new DomainManager();
            new Hyperstore.Schema(this, "$", this.primitiveSchemaDefinition());
            this.storeId = id || Hyperstore.Utils.newGuid();
        }
        Object.defineProperty(Store, "IdSeparator", {
            get: function () {
                return ":";
            },
            enumerable: true,
            configurable: true
        });
        Store.prototype.__addSchema = function (name, schema) {
            if (this.getSchema(name))
                throw "Duplicate schema " + name;
            this._schemas.add(name, schema);
        };
        Object.defineProperty(Store.prototype, "schemas", {
            get: function () {
                return new Hyperstore.MapCursor(this._schemas, function (s) { return s; });
            },
            enumerable: true,
            configurable: true
        });
        Store.prototype.getSchema = function (name) {
            return this._schemas.get(name);
        };
        Store.prototype.loadSchemas = function (schemas, overrides) {
            if (!schemas)
                return null;
            if (typeof (schemas) === 'function')
                schemas = schemas();
            var loader = new Hyperstore.Loader(this);
            return loader.loadSchemas(schemas, overrides);
        };
        Store.prototype.createDomainAsync = function (config) {
            var p = Q.defer();
            this.createDomain(config, p);
            return p.promise;
        };
        Store.prototype.createDomain = function (config, p) {
            if (!config)
                return null;
            if (typeof (config) === "string") {
                var domain = new Hyperstore.DomainModel(this, config);
                if (p) {
                    p.resolve(domain);
                }
                return domain;
            }
            if (config.schema) {
                this.loadSchemas(config.schema, config.overrides);
            }
            var domainName = config.name;
            domain = new Hyperstore.DomainModel(this, domainName);
            this["config"] = config;
            var self = this;
            var tasks;
            if (config.adapters) {
                tasks = [];
                var adapters = typeof (config.adapters) === "function" ? config.adapters() : config.adapters;
                adapters.forEach(function (a) {
                    domain.addAdapter(a);
                    tasks.push(a.loadElementsAsync());
                });
            }
            if (tasks) {
                if (!p)
                    throw Error("You must use createDomainAsync when using adapters and/or channels.");
                Q.all(tasks).then(function () {
                    self.populateDomain(config, domain);
                    self.addChannels(config, domain);
                    self.defaultDomainModel = this.getDomain(config.defaultDomainModel);
                    p.resolve(domain);
                }).fail(function (err) {
                    p.reject(err);
                });
            }
            else {
                this.populateDomain(config, domain);
                self.addChannels(config, domain);
                this.defaultDomainModel = this.getDomain(config.defaultDomainModel);
                if (p)
                    p.resolve(domain);
            }
            return domain;
        };
        Store.prototype.addChannels = function (config, domain) {
            if (config.channels) {
                var channels = typeof (config.channels) === "function" ? config.channels() : config.channels;
                channels.forEach(function (channel) {
                    channel.associate(domain);
                    domain.store.eventBus.addChannel(channel);
                });
            }
        };
        Store.prototype.populateDomain = function (def, domain) {
            if (!def || domain.getElements().hasNext())
                return;
            if (def.seed) {
                if (typeof (def.seed) === "function") {
                    var session = domain.store.beginSession();
                    try {
                        def.seed(domain);
                        session.acceptChanges();
                    }
                    finally {
                        var r = session.close();
                        return r;
                    }
                }
                else if (typeof (def.seed) === "string") {
                }
                return;
            }
            if (def.data) {
                for (var name in def.data) {
                    if (!def.data.hasOwnProperty(name))
                        continue;
                    var root = domain.store.getSchemaElement(name);
                    var list = domain.loadFromJson(def.data[name], root);
                    domain["root"] = list && list.length === 1 ? Hyperstore.Utils.firstOrDefault(list) : list;
                    break;
                }
            }
        };
        Store.prototype.dispose = function () {
            this.eventBus.dispose();
            this.eventBus = undefined;
            this._domains.dispose();
            this._domains = undefined;
            this.schemaElements = undefined;
            this.schemasBySimpleName = undefined;
            this._subscriptions = undefined;
            this._schemas = null;
        };
        Store.prototype.unloadDomain = function (domain, commitChanges) {
            if (commitChanges === void 0) { commitChanges = false; }
            var scope = domain;
            if (scope.apply && commitChanges)
                scope.apply();
            this._domains.unload(domain);
        };
        Object.defineProperty(Store.prototype, "domains", {
            get: function () {
                return this._domains.all();
            },
            enumerable: true,
            configurable: true
        });
        Store.prototype.onSessionCompleted = function (action) {
            var ix = this._subscriptions.length;
            this._subscriptions.push({ ix: ix, fn: action });
            return ix;
        };
        Store.prototype.removeSessionCompleted = function (cookie) {
            var pos = Hyperstore.Utils.indexOf(this._subscriptions, function (s) { return s.ix === cookie; });
            if (pos >= 0) {
                this._subscriptions.splice(pos, 1);
            }
        };
        Store.prototype.__sendSessionCompletedEvent = function (session) {
            this._subscriptions.forEach(function (s) { return s.fn(session); });
        };
        Store.prototype.primitiveSchemaDefinition = function () {
            return {
                defineSchema: function (schema) {
                    new Hyperstore.Primitive(schema, "any"), new Hyperstore.Primitive(schema, "string", "{value} must be a string", function (val, old, ctx) { return !val || typeof (val) === "string"; }, false, 0 /* Check */);
                    new Hyperstore.Primitive(schema, "number", "{value} must be a number", function (val, old, ctx) { return !val || typeof (val) === "number"; }, false, 0 /* Check */);
                    new Hyperstore.Primitive(schema, "boolean", "{value} must be a boolean", function (val, old, ctx) { return !val || typeof (val) === "boolean"; }, false, 0 /* Check */);
                }
            };
        };
        Store.prototype.getActiveDomains = function () {
            var dic = new Hyperstore.HashTable();
            this._domains.all().forEach(function (d) {
                dic._fastInsert(d.name, d);
            });
            return dic;
        };
        Object.defineProperty(Store.prototype, "hasDomainExtensions", {
            get: function () {
                return this._domains.hasExtensions();
            },
            enumerable: true,
            configurable: true
        });
        Store.prototype.getDomain = function (name) {
            if (Hyperstore.Session.current)
                return Hyperstore.Session.current.getDomain(name, true) || this._domains.getDomain(name);
            return this._domains.getDomain(name);
        };
        Store.prototype.__addDomain = function (domain) {
            this._domains.addDomain(domain);
        };
        Store.prototype.beginSession = function (config) {
            if (!Hyperstore.Session.current) {
                config = config || {};
                config.defaultDomain = config.defaultDomain || this.defaultDomainModel;
                Hyperstore.Session.current = new Hyperstore.Session(this, config);
            }
            else {
                Hyperstore.Session.current.__nextLevel();
            }
            return Hyperstore.Session.current;
        };
        Store.prototype.__addSchemaElement = function (schemaInfo) {
            var id = schemaInfo.id.toLowerCase();
            if (this.schemaElements[id]) {
                throw "Duplicate schema " + schemaInfo.id;
            }
            this.schemaElements[id] = schemaInfo;
            var pos = id.indexOf(':');
            var simpleName = pos < 0 ? id : id.substr(pos + 1);
            if (!this.schemasBySimpleName[simpleName]) {
                this.schemasBySimpleName[simpleName] = schemaInfo;
            }
            else {
                this.schemasBySimpleName[simpleName] = null;
            }
        };
        Store.prototype.getSchemaInfo = function (schemaName, throwException) {
            if (throwException === void 0) { throwException = true; }
            if (!schemaName)
                return undefined;
            var schemaElement;
            if (schemaName.indexOf(':') < 0) {
                schemaElement = this.schemasBySimpleName[schemaName.toLowerCase()];
                if (schemaElement === null) {
                    throw "Can not resolve schema element by its simple name due to duplicate elements. Use full name to resolve this schema element.";
                }
            }
            else {
                schemaElement = this.schemaElements[schemaName.toLowerCase()];
            }
            if (!schemaElement && throwException) {
                throw "Unknown schema " + schemaName;
            }
            return schemaElement;
        };
        Store.prototype.getSchemaRelationships = function (start, end) {
            if (typeof (start) === "string") {
                start = this.getSchemaElement(start);
            }
            if (typeof (end) === "string") {
                end = this.getSchemaElement(end);
            }
            var list = [];
            this.schemaElements.forEach(function (v) {
                if (v.kind === 1 /* Relationship */) {
                    var r = v;
                    if ((!start || r.startSchemaId === start.id) && (!end || r.endSchemaId === end.id)) {
                        list.push(r);
                    }
                }
            });
            return list;
        };
        Store.prototype.getSchemaElement = function (schemaName, throwException) {
            if (throwException === void 0) { throwException = true; }
            var schemaElement = this.getSchemaInfo(schemaName, throwException);
            if ((!schemaElement || (schemaElement.kind !== 1 /* Relationship */ && schemaElement.kind !== 0 /* Entity */)) && throwException) {
                throw "Unknown schema " + schemaName;
            }
            return schemaElement;
        };
        Store.prototype.getSchemaRelationship = function (schemaName, throwException) {
            if (throwException === void 0) { throwException = true; }
            var schemaElement = this.getSchemaInfo(schemaName, throwException);
            if ((!schemaElement || (schemaElement.kind !== 1 /* Relationship */)) && throwException) {
                throw "Unknown schema " + schemaName;
            }
            return schemaElement;
        };
        Store.prototype.getSchemaEntity = function (schemaName, throwException) {
            if (throwException === void 0) { throwException = true; }
            var schemaElement = this.getSchemaInfo(schemaName, throwException);
            if ((!schemaElement || (schemaElement.kind !== 0 /* Entity */)) && throwException) {
                throw "Unknown schema " + schemaName;
            }
            return schemaElement;
        };
        Store.prototype.runInSession = function (action, mode) {
            if (mode === void 0) { mode = 0 /* Normal */; }
            var session = this.beginSession({ mode: mode });
            try {
                action();
                Hyperstore.Session.current.acceptChanges();
            }
            finally {
                session.close();
            }
        };
        Store.prototype.get = function (id) {
            var domainName = id.substr(0, id.indexOf(':'));
            var domain = this.getDomain(domainName);
            return domain ? domain.get(id) : undefined;
        };
        Store.prototype.getElements = function (schemaElement, kind) {
            if (kind === void 0) { kind = 3 /* EntityOrRelationship */; }
            return new SelectManyCursor(this._domains, function (domain) {
                return domain.getElements(schemaElement, kind);
            });
        };
        return Store;
    })();
    Hyperstore.Store = Store;
    var SelectManyCursor = (function (_super) {
        __extends(SelectManyCursor, _super);
        function SelectManyCursor(_cursor, _select) {
            _super.call(this);
            this._cursor = _cursor;
            this._select = _select;
            this.reset();
        }
        SelectManyCursor.prototype.reset = function () {
            this._cursor.reset();
            this._iter = null;
        };
        SelectManyCursor.prototype.hasNext = function () {
            while (true) {
                if (!this._iter) {
                    if (!this._cursor.hasNext()) {
                        return false;
                    }
                    this._iter = this._select(this._cursor.next());
                }
                if (this._iter.hasNext())
                    return true;
                this._iter = null;
            }
        };
        SelectManyCursor.prototype.next = function () {
            return this._iter.next();
        };
        return SelectManyCursor;
    })(Hyperstore.Cursor);
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var ModelElement = (function () {
        function ModelElement() {
        }
        ModelElement.prototype.getInfo = function () {
            return this._info;
        };
        ModelElement.prototype.getId = function () {
            return this._info.id;
        };
        ModelElement.prototype.getDomain = function () {
            return this._info.domain;
        };
        ModelElement.prototype.getSchemaElement = function () {
            return this._info.schemaElement;
        };
        Object.defineProperty(ModelElement.prototype, "isDisposed", {
            get: function () {
                return !this._info || this._info.disposed;
            },
            enumerable: true,
            configurable: true
        });
        ModelElement.prototype.toString = function () {
            var self = this;
            return self.name || self.Name || self.Id || self._info.id;
        };
        ModelElement.prototype.dispose = function () {
            this._info.disposed = true;
            for (var p in this) {
                if (this.hasOwnProperty(p) && p.substr(0, 5) === "__ref") {
                    var prop = this[p];
                    if (prop && prop.dispose) {
                        prop.dispose();
                    }
                }
            }
        };
        ModelElement.prototype.getKey = function (includeParentKey) {
            var _this = this;
            if (includeParentKey === void 0) { includeParentKey = false; }
            var empty = "";
            var keyProperties = this.getSchemaElement().getKeyProperties().toArray();
            if (keyProperties.length === 0)
                return;
            var keys = [];
            if (includeParentKey) {
                var parent = this.getParent();
                if (parent) {
                    var v = parent.getKey(true);
                    if (v) {
                        keys.push(v);
                        keys.push(".");
                    }
                }
            }
            keyProperties.forEach(function (p) { return keys.push(_this.get(p) || empty); });
            return keys.join("");
        };
        ModelElement.prototype.getParent = function () {
            var rel = this.getRelationships(undefined, 1 /* Incoming */).firstOrDefault(function (r) { return r.getSchemaElement().embedded; });
            return rel ? rel.getStart() : undefined;
        };
        ModelElement.prototype.get = function (property) {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (typeof (property) === "string")
                property = this._info.schemaElement.getProperty(property, true);
            if (!property)
                return undefined;
            var pv = this._info.domain.getPropertyValue(this._info.id, property);
            if (!pv) {
                return undefined;
            }
            return pv.value;
        };
        ModelElement.prototype.set = function (property, value) {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (typeof (property) === "string")
                property = this._info.schemaElement.getProperty(property, true);
            return this._info.domain.setPropertyValue(this._info.id, property, value);
        };
        ModelElement.prototype.__initialize = function (domain, id, schemaElement, startId, startSchemaId, endId, endSchemaId) {
            this._info = {
                disposed: false,
                domain: domain,
                schemaElement: schemaElement,
                id: id
            };
            return this._info;
        };
        ModelElement.prototype.loadFromJson = function (obj, refs) {
            var melInfo = this.getInfo();
            var domain = melInfo.domain;
            if (typeof (obj) !== "object")
                throw "Unable to load a " + melInfo.schemaElement.name + " from data " + obj;
            this.getSchemaElement().onBefore({ action: "Load", mel: this });
            refs = refs || {};
            for (var member in obj) {
                if (!obj.hasOwnProperty(member))
                    continue;
                var val = obj[member];
                var prop = melInfo.schemaElement.getProperty(member, true);
                if (prop) {
                    this.set(prop, prop.deserialize(new Hyperstore.SerializationContext(domain, melInfo.id, undefined, undefined, undefined, undefined, val)));
                    continue;
                }
                var rel = melInfo.schemaElement.getReference(member, true);
                if (rel) {
                    var endSchema = domain.store.getSchemaEntity(rel.schemaRelationship.endSchemaId);
                    var values = Array.isArray(val) ? val : [val];
                    for (var i in values) {
                        var v = values[i];
                        var elem;
                        if (v.$ref) {
                            elem = refs[v.$ref];
                        }
                        else {
                            if (v.$id) {
                                refs[v.$id] = elem;
                            }
                            if (rel.schemaRelationship.loadFromJson) {
                                var relationShip = rel.schemaRelationship.loadFromJson(this.getDomain(), this, v);
                                if (relationShip)
                                    continue;
                            }
                            var r = domain.__parseJson(v, endSchema, refs, this);
                            if (!r)
                                continue;
                        }
                        var src = rel.opposite ? r.elem : this;
                        var end = rel.opposite ? this : r.elem;
                        var d = src.getInfo().domain;
                        if (!d.getRelationships(rel.schemaRelationship, src, end).hasNext() && end) {
                            var endInfo = end.getInfo();
                            d.createRelationship(rel.schemaRelationship, src, endInfo.id, endInfo.schemaElement.id);
                        }
                        r.load();
                    }
                }
            }
            this.getSchemaElement().onAfter({ action: "Load", mel: this });
        };
        ModelElement.prototype.getRelationships = function (schemaElement, direction) {
            if (direction === void 0) { direction = 2 /* Outgoing */; }
            var list;
            if ((direction & 2 /* Outgoing */) !== 0) {
                list = this._info.domain.getRelationships(schemaElement, this);
            }
            if ((direction & 1 /* Incoming */) !== 0) {
                var list2 = this._info.domain.getRelationships(schemaElement, undefined, this);
                if (list && list.any()) {
                    list = list.concat(list2);
                }
                else
                    list = list2;
            }
            return list;
        };
        ModelElement.prototype.asJsonObject = function (cfg) {
            var _this = this;
            var obj = this.getSchemaElement().serialize(this) || {};
            if (cfg && cfg.serializeId)
                obj.$id = this.getId();
            var self = this;
            this.getSchemaElement().getProperties(true).forEach(function (prop) {
                if (prop.kind !== 0 /* Normal */)
                    return;
                var val = _this.get(prop);
                if (val) {
                    var value = prop.schemaProperty.serialize(val);
                    if (value) {
                        obj[prop.name] = value;
                    }
                }
            });
            this.getRelationships().forEach(function (rel) {
                var rs = rel.getSchemaElement();
                if (rs.startProperty) {
                    var end = rel.getEnd();
                    if (!end || (end.getDomain().name !== self.getDomain().name && (cfg && cfg.localDomainOnly)))
                        return;
                    if (rs.embedded && self.getId() !== end.getId()) {
                        if (rs.cardinality === 0 /* OneToOne */) {
                            obj[rs.startProperty] = end.asJsonObject(cfg);
                            return;
                        }
                        if (!obj[rs.startProperty])
                            obj[rs.startProperty] = [];
                        obj[rs.startProperty].push(end.asJsonObject(cfg));
                    }
                    else {
                        if (!cfg || !cfg.serializeId)
                            throw "You must set 'serializedId' option to true to reference not embedded element.";
                        var id = end.getId();
                        if (rs.cardinality === 0 /* OneToOne */) {
                            obj[rs.startProperty] = { $ref: id };
                            return;
                        }
                        if (!obj[rs.startProperty])
                            obj[rs.startProperty] = [];
                        obj[rs.startProperty].push({ $ref: id });
                    }
                }
            });
            return obj;
        };
        ModelElement.prototype.dump = function (writer, indent) {
            var _this = this;
            if (writer === void 0) { writer = console.log; }
            if (indent === void 0) { indent = 0; }
            var tab = "";
            for (var i = 0; i < indent; i++)
                tab += " ";
            writer(tab + this._info.schemaElement.id + " " + this._info.id + " --------------");
            this.getSchemaElement().getProperties(true).forEach(function (prop) {
                if (prop.kind === 0 /* Normal */)
                    writer(tab + " " + prop.name + " = " + _this.get(prop));
            });
            var lastRelSchema;
            this.getRelationships().map(function (rel) { return rel.getSchemaElement().embedded ? rel : null; }).forEach(function (rel) {
                if (!lastRelSchema || lastRelSchema !== rel.getSchemaElement().id) {
                    lastRelSchema = rel.getSchemaElement().id;
                    writer(tab + " [" + rel.getSchemaElement().startProperty + "] :");
                }
                rel.getEnd().dump(writer, indent + 2);
            });
        };
        return ModelElement;
    })();
    Hyperstore.ModelElement = ModelElement;
    var ModelRelationship = (function (_super) {
        __extends(ModelRelationship, _super);
        function ModelRelationship() {
            _super.apply(this, arguments);
        }
        ModelRelationship.prototype.getStartId = function () {
            return this.getInfo().startId;
        };
        ModelRelationship.prototype.getStartSchemaElementId = function () {
            return this.getInfo().startSchemaId;
        };
        ModelRelationship.prototype.getEndId = function () {
            return this.getInfo().endId;
        };
        ModelRelationship.prototype.getEndSchemaElementId = function () {
            return this.getInfo().endSchemaId;
        };
        ModelRelationship.prototype.getStart = function () {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (this.__start === undefined) {
                var info = this.getInfo();
                if (info.startId)
                    this.__start = this.getDomain().store.get(info.startId);
            }
            return this.__start;
        };
        ModelRelationship.prototype.getEnd = function () {
            if (this.isDisposed) {
                throw "Can not use a disposed element";
            }
            if (this.__end === undefined) {
                var info = this.getInfo();
                if (info.endId)
                    this.__end = this.getDomain().store.get(info.endId);
            }
            return this.__end;
        };
        ModelRelationship.prototype.__initialize = function (domain, id, schemaElement, startId, startSchemaId, endId, endSchemaId) {
            var info = _super.prototype.__initialize.call(this, domain, id, schemaElement);
            info.startId = startId;
            info.startSchemaId = startSchemaId;
            info.endId = endId;
            info.endSchemaId = endSchemaId;
            return info;
        };
        return ModelRelationship;
    })(ModelElement);
    Hyperstore.ModelRelationship = ModelRelationship;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var ModelElementArray = (function () {
        function ModelElementArray(_collection) {
            this._collection = _collection;
            var self = this;
            this._sessionCompletedCookie = this._collection.domain.events.on(Hyperstore.EventManager.SessionCompleted, function (s) {
                if (s.aborted) {
                    return;
                }
                var domain = self._collection.domain;
                var srcId = self._collection.source && self._collection.source.getInfo().id;
                var endId = self._collection.end && self._collection.end.getInfo().id;
                Hyperstore.Utils.forEach(s.events, function (e) {
                    if (e.eventName !== Hyperstore.EventManager.AddRelationshipEvent && e.eventName !== Hyperstore.EventManager.RemoveRelationshipEvent) {
                        return;
                    }
                    if (e.schemaId === self._collection.schemaRelationship.id && (e.startId === srcId) || (e.endId === endId)) {
                        if (e.eventName === Hyperstore.EventManager.AddRelationshipEvent) {
                            var rel = domain.store.get(e.id);
                            if (!rel)
                                return;
                            var mel = self._collection.source ? rel.getEnd() : rel.getStart();
                            if (!self._collection.filter || self._collection.filter(mel)) {
                                self.add(mel);
                            }
                        }
                        else {
                            var id = self._collection.source ? e.endId : e.startId;
                            self.remove(id);
                        }
                    }
                });
            });
            this.reset();
        }
        ModelElementArray.prototype.reset = function () {
            this.all = [];
            var opposite = !!this._collection.source;
            var cursor = this._collection.domain.getRelationships(this._collection.schemaRelationship, this._collection.source, this._collection.end);
            while (cursor.hasNext()) {
                var rel = cursor.next();
                var elem = opposite ? rel.getEnd() : rel.getStart();
                if (!this._collection.filter || this._collection.filter(elem)) {
                    this.add(elem);
                }
            }
        };
        ModelElementArray.prototype.dispose = function () {
            this._collection.domain.events.remove(this._sessionCompletedCookie);
            this.all = null;
        };
        ModelElementArray.prototype.remove = function (id) {
            for (var k = 0; k < this.all.length; k++) {
                if (this.all[k].getId() === id) {
                    this.all.splice(k, 1);
                    break;
                }
            }
        };
        ModelElementArray.prototype.add = function (mel) {
            this.all.push(mel);
        };
        return ModelElementArray;
    })();
    var ModelElementCollection = (function (_super) {
        __extends(ModelElementCollection, _super);
        function ModelElementCollection(source, schemaRelationship, opposite, filter) {
            if (opposite === void 0) { opposite = false; }
            _super.call(this);
            if (schemaRelationship.cardinality === 0 /* OneToOne */) {
                throw "Invalid cardinality. Use reference instead.";
            }
            var src = source.getInfo();
            if (!opposite && !src.schemaElement.isA(schemaRelationship.startSchemaId)) {
                throw "Invalid source type";
            }
            if (opposite && !src.schemaElement.isA(schemaRelationship.endSchemaId)) {
                throw "Invalid end type";
            }
            this.source = opposite ? undefined : source;
            this.end = opposite ? source : undefined;
            this.schemaRelationship = schemaRelationship;
            this.domain = source.getDomain();
            this.setFilter(filter);
        }
        ModelElementCollection.prototype.setFilter = function (where) {
            this.filter = where;
            if (this._items)
                this._items.reset();
        };
        Object.defineProperty(ModelElementCollection.prototype, "items", {
            get: function () {
                if (!this._items) {
                    this._items = new ModelElementArray(this);
                }
                return this._items.all;
            },
            enumerable: true,
            configurable: true
        });
        ModelElementCollection.prototype.hasNext = function () {
            while (true) {
                if (!this.cursor.hasNext())
                    return false;
                var rel = this.cursor.next();
                if (rel && rel.getEnd())
                    return true;
            }
        };
        ModelElementCollection.prototype.reset = function () {
            this.cursor = Hyperstore.Cursor.from(this.domain.getRelationships(this.schemaRelationship, this.source, this.end));
            if (this.filter)
                this.cursor = this.cursor.map(this.filter);
            this.cursor.reset();
        };
        ModelElementCollection.prototype.next = function () {
            return this.cursor.next().getEnd();
        };
        ModelElementCollection.prototype.dispose = function () {
            if (this._items)
                this._items.dispose();
        };
        ModelElementCollection.prototype.remove = function (mel) {
            if (mel == null) {
                return;
            }
            if (!mel.getInfo || mel.isDisposed) {
                var property = this.source ? this.schemaRelationship.startProperty : this.schemaRelationship.endProperty;
                throw "Invalid collection element '" + mel + "'. Must be a valid domain element for property " + property;
            }
            if ((this.source || this.end).isDisposed) {
                throw "Can not use a disposed element";
            }
            var source = this.source ? this.source : mel;
            var end = this.end ? this.end : mel;
            var cursor = this.domain.getRelationships(this.schemaRelationship, source, end);
            if (cursor.hasNext()) {
                var rel = cursor.next();
                this.domain.remove(rel.getId());
            }
        };
        ModelElementCollection.prototype.add = function (mel) {
            if (mel == null) {
                return;
            }
            if (!mel.getInfo || mel.isDisposed) {
                var property = this.source ? this.schemaRelationship.startProperty : this.schemaRelationship.endProperty;
                throw "Invalid collection element '" + mel + "'. Must be a valid domain element for property " + property;
            }
            if ((this.source || this.end).isDisposed) {
                throw "Can not use a disposed element";
            }
            var source = this.source ? this.source : mel;
            var end = (this.end ? this.end : mel).getInfo();
            this.domain.createRelationship(this.schemaRelationship, source, end.id, end.schemaElement.id);
        };
        return ModelElementCollection;
    })(Hyperstore.Cursor);
    Hyperstore.ModelElementCollection = ModelElementCollection;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    (function (ConstraintKind) {
        ConstraintKind[ConstraintKind["Check"] = 0] = "Check";
        ConstraintKind[ConstraintKind["Validate"] = 1] = "Validate";
    })(Hyperstore.ConstraintKind || (Hyperstore.ConstraintKind = {}));
    var ConstraintKind = Hyperstore.ConstraintKind;
    (function (MessageType) {
        MessageType[MessageType["Warning"] = 0] = "Warning";
        MessageType[MessageType["Error"] = 1] = "Error";
    })(Hyperstore.MessageType || (Hyperstore.MessageType = {}));
    var MessageType = Hyperstore.MessageType;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var ConstraintContext = (function () {
        function ConstraintContext(kind) {
            this.kind = kind;
            this.messages = new Array();
        }
        ConstraintContext.prototype.log = function (msg, messageType, propertyName) {
            if (messageType === void 0) { messageType = 0 /* Warning */; }
            var diag = new Hyperstore.DiagnosticMessage(messageType, msg, this.element, this.propertyName || propertyName);
            this.messages.push(diag);
        };
        return ConstraintContext;
    })();
    Hyperstore.ConstraintContext = ConstraintContext;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var ConstraintsManager = (function () {
        function ConstraintsManager(schema) {
            this.schema = schema;
            this._constraints = {};
        }
        ConstraintsManager.prototype.addPropertyConstraint = function (property, condition, message, asError, kind) {
            if (asError === void 0) { asError = false; }
            if (kind === void 0) { kind = 0 /* Check */; }
            var def = { condition: condition, message: message, error: asError, kind: kind };
            this.__setPropertyConstraint(property, def);
        };
        ConstraintsManager.prototype.__setPropertyConstraint = function (property, def, schema) {
            if (!def.condition) {
                return;
            }
            var condition = schema ? def.condition.bind(schema) : def.condition;
            var message = Hyperstore.DiagnosticMessage.__prepareMessage(def.message, schema) || "Constraint failed for element {id} {propertyName}";
            this.addConstraint(property.owner, {
                propertyName: property.name,
                messageType: def.messageType,
                execute: function (self, ctx) {
                    var pv = ctx.element.getInfo().domain.getPropertyValue(self.getInfo().id, property);
                    if (!pv) {
                        pv = new Hyperstore.PropertyValue(null, null, 0);
                    }
                    var result = null;
                    ctx.propertyName = property.name;
                    try {
                        if (!condition(pv.value, pv.oldValue, ctx)) {
                            result = Hyperstore.DiagnosticMessage.__format(message, ctx.element, property.name, pv.value, pv.oldValue);
                        }
                    }
                    catch (e) {
                        var txt = "Fatal error << " + e + " >> on property constraint " + message + " for property " + property.name;
                        ctx.log(txt, 1 /* Error */);
                    }
                    ctx.propertyName = undefined;
                    return result;
                },
                kind: def.kind
            });
        };
        ConstraintsManager.prototype.addConstraint = function (schemaElement, constraint) {
            var constraints = this._constraints[schemaElement.id];
            if (!constraints) {
                constraints = [];
                this._constraints[schemaElement.id] = constraints;
            }
            if (!constraint.execute) {
                var message = constraint.message || "Constraint failed for element {id}";
                constraint.execute = function (self, ctx) {
                    var result = null;
                    ctx.propertyName = null;
                    try {
                        if (!constraint.condition(self, ctx)) {
                            result = Hyperstore.DiagnosticMessage.__format(message, ctx.element, constraint.propertyName);
                        }
                    }
                    catch (e) {
                        var txt = "Fatal error << " + e + " >> on element constraint " + message;
                        ctx.log(txt, 1 /* Error */);
                    }
                    return result;
                };
            }
            constraints.push(constraint);
        };
        ConstraintsManager.prototype.__checkElements = function (elements) {
            return this.checkOrValidateElements(elements, 0 /* Check */);
        };
        ConstraintsManager.prototype.validate = function (elements) {
            if (elements.store)
                elements = elements.getElements();
            return this.checkOrValidateElements(elements, 1 /* Validate */);
        };
        ConstraintsManager.prototype.checkOrValidateElements = function (elements, kind) {
            var _this = this;
            var ctx = new Hyperstore.ConstraintContext(kind);
            Hyperstore.Utils.forEach(elements, function (mel) {
                try {
                    ctx.element = mel;
                    _this.checkCondition(ctx, mel.getInfo().schemaElement);
                }
                catch (e) {
                    ctx.log(e, 1 /* Error */);
                }
            });
            return ctx.messages;
        };
        ConstraintsManager.prototype.__dump = function () {
            for (var id in this._constraints) {
                console.log("Constraints for " + id);
                var constraints = this._constraints[id];
                for (var key in constraints) {
                    if (!constraints.hasOwnProperty(key))
                        continue;
                    var constraint = constraints[key];
                    var str = "Constraint";
                    if (constraint.propertyName)
                        str += " for property " + constraint.propertyName;
                    else
                        str += " for entity";
                    str += " message = '" + constraint.message + "'";
                    console.log(str);
                }
            }
        };
        ConstraintsManager.prototype.checkCondition = function (ctx, schemaElement) {
            var constraints = this._constraints[schemaElement.id];
            if (constraints) {
                for (var key in constraints) {
                    if (!constraints.hasOwnProperty(key))
                        continue;
                    var constraint = constraints[key];
                    if (constraint.kind <= ctx.kind) {
                        var msg = constraint.execute(ctx.element, ctx);
                        if (msg) {
                            ctx.log(msg, constraint.messageType, constraint.propertyName);
                        }
                    }
                }
            }
            var parentSchema = schemaElement.baseElement;
            if (parentSchema && parentSchema.kind !== 3 /* Primitive */) {
                this.checkCondition(ctx, parentSchema);
            }
        };
        return ConstraintsManager;
    })();
    Hyperstore.ConstraintsManager = ConstraintsManager;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var DiagnosticMessage = (function () {
        function DiagnosticMessage(messageType, message, element, propertyName) {
            this.messageType = messageType;
            this.message = message;
            this.element = element;
            this.propertyName = propertyName;
            if (element) {
                this.id = element.getInfo().id;
            }
        }
        DiagnosticMessage.prototype.toString = function () {
            return this.message;
        };
        DiagnosticMessage.__format = function (message, element, propertyName, val, old) {
            var self = this;
            var regex = /{\s*([^}\s]*)\s*}/g;
            return message.replace(regex, function (match, name) {
                switch (name) {
                    case "value":
                        return val;
                    case "_schema":
                        return element.getSchemaElement().id;
                    case "_identity":
                        return element.id || element.name || element.getKey(true) || element.getId();
                    case "_id":
                        return element.getId();
                    case "oldValue":
                        return old;
                    case "propertyName":
                        return propertyName;
                    default:
                        if (!element)
                            return null;
                        if (name[0] === '_') {
                            var info = element.getInfo();
                            return info[name.substring(1)];
                        }
                        return element[name];
                }
            });
        };
        DiagnosticMessage.__prepareMessage = function (msg, constraint) {
            if (!msg || !constraint)
                return msg;
            var regex = /{\s*\$([^}\s]*)\s*}/g;
            return msg.replace(regex, function (match, name) {
                return constraint[name];
            });
        };
        return DiagnosticMessage;
    })();
    Hyperstore.DiagnosticMessage = DiagnosticMessage;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var EventBus = (function () {
        function EventBus(store, eventDispatcher) {
            var _this = this;
            this.store = store;
            this.cookie = store.onSessionCompleted(function (s) { return _this.sendEvents(s); });
            this._channels = [];
            this.defaultEventDispatcher = eventDispatcher || new Hyperstore.EventDispatcher(store);
        }
        EventBus.prototype.dispose = function () {
            this.store.removeSessionCompleted(this.cookie);
            this._channels.forEach(function (c) { return c.close(); });
            this._channels = undefined;
        };
        EventBus.prototype.addChannel = function (channel) {
            this._channels.push(channel);
        };
        EventBus.prototype.start = function (callback) {
            var self = this;
            this._channels.forEach(function (c) {
                c.eventBus = self;
                c.start(callback);
            });
        };
        EventBus.prototype.sendEvents = function (s) {
            if (s.aborted || s.originStoreId !== this.store.storeId || s.result.hasErrorsOrWarnings) {
                return;
            }
            this._channels.forEach(function (c) { return c._sendEvents(s); });
        };
        return EventBus;
    })();
    Hyperstore.EventBus = EventBus;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var AbstractChannel = (function () {
        function AbstractChannel() {
        }
        AbstractChannel.prototype.associate = function (domain) {
            this.domain = domain;
        };
        AbstractChannel.prototype.start = function (callback) {
            this.dispatcher = this.domain.eventDispatcher || this.eventBus.defaultEventDispatcher;
        };
        AbstractChannel.prototype.close = function () {
            this.eventBus = null;
            this.dispatcher = null;
        };
        AbstractChannel.prototype._sendEvents = function (session) {
            if (session.originStoreId !== this.domain.store.storeId) {
                return;
            }
            var self = this;
            var message = {
                origin: self.domain.store.storeId,
                sessionId: session.sessionId,
                sessionMode: session.mode,
                events: Hyperstore.Utils.select(session.events, function (e) {
                    if (self._shouldBePropagated(e)) {
                        return { eventName: e.eventName, Data: JSON.stringify(e) };
                    }
                })
            };
            this.sendMessage(message);
        };
        AbstractChannel.prototype.sendMessage = function (message) {
            console.log("Message " + JSON.stringify(message));
        };
        AbstractChannel.prototype._shouldBePropagated = function (evt) {
            return evt.domain === this.domain.name && evt.TL;
        };
        return AbstractChannel;
    })();
    Hyperstore.AbstractChannel = AbstractChannel;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var JSONWriter = (function () {
        function JSONWriter() {
            this._stack = [];
            this._obj = {};
            this._stack.push(this._obj);
        }
        JSONWriter.prototype.stackHead = function () {
            return this._stack[this._stack.length - 1];
        };
        JSONWriter.prototype.newScope = function (tag) {
            var scope = this.stackHead()[tag] = [];
            this._stack.push(scope);
        };
        JSONWriter.prototype.pushElement = function (name, state, id, schemaId, startId, endStartId, endId, endSchemaId) {
            var scope = this.stackHead();
            var node = { id: id, schema: schemaId };
            if (state === 1 /* Removed */) {
                node.state = "deleted";
            }
            else {
                if (startId) {
                    node.startId = startId;
                    node.endStartId = endStartId;
                    node.endId = endId;
                    node.endSchemaId = endSchemaId;
                }
            }
            scope.push(node);
            this._current = node;
        };
        JSONWriter.prototype.pushProperty = function (tag, name, value) {
            var node = { name: name, value: value };
            if (!this._current.properties) {
                this._current.properties = [];
            }
            this._current.properties.push(node);
        };
        JSONWriter.prototype.reduceScope = function () {
            this._stack.pop();
            this._current = null;
        };
        JSONWriter.prototype.save = function (domain, monikers) {
            var scope = this.stackHead();
            scope.domain = domain.name;
            scope.mode = "HY";
            var schemas = [];
            scope.schemas = schemas;
            var group = new Hyperstore.HashTable();
            Hyperstore.Utils.forEach(monikers, function (m) {
                var g = group.get(m.schemaName);
                if (!g) {
                    g = [];
                    group.add(m.schemaName, g);
                }
                g.push(m);
            });
            Hyperstore.Utils.forEach(group.keys, function (schemaName) {
                var elements = [];
                var s = { name: schemaName, elements: elements };
                schemas.push(s);
                var list = group.get(schemaName);
                Hyperstore.Utils.forEach(list, function (m) {
                    elements.push({ id: m.moniker, name: m.key });
                });
            });
            return JSON.stringify(scope);
        };
        return JSONWriter;
    })();
    var DomainSerializer = (function () {
        function DomainSerializer(domain) {
            this._writer = new JSONWriter();
            this._domain = domain;
            this._monikerSeq = 0;
            this._monikers = new Hyperstore.HashTable();
        }
        DomainSerializer.save = function (domain, entities, relationships) {
            if (!domain || !(domain instanceof Hyperstore.DomainModel))
                throw "domain must be a valid instance of DomainModel";
            var ser = new DomainSerializer(domain);
            return ser.saveDomain(entities, relationships);
        };
        DomainSerializer.prototype.saveDomain = function (entities, relationships) {
            var that = this;
            return this.saveInternal((entities || this._domain.getEntities()).map(function (e) {
                var info = e.getInfo();
                return {
                    id: info.id,
                    schemaId: info.schemaElement.id,
                    properties: that.getPropertyValues(info.id, info.schemaElement)
                };
            }), (relationships || this._domain.getRelationships()).map(function (r) {
                var info = r.getInfo();
                return {
                    id: info.id,
                    schemaId: info.schemaElement.id,
                    startId: info.startId,
                    startSchemaId: info.startSchemaId,
                    endId: info.endId,
                    endSchemaId: info.endSchemaId,
                    properties: that.getPropertyValues(info.id, info.schemaElement)
                };
            }));
        };
        DomainSerializer.prototype.getPropertyValues = function (id, schema) {
            var _this = this;
            var props = [];
            var properties = schema.getProperties(true);
            properties.forEach(function (p) {
                if (p.kind !== 1 /* Calculated */) {
                    var v = _this._domain.getPropertyValue(id, p);
                    if (v)
                        props.push({ name: p.name, value: JSON.stringify(p.serialize(v.value)), version: v.version });
                }
            });
            return props;
        };
        DomainSerializer.saveChanges = function (domain) {
            if (!domain || !(domain instanceof Hyperstore.DomainModelScope))
                throw "domain must be a valid instance of DomainModelScope";
            var ser = new DomainSerializer(domain);
            var changes = domain.getChanges();
            var that = this;
            var entities = changes.map(function (c) {
                if (c.startId)
                    return;
                return {
                    id: c.id,
                    schemaId: c.schemaId,
                    state: c.state,
                    properties: DomainSerializer.preparePropertyValues(c.properties)
                };
            });
            var relationships = changes.map(function (c) {
                if (!c.startId)
                    return;
                return {
                    id: c.id,
                    schemaId: c.schemaId,
                    state: c.state,
                    startId: c.startId,
                    startSchemaId: c.startSchemaId,
                    endId: c.endId,
                    endSchemaId: c.endSchemaId,
                    properties: DomainSerializer.preparePropertyValues(c.properties)
                };
            });
            return ser.saveInternal(entities, relationships);
        };
        DomainSerializer.preparePropertyValues = function (properties) {
            var props = [];
            for (var p in properties) {
                var pv = properties[p];
                props.push({ name: p, value: pv.value, version: pv.version });
            }
            return props;
        };
        DomainSerializer.prototype.saveInternal = function (entities, relationships) {
            try {
                this.serializeEntities(entities);
                this.serializeRelationships(relationships);
                return this._writer.save(this._domain, this._monikers.values);
            }
            finally {
                this._monikers = null;
            }
        };
        DomainSerializer.prototype.serializeEntities = function (entities) {
            this._writer.newScope("entities");
            entities.reset();
            while (entities.hasNext()) {
                var e = entities.next();
                this._writer.pushElement("entity", e.state, this.getId(e.id), this.getSchemaMoniker(e.schemaId));
                this.serializeProperties(e);
            }
            this._writer.reduceScope();
        };
        DomainSerializer.prototype.serializeRelationships = function (relationships) {
            this._writer.newScope("relationships");
            relationships.reset();
            while (relationships.hasNext()) {
                var r = relationships.next();
                this._writer.pushElement("relationship", r.state, this.getId(r.id), this.getSchemaMoniker(r.schemaId), this.getId(r.startId), this.getSchemaMoniker(r.startSchemaId), this.getId(r.endId), this.getSchemaMoniker(r.endSchemaId));
                this.serializeProperties(r);
            }
            this._writer.reduceScope();
        };
        DomainSerializer.prototype.getSchemaMoniker = function (id) {
            var moniker = this._monikers.get(id);
            if (moniker)
                return moniker.moniker;
            this._monikerSeq++;
            var parts = id.split(':');
            var monikerId = "" + this._monikerSeq;
            this._monikers.add(id, { moniker: monikerId, key: parts[1], schemaName: parts[0] });
            return monikerId;
        };
        DomainSerializer.prototype.serializeProperties = function (elem) {
            var _this = this;
            elem.properties.forEach(function (p) {
                _this._writer.pushProperty("property", p.name, p.value);
            });
        };
        DomainSerializer.prototype.getId = function (id) {
            var parts = id.split(':');
            if (parts[0] === this._domain.name)
                return parts[1];
            return id;
        };
        return DomainSerializer;
    })();
    Hyperstore.DomainSerializer = DomainSerializer;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var UndoManager = (function () {
        function UndoManager(store) {
            this.store = store;
            this._infos = {};
            this._undos = [];
            this._redos = [];
        }
        Object.defineProperty(UndoManager.prototype, "canUndo", {
            get: function () {
                return this._undos.length > 0;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UndoManager.prototype, "canRedo", {
            get: function () {
                return this._redos.length > 0;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UndoManager.prototype, "savePoint", {
            get: function () {
                if (this._undos.length === 0) {
                    return undefined;
                }
                return this._undos[this._undos.length - 1].sessionId;
            },
            enumerable: true,
            configurable: true
        });
        UndoManager.prototype.clear = function () {
            this._undos = [];
            this._redos = [];
        };
        UndoManager.prototype.undo = function (toSavePoint) {
            if (this.canUndo) {
                this.performPop(this._undos, this._redos, 8 /* Undo */, toSavePoint);
            }
        };
        UndoManager.prototype.redo = function (toSavePoint) {
            if (this.canRedo) {
                this.performPop(this._redos, this._undos, 16 /* Redo */, toSavePoint);
            }
        };
        UndoManager.prototype.registerDomain = function (domain, dispatcher) {
            this._infos[domain.name] = {
                dispatcher: dispatcher || this.store.eventBus.defaultEventDispatcher,
                filter: undefined
            };
            this.Enabled = true;
            var self = this;
            domain.events.on(Hyperstore.EventManager.SessionCompleted, function (s) {
                if (!s.aborted && self.Enabled && (s.mode & (24 /* UndoOrRedo */ | 4 /* Loading */)) === 0) {
                    self.push.call(self, s);
                }
            });
        };
        UndoManager.prototype.performPop = function (mainStack, altStack, mode, toSavePoint) {
            var events = [];
            var session = this.store.beginSession({ mode: mode });
            var sid;
            try {
                var ln = mainStack.length - 1;
                for (var i = ln; i >= 0; i--) {
                    var info = mainStack[i];
                    if (toSavePoint && info.sessionId === toSavePoint) {
                        break;
                    }
                    mainStack.pop();
                    for (var j = info.events.length - 1; j >= 0; j--) {
                        var evt = info.events[j];
                        if (!evt.getReverseEvent) {
                            continue;
                        }
                        var reverse = evt.getReverseEvent(session.sessionId);
                        if (!reverse) {
                            continue;
                        }
                        this._infos[reverse.domain].dispatcher.handleEvent(reverse);
                        if (reverse.getReverseEvent) {
                            events.push(reverse);
                        }
                    }
                    sid = info.sessionId;
                    if (!toSavePoint) {
                        break;
                    }
                }
                session.acceptChanges();
                if (events.length > 0) {
                    altStack.push({ sessionId: sid, events: events });
                }
            }
            finally {
                session.close();
            }
        };
        UndoManager.prototype.push = function (session) {
            var _this = this;
            var events = Hyperstore.Utils.where(session.events, function (e) {
                var infos = _this._infos[e.domain];
                if (!infos) {
                    return false;
                }
                return infos.filter ? infos.filter(e) : true;
            });
            if (events.length === 0) {
                return;
            }
            this._redos = [];
            for (var i = this._undos.length - 1; i >= 0; i--) {
                var undo = this._undos[i];
                if (undo.sessionId === session.sessionId) {
                    undo.events = undo.events.concat(events);
                    return;
                }
            }
            this._undos.push({ sessionId: session.sessionId, events: events });
        };
        return UndoManager;
    })();
    Hyperstore.UndoManager = UndoManager;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var HashTable = (function (_super) {
        __extends(HashTable, _super);
        function HashTable(_throttle) {
            if (_throttle === void 0) { _throttle = 10; }
            _super.call(this);
            this._throttle = _throttle;
            this._values = [];
            this._keys = {};
            this._deleted = 0;
        }
        HashTable.prototype.reset = function () {
            this._ix = 0;
        };
        HashTable.prototype.hasNext = function () {
            while (true) {
                if (this._ix >= this._values.length) {
                    this._current = undefined;
                    return false;
                }
                this._current = this._values[this._ix++];
                if (this._current != null)
                    return true;
            }
        };
        HashTable.prototype.next = function () {
            return this._current;
        };
        HashTable.prototype.dispose = function () {
            this._keys = null;
            this._values = null;
        };
        HashTable.prototype.keyExists = function (key) {
            return key != null && this._keys[key.toString()] !== undefined;
        };
        HashTable.prototype._fastInsert = function (key, elem) {
            if (key == null)
                throw "key must not be null";
            this._keys[key.toString()] = this._values.push(elem) - 1;
        };
        HashTable.prototype.add = function (key, elem) {
            if (key == null)
                throw "key must not be null";
            var n = this._keys[key.toString()];
            if (n !== undefined)
                this._values[n] = elem;
            else
                this._keys[key.toString()] = this._values.push(elem) - 1;
        };
        HashTable.prototype.get = function (key) {
            if (key == null)
                return undefined;
            var n = this._keys[key.toString()];
            return n !== undefined ? this._values[n] : undefined;
        };
        HashTable.prototype.remove = function (key) {
            if (key == null)
                throw "key must not be null";
            var n = this._keys[key.toString()];
            if (n !== undefined) {
                this._deleted++;
                delete this._keys[key.toString()];
                if (this._deleted > this._throttle)
                    this.shrink();
                else
                    this._values[n] = null;
            }
        };
        HashTable.prototype.clone = function () {
            var clone = new HashTable();
            clone._values = new Array(this._values.length - this._deleted);
            for (var key in this._keys) {
                var n = this._keys[key.toString()];
                clone._keys[key.toString()] = n;
            }
            clone._deleted = this._deleted;
            clone._values = this._values.slice();
            clone._throttle = this._throttle;
            return clone;
        };
        HashTable.prototype.shrink = function () {
            var values = [];
            for (var key in this._keys) {
                var n = this._keys[key];
                var val = this._values[n];
                this._keys[key] = values.push(val) - 1;
            }
            this._values = values;
            this._deleted = 0;
        };
        Object.defineProperty(HashTable.prototype, "keys", {
            get: function () {
                var list = new Array(this._values.length - this._deleted);
                for (var k in this._keys)
                    list.push(k);
                return list;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(HashTable.prototype, "values", {
            get: function () {
                return Utils.select(this._values, function (v) { return v; });
            },
            enumerable: true,
            configurable: true
        });
        return HashTable;
    })(Hyperstore.Cursor);
    Hyperstore.HashTable = HashTable;
    var Utils = (function () {
        function Utils() {
        }
        Utils.Requires = function (val, name) {
            if (!val)
                throw name + " is required.";
        };
        Utils.splitIdentity = function (id) {
            return id ? id.split(Hyperstore.Store.IdSeparator) : [null, null];
        };
        Utils.getUtcNow = function () {
            var epochTicks = 621355968000000000;
            var ticksPerMillisecond = 10000;
            return epochTicks + (Utils.date.getTime() * ticksPerMillisecond);
        };
        Utils.newGuid = function () {
            var d = Utils.date.getTime();
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c === 'x' ? r : (r & 0x7 | 0x8)).toString(16);
            });
            return uuid;
        };
        Utils.isArray = function (value) {
            var s = typeof value;
            return value && typeof (value) === 'object' && value instanceof Array;
        };
        Utils.firstOrDefault = function (list, fn) {
            if (!list) {
                return;
            }
            if (list.length) {
                for (var i = 0; i < list.length; i++) {
                    var e = list[i];
                    if (e != null && (!fn || fn(e))) {
                        return e;
                    }
                }
            }
            else {
                for (var k in list) {
                    if (list.hasOwnProperty(k)) {
                        var e = list[k];
                        if (e != null && (!fn || fn(e))) {
                            return e;
                        }
                    }
                }
            }
            return undefined;
        };
        Utils.forEach = function (list, fn) {
            if (!list) {
                return;
            }
            if (list.length) {
                for (var i = 0; i < list.length; i++) {
                    var e = list[i];
                    if (e != null) {
                        fn(e);
                    }
                }
                return;
            }
            if (list.hasNext) {
                list.reset();
                while (list.hasNext()) {
                    var e = list.next();
                    if (e != null)
                        fn(e);
                }
                return;
            }
            for (var k in list) {
                if (list.hasOwnProperty(k)) {
                    var e = list[k];
                    if (e != null) {
                        fn(e);
                    }
                }
            }
        };
        Utils.reverse = function (list) {
            if (!list) {
                return undefined;
            }
            var list2 = [];
            0;
            if (list.length) {
                for (var i = list.length - 1; i >= 0; i--) {
                    var e = list[i];
                    if (e != null) {
                        list2.push(e);
                    }
                }
            }
            else {
                for (var k in list) {
                    if (list.hasOwnProperty(k)) {
                        var e = list[k];
                        if (e != null) {
                            list2.unshift(e);
                        }
                    }
                }
            }
            return list2;
        };
        Utils.where = function (list, fn) {
            var list2 = [];
            Utils.forEach(list, function (e) {
                if (fn(e)) {
                    list2.push(e);
                }
            });
            return list2;
        };
        Utils.indexOf = function (list, fn) {
            var ix = -1;
            Utils.forEach(list, function (e) {
                ix++;
                var r = fn(e);
                if (r) {
                    return ix;
                }
            });
            return -1;
        };
        Utils.select = function (list, fn) {
            var list2 = [];
            Utils.forEach(list, function (e) {
                var r = fn(e);
                if (r != null) {
                    list2.push(r);
                }
            });
            return list2;
        };
        Utils.selectMany = function (list, fn) {
            var list2 = [];
            Utils.forEach(list, function (e) {
                var r = fn(e);
                Utils.forEach(r, function (e2) {
                    list2.push(e2);
                });
            });
            return list2;
        };
        Utils.groupBy = function (list, fn) {
            var list2 = {};
            Utils.forEach(list, function (e) {
                var key = fn(e);
                var tmp = list2[key];
                if (!tmp) {
                    tmp = { key: key, value: [] };
                    list2[key] = tmp;
                }
                tmp.value.push(e);
            });
            return list2;
        };
        Utils.date = new Date();
        return Utils;
    })();
    Hyperstore.Utils = Utils;
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var Query = (function (_super) {
        __extends(Query, _super);
        function Query(store, _config, _schema) {
            _super.call(this);
            this._config = _config;
            this._schema = _schema;
            this._state = 0;
            this._subQueries = [];
            this._cx = 0;
            if (typeof (this._schema) == "string")
                this._schema = store.getSchemaElement(this._schema);
            for (var field in this._config) {
                if (!this._config.hasOwnProperty(field) || field[0] === '$')
                    continue;
                var ref = this._schema.getReference(field, true);
                if (ref) {
                    var schema = store.getSchemaElement(ref.schemaRelationship.endSchemaId);
                    this._subQueries.push(new BranchIterator(this._config[field], schema, field));
                }
            }
        }
        Query.prototype.reset = function () {
            this._cx = 0;
            this._state = 0;
            this._current = undefined;
            if (this._iterator)
                this._iterator.reset();
        };
        Query.prototype.setStart = function (obj) {
            this._iterator = Hyperstore.Cursor.from(obj);
            this.reset();
        };
        Query.prototype.hasNext = function () {
            while (true) {
                switch (this._state) {
                    case 0:
                        if (!this._iterator.hasNext()) {
                            this._state = 4;
                            break;
                        }
                        var elem = this._iterator.next();
                        if (!elem || !this.filter(elem, this._config))
                            break;
                        this._cx++;
                        if (this._config.$skip && this._cx <= this._config.$skip)
                            break;
                        if (this._config.$take && this._cx > this._config.$take)
                            break;
                        if (this._subQueries.length) {
                            this._iter = -1;
                            this._subQueries.forEach(function (q) { return q.setStart(elem); });
                            this._state = 2;
                        }
                        if (!this._subQueries.length || this._config.$select) {
                            this._current = elem;
                            return true;
                        }
                        break;
                    case 2:
                        this._iter++;
                        if (this._iter === this._subQueries.length) {
                            this._state = 0;
                            break;
                        }
                        else {
                            this._state = 3;
                            this._subQueries[this._iter].reset();
                        }
                    case 3:
                        if (!this._subQueries[this._iter].hasNext()) {
                            this._state = 2;
                        }
                        else {
                            this._current = this._subQueries[this._iter].next();
                            return true;
                        }
                        break;
                    case 4:
                        return false;
                }
            }
        };
        Query.prototype.filter = function (elem, config, flag) {
            if (flag === void 0) { flag = false; }
            var metadata = elem.getInfo();
            for (var field in config) {
                if (!config.hasOwnProperty(field))
                    continue;
                var val;
                var data = config[field];
                switch (field) {
                    case "$schema":
                        val = metadata.schemaElement.id;
                        break;
                    case "$filter":
                        if (data(elem) === flag)
                            return flag;
                        break;
                    case "$or":
                        if (this.filter(elem, data, true) === flag)
                            return flag;
                        break;
                    case "_id":
                        val = metadata.id;
                        break;
                    default:
                        if (field[0] == '$')
                            continue;
                        var prop = metadata.schemaElement.getProperty(field, true);
                        if (!prop)
                            continue;
                        val = elem.get(field);
                }
                var r = !flag;
                if (data instanceof RegExp) {
                    r = data.test(val);
                }
                else if (typeof (data) === "object") {
                    r = this.evalExpression(val, data);
                }
                else {
                    r = val === data;
                }
                if (r === flag)
                    return flag;
            }
            return !flag;
        };
        Query.prototype.evalExpression = function (val, expr) {
            for (var m in expr) {
                var lit = expr[m];
                switch (m) {
                    case "=":
                        break;
                }
            }
            return true;
        };
        Query.prototype.next = function () {
            return this._current;
        };
        return Query;
    })(Hyperstore.Cursor);
    Hyperstore.Query = Query;
    var BranchIterator = (function (_super) {
        __extends(BranchIterator, _super);
        function BranchIterator(config, schema, _name) {
            _super.call(this, schema.schema.store, config, schema);
            this._name = _name;
        }
        BranchIterator.prototype.setStart = function (obj) {
            _super.prototype.setStart.call(this, obj[this._name]);
        };
        return BranchIterator;
    })(Query);
})(Hyperstore || (Hyperstore = {}));
var Hyperstore;
(function (Hyperstore) {
    var Adapter = (function () {
        function Adapter(reset) {
            if (reset === void 0) { reset = false; }
            this.reset = reset;
        }
        Adapter.prototype.init = function (domain) {
            var _this = this;
            this.domain = domain;
            this._cookie = domain.store.onSessionCompleted(function (s) {
                var storeId = _this.domain.store.storeId;
                var originId = s.originStoreId;
                if (s.aborted || s.result.hasErrorsOrWarnings || !s.events || (originId && originId !== storeId) || (s.mode & 4 /* Loading */) === 4 /* Loading */) {
                    return;
                }
                var elements = Hyperstore.Utils.select(s.trackingData.involvedTrackedElements, function (e) { return (e.domain === _this.domain.name) ? e : undefined; });
                if (elements.length === 0) {
                    return;
                }
                _this.persistElements(s, elements);
            });
        };
        Adapter.prototype.dispose = function () {
            this.domain.store.removeSessionCompleted(this._cookie);
        };
        Adapter.prototype.persistElements = function (session, elements) {
        };
        Adapter.prototype.loadElementsAsync = function (filter) {
            return undefined;
        };
        return Adapter;
    })();
    Hyperstore.Adapter = Adapter;
})(Hyperstore || (Hyperstore = {}));
}));