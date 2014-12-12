var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};



(function (SchemaKind) {
    SchemaKind[SchemaKind["Entity"] = 0] = "Entity";
    SchemaKind[SchemaKind["Relationship"] = 1] = "Relationship";
    SchemaKind[SchemaKind["ValueObject"] = 2] = "ValueObject";
    SchemaKind[SchemaKind["Primitive"] = 3] = "Primitive";
})(exports.SchemaKind || (exports.SchemaKind = {}));
var SchemaKind = exports.SchemaKind;

(function (Cardinality) {
    Cardinality[Cardinality["OneToOne"] = 0] = "OneToOne";
    Cardinality[Cardinality["OneToMany"] = 1] = "OneToMany";
    Cardinality[Cardinality["ManyToOne"] = 2] = "ManyToOne";
    Cardinality[Cardinality["ManyToMany"] = 3] = "ManyToMany";
})(exports.Cardinality || (exports.Cardinality = {}));
var Cardinality = exports.Cardinality;

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
exports.SerializationContext = SerializationContext;

(function (PropertyKind) {
    PropertyKind[PropertyKind["Normal"] = 0] = "Normal";
    PropertyKind[PropertyKind["Calculated"] = 1] = "Calculated";
})(exports.PropertyKind || (exports.PropertyKind = {}));
var PropertyKind = exports.PropertyKind;

var Schema = (function () {
    function Schema(store, name, def) {
        this.store = store;
        this.name = name;
        this.constraints = new ConstraintsManager(this);
        if (def) {
            if (def.defineSchema) {
                def.defineSchema(this);
                delete def.defineSchema;
            } else {
                var parser = new DslParser(this, def);
                parser.parse(def);
            }
            for (var p in def) {
                if (def.hasOwnProperty(p) && p[0] === "$")
                    delete def[p];
            }
        }
    }
    Schema.prototype.__addSchemaElement = function (schemaInfo) {
        this.store.__addSchemaElement(schemaInfo);
    };
    return Schema;
})();
exports.Schema = Schema;

var DslParser = (function () {
    function DslParser(schema, def, dslSet) {
        if (typeof dslSet === "undefined") { dslSet = {}; }
        this.schema = schema;
        this.def = def;
        this.dslSet = dslSet;
    }
    DslParser.prototype.parse = function (dsl) {
        var _this = this;
        if (!dsl)
            return;

        var uri;
        if (dsl.$import && dsl.$import.$uri && !this.dslSet[dsl.$import.$uri]) {
            uri = dsl.$import.$uri;
            this.dslSet[dsl.$import.$uri] = true;
            var p = new DslParser(this.schema, this.def, this.dslSet);
            p.parse(dsl.$import);
        }

        this.pendings = [];
        this.parseValueObjects(dsl.$valueObjects);
        for (var name in dsl) {
            if (name[0] !== "$") {
                var o = dsl[name];
                if (o.$source)
                    this.parseRelationship(o, name);
                else
                    this.parseEntity(o, name);
            }
            delete dsl[name];
        }

        this.pendings.forEach(function (p) {
            return _this.createRelationship(p);
        });

        if (uri) {
        }
    };

    DslParser.prototype.parseEntity = function (o, name) {
        var base;
        if (o.$extend) {
            base = this.schema.store.getSchemaEntity(o.$extend);
            if (!base)
                throw "Unknown extended entity " + o.$extend;
        }
        var entity = new SchemaEntity(this.schema, name, base);
        this.def[name + "Schema"] = entity;
        for (var prop in o) {
            if (!o.hasOwnProperty(prop))
                continue;
            if (prop[0] === "$") {
                if (prop === "$constraints")
                    this.parseConstraints(o.$constraints, function (c) {
                        return entity.addConstraint(c.message, c.condition, c.error, c.kind);
                    });
                continue;
            }
            this.parseProperty(prop, o[prop], entity);
        }
    };

    DslParser.prototype.parsePropertyType = function (text) {
        var t = typeof (text);
        if (t === "string" && text.length > 0) {
            var re = /(.*)\((.*)\)/;
            var r = re.exec(text);
            if (r !== null) {
                var t2 = this.schema.store.getSchemaInfo(r[1]);
                if (t2.kind !== 2 /* ValueObject */)
                    throw "Type initializer can ony be used with valueObject. Incorrect type " + t;
                var vo = Object.create(t2);
                if (r.length === 3 && r[2]) {
                    re = /["']?(\w*)["']?\s*:\s*([^,]*)/g;
                    var init = JSON.parse('{' + r[2].replace(re, '"$1": $2') + '}');
                    this.extends(vo, init);
                }

                return vo;
            }
            t = text;
        }

        return this.schema.store.getSchemaInfo(t);
    };

    DslParser.prototype.parseProperty = function (name, o, entity) {
        var t = typeof (o);
        if (t === "object") {
            if (o.$type) {
                t = this.parsePropertyType(o.$type);
                if (!t)
                    throw "Unknown type " + o.$type;

                if (t.kind !== 2 /* ValueObject */ && t.kind !== 3 /* Primitive */) {
                    throw "Invalid type '" + o + "' Only value object or primitive is allowed for property " + name + ". Use reference instead.";
                }
                var p = entity.defineProperty(name, t, o.$default);
                this.parseConstraints(o.$constraints, function (c) {
                    return p.addConstraint(c.message, c.condition, c.error, c.kind);
                });
            } else {
                if (o.$end) {
                    this.pendings.push({
                        src: entity.id,
                        end: o.$end,
                        type: o.$kind,
                        name: o.$name,
                        property: name,
                        const: o.$constraints
                    });
                    return;
                }
                if (Utils.isArray(o)) {
                    this.pendings.push({
                        src: entity.id,
                        end: o[0],
                        property: name,
                        type: "1=>*"
                    });
                    return;
                }
                var cx = 0;
                for (var key in o) {
                    if (!o.hasOwnProperty(key))
                        continue;
                    cx++;
                    if (cx > 1)
                        throw "Invalid reference definition. Object must contain only one field. ex: { Book : '1=>*'} ";

                    this.pendings.push({
                        src: entity.id,
                        end: key,
                        type: o[key],
                        property: name
                    });
                }
            }
        } else if (t === "function") {
            entity.defineProperty(name, null, o, 1 /* Calculated */);
        } else {
            t = this.parsePropertyType(o);
            if (!t)
                throw "Unknown type " + o;

            if (t.kind !== 2 /* ValueObject */ && t.kind !== 3 /* Primitive */) {
                this.pendings.push({
                    src: entity.id,
                    end: t.id,
                    property: name,
                    type: "1->1"
                });
                return;
            }
            entity.defineProperty(name, t, undefined);
        }
    };

    DslParser.prototype.parseConstraints = function (constraints, callback) {
        if (!constraints)
            return;

        var def = constraints.$default || { kind: "check", error: false };
        def.kind = def.kind === "check" ? 0 /* Check */ : 1 /* Validate */;
        for (var msg in constraints) {
            if (!constraints.hasOwnProperty(msg) || msg[0] === '$')
                continue;
            var c = constraints[msg];
            var ct = {
                message: msg,
                kind: c.check ? 0 /* Check */ : c.validate ? 1 /* Validate */ : def.kind,
                error: c.error || def.error,
                condition: c.validate || c.check || c
            };
            callback(ct);
        }
    };

    DslParser.prototype.parseRelationship = function (o, name) {
        var base;
        if (o.$extend) {
            base = this.schema.store.getSchemaRelationship(o.$extend);
            if (!base)
                throw "Unknown extended relationship " + o.$extend;
        }

        this.pendings.push({
            src: o.$source,
            end: o.$end,
            type: o.$kind,
            obj: o,
            base: base,
            name: o.$name,
            const: o.$constraints
        });
    };

    DslParser.prototype.createRelationship = function (def) {
        var src = this.schema.store.getSchemaElement(def.src);
        var end = this.schema.store.getSchemaElement(def.end);

        var c = this.parseCardinality(def.type);
        if (c.opposite) {
            var t = src;
            src = end;
            end = t;
        }

        var name = def.name || src.name + (c.embedded ? 'Has' : 'References') + end.name;
        var rel = this.schema.store.getSchemaRelationship(name, false);
        if (rel) {
            if (rel.cardinality !== c.type || rel.startSchemaId !== src.id || rel.endSchemaId !== end.id || rel.embedded !== c.embedded)
                throw "Relationship mismatch with a previous definition for " + name;
            rel.baseElement = rel.baseElement || def.base;
        } else {
            rel = new SchemaRelationship(this.schema, name, src.id, end.id, c.embedded || false, c.type, undefined, undefined, def.base);
            this.def[name + "Schema"] = rel;
        }

        this.parseConstraints(def.const, function (c) {
            return rel.addConstraint(c.message, c.condition, c.error, c.kind);
        });

        if (def.property) {
            rel[c.opposite ? "endProperty" : "startProperty"] = def.property;
        }

        if (!def.obj)
            return;

        for (var prop in def.obj) {
            if (!def.obj.hasOwnProperty(prop) || prop[0] === "$")
                continue;
            this.parseProperty(prop, def.obj[prop], rel);
        }
    };

    DslParser.prototype.parseCardinality = function (c) {
        var re = /([1\*])(=|-|<)(-|=|>)([1\*])/;
        var m = re.exec(c);
        if (!m)
            throw "Invalid reference format. Must be [1|*]xx[1|*] with xx = ->, =>, <- or <= .";

        var op = m[2] === "<";
        var src = m[op ? 4 : 1];
        var end = m[op ? 1 : 4];
        var type = DslParser.cardinalities[src + end];

        return {
            opposite: op,
            embedded: m[op ? 3 : 2] === "=",
            type: type
        };
    };

    DslParser.prototype.parseValueObjects = function (values) {
        var _this = this;
        if (!values)
            return;
        for (var name in values) {
            if (!values.hasOwnProperty(name))
                continue;
            var val = values[name];
            var valueObject = new SchemaValueObject(this.schema, name);
            this.extends(valueObject, val, function (p) {
                if (p === "$type") {
                    var s = _this.schema.store.getSchemaInfo(val[p]);
                    valueObject.parent = s;
                } else if (p === "$constraints") {
                    _this.parseConstraints(val.$constraints, function (c) {
                        return valueObject.addConstraint(c.message, c.condition, c.error, c.kind);
                    });
                }
            });
        }
    };

    DslParser.prototype.extends = function (v, o, callback) {
        if (!o)
            return;
        for (var p in o) {
            if (o.hasOwnProperty(p)) {
                if (p[0] === "$") {
                    if (callback)
                        callback(p);
                } else
                    v[p] = o[p];
            }
        }
    };
    DslParser.cardinalities = {
        "11": 0 /* OneToOne */,
        "1*": 1 /* OneToMany */,
        "*1": 2 /* ManyToOne */,
        "**": 3 /* ManyToMany */
    };
    return DslParser;
})();

var SchemaInfo = (function () {
    function SchemaInfo(schema, kind, id) {
        this.schema = schema;
        this.kind = kind;
        this.id = id;
        this.name = id.indexOf('.') <= 0 || (schema.name && id.substr(0, schema.name.length) !== schema.name) ? id : id.substr(schema.name.length + 1);

        this.id = schema.name ? schema.name + ":" + this.name : id;
    }
    SchemaInfo.prototype.deserialize = function (ctx) {
        return ctx.value;
    };
    SchemaInfo.prototype.serialize = function (value) {
        return value;
    };
    return SchemaInfo;
})();
exports.SchemaInfo = SchemaInfo;

var SchemaElement = (function (_super) {
    __extends(SchemaElement, _super);
    function SchemaElement(schema, kind, id, baseElement) {
        _super.call(this, schema, kind, id);
        this.baseElement = baseElement;
        this._properties = {};
        this._references = {};
        this.proto = Object.create(baseElement ? baseElement.proto : ModelElement.prototype);
    }
    SchemaElement.prototype.getProperties = function (recursive) {
        var list = [];
        Utils.forEach(this._properties, function (v) {
            list.push(v);
        });
        if (recursive && this.baseElement) {
            list = list.concat(this.baseElement.getProperties(true));
        }
        return list;
    };
    SchemaElement.prototype._getReferences = function (recursive) {
        var list = [];
        Utils.forEach(this._references, function (v) {
            list.push(v);
        });
        if (recursive && this.baseElement) {
            list = list.concat(this.baseElement._getReferences(true));
        }
        return list;
    };
    SchemaElement.prototype.getReference = function (name, recursive) {
        if (typeof recursive === "undefined") { recursive = true; }
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
        if (typeof recursive === "undefined") { recursive = true; }
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
        if (typeof kind === "undefined") { kind = 0 /* Normal */; }
        var desc;
        if (name.name) {
            desc = name;
            name = desc.name;
        } else {
            desc = new SchemaProperty(name, schema, defaultValue, kind);
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

        if (desc.kind == 0 /* Normal */) {
            Object.defineProperty(this.proto, desc.name, {
                enumerable: true,
                configurable: true,
                get: function () {
                    return ModelElement.prototype.getPropertyValue.call(this, desc);
                },
                set: function (value) {
                    ModelElement.prototype.setPropertyValue.call(this, desc, value);
                }
            });
        } else {
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

            try  {
                Object.defineProperty(this.proto, desc.name, {
                    enumerable: true,
                    configurable: false,
                    get: code
                });
            } catch (e) {
                throw "Error on " + desc.name + "property definition for " + this.id + " - " + e;
            }
        }

        return desc;
    };
    SchemaElement.prototype.isA = function (schema) {
        var s = schema;
        var id = schema.id;
        if (!id) {
            s = this.schema.store.getSchemaInfo(schema, false);
            if (!s)
                return false;
            id = s.id;
        }
        if (id === this.id) {
            return true;
        }

        if (this.baseElement) {
            return this.baseElement.isA(s);
        }

        return false;
    };

    SchemaElement.prototype.deserialize = function (ctx) {
        var mel = Object.create(this.proto);

        mel.__initialize(ctx.domain, ctx.id, this, ctx.startId, ctx.startSchemaId, ctx.endId, ctx.endSchemaId);

        Utils.forEach(this._references, function (info) {
            var refName = "__ref" + info.name + "__";
            if (!info.isCollection) {
                mel[refName] = new ReferenceHandler(mel, info.schemaRelationship, info.opposite);
            } else {
                mel[refName] = new ModelElementCollection(mel, info.schemaRelationship, info.opposite);
                Object.defineProperty(mel, info.name, {
                    configurable: true,
                    enumerable: true,
                    value: mel[refName]
                });
            }
        });
        return mel;
    };

    SchemaElement.prototype.addConstraint = function (message, constraint, asError, kind, propertyName) {
        if (typeof asError === "undefined") { asError = false; }
        if (typeof kind === "undefined") { kind = 0 /* Check */; }
        this.schema.constraints.addConstraint(this, {
            kind: kind,
            condition: constraint,
            message: message,
            messageType: asError ? 1 /* Error */ : 0 /* Warning */,
            propertyName: propertyName
        });
    };
    return SchemaElement;
})(SchemaInfo);
exports.SchemaElement = SchemaElement;
var ReferenceHandler = (function () {
    function ReferenceHandler(_source, _schemaRelationship, _opposite) {
        this._source = _source;
        this._schemaRelationship = _schemaRelationship;
        this._opposite = _opposite;
    }
    ReferenceHandler.prototype.getReference = function () {
        if (this._source.disposed) {
            throw "Can not use a disposed element";
        }

        if (!this.relationship) {
            var start = this._opposite ? undefined : this._source;
            var end = this._opposite ? this._source : undefined;
            var cursor = this._source.domain.findRelationships(this._schemaRelationship, start, end);
            this.relationship = cursor.hasNext() ? cursor.next() : undefined;
        }

        if (!this.relationship) {
            return undefined;
        }

        return this._opposite ? this.relationship.start : this.relationship.end;
    };
    ReferenceHandler.prototype.setReference = function (v) {
        if (this._source.disposed) {
            throw "Can not use a disposed element";
        }

        var other = v;

        var start = this._opposite ? undefined : this._source;
        var end = this._opposite ? this._source : undefined;

        if (this.relationship) {
            var cursor = this._source.domain.findRelationships(this._schemaRelationship, start, end);
            this.relationship = cursor.hasNext() ? cursor.next() : undefined;
        }
        start = this._opposite ? other : this._source;
        end = this._opposite ? this._source : other;

        if (this.relationship) {
            if (other && this.relationship.startId === start.id && this.relationship.endId === other.id) {
                return;
            }
            this._source.domain.remove(this.relationship.id);
        }

        this.relationship = undefined;

        if (other) {
            this.relationship = this._source.domain.createRelationship(this._schemaRelationship, start, end.id, end.schemaElement.id);
        }
    };
    return ReferenceHandler;
})();

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
        return domain.createEntity(this, id, version);
    };
    return SchemaEntity;
})(SchemaElement);
exports.SchemaEntity = SchemaEntity;

var SchemaProperty = (function () {
    function SchemaProperty(name, schemaProperty, defaultValue, kind) {
        if (typeof kind === "undefined") { kind = 0 /* Normal */; }
        this.name = name;
        this.schemaProperty = schemaProperty;
        this.defaultValue = defaultValue;
        this.kind = kind;
    }
    SchemaProperty.prototype.deserialize = function (ctx) {
        return ctx.value && this.schemaProperty.deserialize(ctx);
    };

    SchemaProperty.prototype.serialize = function (value) {
        return value && this.schemaProperty.serialize(value);
    };

    SchemaProperty.prototype.addConstraint = function (message, condition, asError, kind) {
        if (typeof kind === "undefined") { kind = 1 /* Validate */; }
        this.owner.schema.constraints.addPropertyConstraint(this, condition, message, asError, kind);
        return this;
    };
    return SchemaProperty;
})();
exports.SchemaProperty = SchemaProperty;

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
})(SchemaElement);
exports.SchemaRelationship = SchemaRelationship;

var SchemaValueObject = (function (_super) {
    __extends(SchemaValueObject, _super);
    function SchemaValueObject(schema, id, parent) {
        _super.call(this, schema, 2 /* ValueObject */, id);
        this.parent = parent;
        schema.__addSchemaElement(this);
    }
    SchemaValueObject.prototype.addConstraint = function (message, condition, asError, kind) {
        if (typeof asError === "undefined") { asError = true; }
        if (typeof kind === "undefined") { kind = 1 /* Validate */; }
        this.constraints = this.constraints || [];
        this.constraints.push({
            kind: kind,
            condition: condition,
            message: message,
            messageType: asError ? 1 /* Error */ : 0 /* Warning */
        });
    };
    return SchemaValueObject;
})(SchemaInfo);
exports.SchemaValueObject = SchemaValueObject;

var Primitive = (function (_super) {
    __extends(Primitive, _super);
    function Primitive(schema, id, message, condition, asError, kind) {
        if (typeof asError === "undefined") { asError = true; }
        if (typeof kind === "undefined") { kind = 1 /* Validate */; }
        _super.call(this, schema, id);
        if (condition)
            this.addConstraint(message, condition, asError, kind ? 0 /* Check */ : 1 /* Validate */);
        this.kind = 3 /* Primitive */;
    }
    return Primitive;
})(SchemaValueObject);
exports.Primitive = Primitive;

var Utils = (function () {
    function Utils() {
    }
    Utils.Requires = function (val, name) {
        if (!val)
            throw name + " is required.";
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
                if (e && (!fn || fn(e))) {
                    return e;
                }
            }
        } else {
            for (var k in list) {
                if (list.hasOwnProperty(k)) {
                    var e = list[k];
                    if (e && (!fn || fn(e))) {
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
                if (e) {
                    fn(e);
                }
            }
        } else {
            for (var k in list) {
                if (list.hasOwnProperty(k)) {
                    var e = list[k];
                    if (e) {
                        fn(e);
                    }
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
                if (e) {
                    list2.push(e);
                }
            }
        } else {
            for (var k in list) {
                if (list.hasOwnProperty(k)) {
                    var e = list[k];
                    if (e) {
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
            if (r) {
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
exports.Utils = Utils;

(function (SessionMode) {
    SessionMode[SessionMode["Normal"] = 0] = "Normal";
    SessionMode[SessionMode["Loading"] = 4] = "Loading";
    SessionMode[SessionMode["Undo"] = 8] = "Undo";
    SessionMode[SessionMode["Redo"] = 16] = "Redo";
    SessionMode[SessionMode["UndoOrRedo"] = 24] = "UndoOrRedo";
    SessionMode[SessionMode["Serializing"] = 32] = "Serializing";
    SessionMode[SessionMode["SilentMode"] = 64] = "SilentMode";
    SessionMode[SessionMode["Rollback"] = 2048] = "Rollback";
})(exports.SessionMode || (exports.SessionMode = {}));
var SessionMode = exports.SessionMode;

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
        this.trackingData = new TrackingData();
        this.result = new SessionResult(this);
        this.result.maxVersionNumber = 0;

        if (config && config.origin) {
            this.originStoreId = config.origin;
        }

        if (config && config.sessionId) {
            this.sessionId = config.sessionId;
        } else {
            Session._sequence++;
            this.sessionId = Session._sequence;
        }
        if (config) {
            if (config.mode) {
                this.mode = config.mode;
            }
        }
        this.__nextLevel();
    }
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

        this.aborted = this.aborted || this.result.hasErrors;
        if (this.aborted) {
            this.mode = this.mode | 2048 /* Rollback */;
            var d = this.store.eventBus.defaultEventDispatcher;
            this.events.reverse().forEach(function (e) {
                if (e.getReverseEvent)
                    d.handleEvent(e.getReverseEvent());
            });
        }
        Session.current = undefined;
        var self = this;
        if (!this.aborted && !this.result.hasErrorsOrWarnings) {
            this.store.domains.forEach(function (d) {
                d.events.__notifySessionCompleted(self);
            });
        }
        this.store.__sendSessionCompletedEvent(self);
        if (this.result.hasErrors && !(this.mode & 64 /* SilentMode */))
            throw { message: "Session failed", result: this.result };

        return this.result;
    };

    Session.prototype.executeConstraints = function (elements) {
        var constraintsManager = Utils.groupBy(elements, function (e) {
            return e.schemaElement.schema.constraints;
        });

        var messages = [];
        Utils.forEach(constraintsManager, function (m) {
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

        this.events.push(evt);
        this.trackingData.__onEvent(evt);
        if (evt.version > this.result.maxVersionNumber) {
            this.result.maxVersionNumber = evt.version;
        }
    };
    Session._sequence = 0;
    return Session;
})();
exports.Session = Session;

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
        for (var _i = 0; _i < (arguments.length - 3); _i++) {
            args[_i] = arguments[_i + 3];
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
    return SessionResult;
})();
exports.SessionResult = SessionResult;

(function (TrackingState) {
    TrackingState[TrackingState["Added"] = 0] = "Added";
    TrackingState[TrackingState["Removed"] = 1] = "Removed";
    TrackingState[TrackingState["Updated"] = 2] = "Updated";
    TrackingState[TrackingState["Unknown"] = 3] = "Unknown";
})(exports.TrackingState || (exports.TrackingState = {}));
var TrackingState = exports.TrackingState;


var TrackingData = (function () {
    function TrackingData() {
        this._trackings = {};
    }
    Object.defineProperty(TrackingData.prototype, "involvedTrackedElements", {
        get: function () {
            return Utils.select(this._trackings, function (t) {
                return t;
            });
        },
        enumerable: true,
        configurable: true
    });

    TrackingData.prototype.__prepareTrackedElements = function (store) {
        var _this = this;
        var list = {};

        Utils.forEach(this.involvedTrackedElements, function (t) {
            if (list[t.id]) {
                return;
            }

            if (t.state !== 1 /* Removed */) {
                var mel = store.get(t.id);
                if (mel) {
                    list[mel.id] = mel;
                }
            }

            if (!t.startId) {
                return;
            }

            if (!list[t.startId] && _this.getTrackedElementState(t.startId) !== 1 /* Removed */) {
                var mel = store.get(t.startId);
                if (mel) {
                    list[mel.id] = mel;
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
                    list[mel.id] = mel;
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

        return Utils.select(list, function (kv) {
            return kv;
        });
    };

    TrackingData.prototype.getTrackedElementsByState = function (state) {
        return Utils.select(this._trackings, function (t) {
            return function (t) {
                return t.state === state ? t : undefined;
            };
        });
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
            case EventManager.AddEntityEvent:
                this._trackings[evt.id] = {
                    domain: evt.domain,
                    state: 0 /* Added */,
                    id: evt.id,
                    schemaId: evt.schemaId,
                    version: evt.version
                };
                break;
            case EventManager.RemoveEntityEvent:
                var info = this._trackings[evt.id];
                if (!info) {
                    info.state = 1 /* Removed */;
                } else {
                    this._trackings[evt.id] = {
                        domain: evt.domain,
                        state: 1 /* Removed */,
                        id: evt.id,
                        schemaId: evt.schemaId,
                        version: evt.version
                    };
                }
                break;
            case EventManager.AddRelationshipEvent:
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
            case EventManager.RemoveRelationshipEvent:
                var info = this._trackings[evt.id];
                if (!info) {
                    info.state = 1 /* Removed */;
                } else {
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
            case EventManager.ChangePropertyValueEvent:
                var info = this._trackings[evt.id];
                if (!info) {
                    info = { domain: evt.domain, state: 2 /* Updated */, id: evt.id, schemaId: evt.schemaId };
                    this._trackings[evt.id] = info;
                }

                if (!info.properties) {
                    info.properties = {};
                }

                var pv = new PropertyValue(evt.value, evt.oldValue, evt.version);

                info.properties[evt.propertyName] = pv;
                if (evt.version > info.version) {
                    info.version = evt.version;
                }
                break;
        }
    };
    return TrackingData;
})();
exports.TrackingData = TrackingData;


var AbstractEvent = (function () {
    function AbstractEvent(eventName, domain, correlationId, version) {
        this.eventName = eventName;
        this.domain = domain;
        this.correlationId = correlationId;
        this.version = version;
        this.TL = true;
    }
    AbstractEvent.prototype.toString = function () {
        return JSON.stringify(this);
    };
    return AbstractEvent;
})();
exports.AbstractEvent = AbstractEvent;

var AddEntityEvent = (function (_super) {
    __extends(AddEntityEvent, _super);
    function AddEntityEvent(domain, id, schemaId, correlationId, version) {
        _super.call(this, EventManager.AddEntityEvent, domain, correlationId, version);
        this.id = id;
        this.schemaId = schemaId;
    }
    AddEntityEvent.prototype.getReverseEvent = function (correlationId) {
        return new RemoveEntityEvent(this.domain, this.id, this.schemaId, correlationId, this.version);
    };
    return AddEntityEvent;
})(AbstractEvent);
exports.AddEntityEvent = AddEntityEvent;

var RemoveEntityEvent = (function (_super) {
    __extends(RemoveEntityEvent, _super);
    function RemoveEntityEvent(domain, id, schemaId, correlationId, version) {
        _super.call(this, EventManager.RemoveEntityEvent, domain, correlationId, version);
        this.id = id;
        this.schemaId = schemaId;
    }
    RemoveEntityEvent.prototype.getReverseEvent = function (correlationId) {
        return new AddEntityEvent(this.domain, this.id, this.schemaId, correlationId, this.version);
    };
    return RemoveEntityEvent;
})(AbstractEvent);
exports.RemoveEntityEvent = RemoveEntityEvent;

var AddRelationshipEvent = (function (_super) {
    __extends(AddRelationshipEvent, _super);
    function AddRelationshipEvent(domain, id, schemaId, startId, startSchemaId, endId, endSchemaId, correlationId, version) {
        _super.call(this, EventManager.AddRelationshipEvent, domain, correlationId, version);
        this.id = id;
        this.schemaId = schemaId;
        this.startId = startId;
        this.startSchemaId = startSchemaId;
        this.endId = endId;
        this.endSchemaId = endSchemaId;
    }
    AddRelationshipEvent.prototype.getReverseEvent = function (correlationId) {
        return new RemoveRelationshipEvent(this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId, correlationId, this.version);
    };
    return AddRelationshipEvent;
})(AbstractEvent);
exports.AddRelationshipEvent = AddRelationshipEvent;

var RemoveRelationshipEvent = (function (_super) {
    __extends(RemoveRelationshipEvent, _super);
    function RemoveRelationshipEvent(domain, id, schemaId, startId, startSchemaId, endId, endSchemaId, correlationId, version) {
        _super.call(this, EventManager.RemoveRelationshipEvent, domain, correlationId, version);
        this.id = id;
        this.schemaId = schemaId;
        this.startId = startId;
        this.startSchemaId = startSchemaId;
        this.endId = endId;
        this.endSchemaId = endSchemaId;
    }
    RemoveRelationshipEvent.prototype.getReverseEvent = function (correlationId) {
        return new AddRelationshipEvent(this.domain, this.id, this.schemaId, this.startId, this.startSchemaId, this.endId, this.endSchemaId, correlationId, this.version);
    };
    return RemoveRelationshipEvent;
})(AbstractEvent);
exports.RemoveRelationshipEvent = RemoveRelationshipEvent;

var ChangePropertyValueEvent = (function (_super) {
    __extends(ChangePropertyValueEvent, _super);
    function ChangePropertyValueEvent(domain, id, schemaId, propertyName, value, oldValue, correlationId, version) {
        _super.call(this, EventManager.ChangePropertyValueEvent, domain, correlationId, version);
        this.id = id;
        this.schemaId = schemaId;
        this.propertyName = propertyName;
        this.value = value;
        this.oldValue = oldValue;
    }
    ChangePropertyValueEvent.prototype.getReverseEvent = function (correlationId) {
        return new ChangePropertyValueEvent(this.domain, this.id, this.schemaId, this.propertyName, this.oldValue, this.value, correlationId, this.version);
    };
    return ChangePropertyValueEvent;
})(AbstractEvent);
exports.ChangePropertyValueEvent = ChangePropertyValueEvent;

var RemovePropertyEvent = (function (_super) {
    __extends(RemovePropertyEvent, _super);
    function RemovePropertyEvent(domain, id, schemaId, propertyName, value, correlationId, version) {
        _super.call(this, EventManager.RemovePropertyEvent, domain, correlationId, version);
        this.id = id;
        this.schemaId = schemaId;
        this.propertyName = propertyName;
        this.value = value;
        this.TL = false;
    }
    RemovePropertyEvent.prototype.getReverseEvent = function (correlationId) {
        return new ChangePropertyValueEvent(this.domain, this.id, this.schemaId, this.propertyName, this.value, undefined, correlationId, this.version);
    };
    return RemovePropertyEvent;
})(AbstractEvent);
exports.RemovePropertyEvent = RemovePropertyEvent;



var EventDispatcher = (function () {
    function EventDispatcher(store) {
        this.store = store;
        this._handlers = {};
        this.registerHandler({
            eventName: EventManager.AddEntityEvent, execute: function (d, evt) {
                var schema = d.store.getSchemaEntity(evt.schemaId);
                d.createEntity(schema, evt.id, evt.version);
            }
        });

        this.registerHandler({
            eventName: EventManager.RemoveEntityEvent, execute: function (d, evt) {
                var mel = d.get(evt.id);
                if (!mel) {
                    throw "Invalid element";
                }
                d.remove(mel.id, evt.version);
            }
        });

        this.registerHandler({
            eventName: EventManager.AddRelationshipEvent, execute: function (d, evt) {
                var schema = d.store.getSchemaRelationship(evt.schemaId);
                var start = d.get(evt.startId);
                if (!start) {
                    throw "Invalid source element for relationship " + evt.id;
                }
                d.createRelationship(schema, start, evt.endId, evt.endSchemaId, evt.id, evt.version);
            }
        });

        this.registerHandler({
            eventName: EventManager.RemoveRelationshipEvent, execute: function (d, evt) {
                var mel = d.get(evt.id);
                if (!mel) {
                    throw "Invalid element";
                }
                d.remove(mel.id, evt.version);
            }
        });

        this.registerHandler({
            eventName: EventManager.ChangePropertyValueEvent, execute: function (d, evt) {
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
        if (!Session.current) {
            throw "Session required.";
        }

        var key = event.eventName;
        var flag = this.executeHandlers(key, event);
        if (this.executeHandlers("*", event)) {
            flag = true;
        }

        if (!flag && event.correlationId !== Session.current.sessionId && !Session.current.closed) {
            Session.current.addEvent(event);
        }
    };

    EventDispatcher.prototype.executeHandlers = function (key, event) {
        var handlers = this._handlers[key];
        if (!handlers) {
            return false;
        }
        var domain = this.store.getDomain(event.domain);
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
exports.EventDispatcher = EventDispatcher;

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
                return Object.create(AddEntityEvent);
            case EventManager.RemoveEntityEvent:
                return Object.create(RemoveEntityEvent);
            case EventManager.AddRelationshipEvent:
                return Object.create(AddRelationshipEvent);
            case EventManager.ChangePropertyValueEvent:
                return Object.create(ChangePropertyValueEvent);
            case EventManager.RemoveRelationshipEvent:
                return Object.create(RemoveRelationshipEvent);
            case EventManager.RemovePropertyEvent:
                return Object.create(RemovePropertyEvent);
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
        var pos = Utils.indexOf(this._subscriptions, function (s) {
            return s.ix === cookie;
        });
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
            events: session.events.filter(function (e) {
                return e.domain === _this.domain;
            })
        };

        for (var i = 0; i < si.events.length; i++) {
            var evt = si.events[i];
            var list = this._subscriptions[evt.eventName];
            if (!list)
                continue;

            Utils.forEach(list, function (s) {
                return s.fn(si, evt);
            });
        }

        var list = this._subscriptions[EventManager.SessionCompleted];
        if (!list)
            return;
        Utils.forEach(list, function (s) {
            return s.fn(si);
        });
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
exports.EventManager = EventManager;

var PropertyValue = (function () {
    function PropertyValue(value, oldValue, version) {
        this.value = value;
        this.oldValue = oldValue;
        this.version = version;
    }
    return PropertyValue;
})();
exports.PropertyValue = PropertyValue;


var Store = (function () {
    function Store() {
        this._subscriptions = [];
        this.eventBus = new EventBus(this);
        this.schemas = {};
        this.schemasBySimpleName = {};
        this._domains = new Array();
        new Schema(this, "$", this.primitiveSchemaDefinition());
    }
    Store.prototype.initAsync = function (config) {
        var _this = this;
        var p = Q.defer();

        this.storeId = Utils.newGuid();
        if (!config) {
            p.resolve(this);
            return p.promise;
        }

        if (typeof config === 'function')
            config = config();

        if (!config.schemas) {
            this.storeId = config;
            p.resolve(this);
            return p.promise;
        }

        this["config"] = config;

        if (config.storeId)
            this.storeId = config.storeId;

        if (config.schemas) {
            for (var schemaName in config.schemas) {
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
                    var adapters = typeof (def.$adapters) === "function" ? def.$adapters() : def.$adapters;
                    delete def.$adapters;
                }

                if (adapters && adapters.forEach) {
                    adapters.forEach(function (a) {
                        return domain.addAdapter(a);
                    });
                }
                var result = this.populateDomain(def, domain);
                if (result)
                    result.async().then(function () {
                        return p.resolve(_this);
                    });
                else
                    p.resolve(this);
            }

            this.defaultDomainModel = this.getDomain(config.defaultDomainModel);
        }

        return p.promise;
    };

    Store.prototype.populateDomain = function (def, domain) {
        if (!def || domain.find().hasNext())
            return;

        if (def.$seed) {
            if (typeof (def.$seed) === "function") {
                var session = domain.store.beginSession();
                try  {
                    def.$seed(domain);
                    session.acceptChanges();
                } finally {
                    var r = session.close();
                    return r.result;
                }
            } else if (typeof (def.$seed) === "string") {
            }
            return;
        }

        for (var name in def) {
            if (!def.hasOwnProperty(name))
                continue;
            var root = domain.store.getSchemaElement(name);
            domain.loadFromJson(def[name], root);
        }
    };

    Store.prototype.dispose = function () {
        this.eventBus.dispose();
        this.eventBus = undefined;
        this.domains.forEach(function (d) {
            return d.dispose();
        });
        this._domains = undefined;
        this.schemas = undefined;
        this.schemasBySimpleName = undefined;
        this._subscriptions = undefined;
    };

    Store.prototype.unloadDomain = function (domain) {
        domain.dispose();
        var pos = this._domains.indexOf(domain);
        this._domains.splice(pos);
    };

    Object.defineProperty(Store.prototype, "domains", {
        get: function () {
            return this._domains;
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
        var pos = Utils.indexOf(this._subscriptions, function (s) {
            return s.ix === cookie;
        });
        if (pos >= 0) {
            this._subscriptions.splice(pos, 1);
        }
    };

    Store.prototype.__sendSessionCompletedEvent = function (session) {
        this._subscriptions.forEach(function (s) {
            return s.fn(session);
        });
    };

    Store.prototype.primitiveSchemaDefinition = function () {
        return {
            defineSchema: function (schema) {
                new Primitive(schema, "string");
                new Primitive(schema, "number");
                new Primitive(schema, "bool");
                new Primitive(schema, "[]");
            }
        };
    };

    Store.prototype.getDomain = function (name) {
        for (var i = 0; i < this._domains.length; i++) {
            var d = this._domains[i];
            if (d.name === name) {
                return d;
            }
        }
        return undefined;
    };

    Store.prototype.__addDomain = function (domain) {
        this._domains.push(domain);
    };

    Store.prototype.beginSession = function (config) {
        if (!Session.current) {
            config = config || {};
            config.defaultDomain = config.defaultDomain || this.defaultDomainModel;
            Session.current = new Session(this, config);
        } else {
            Session.current.__nextLevel();
        }

        return Session.current;
    };

    Store.prototype.__addSchemaElement = function (schemaInfo) {
        var id = schemaInfo.id.toLowerCase();
        if (this.schemas[id]) {
            throw "Duplicate schema " + schemaInfo.id;
        }

        this.schemas[id] = schemaInfo;
        var pos = id.indexOf(':');
        var simpleName = pos < 0 ? id : id.substr(pos + 1);

        if (!this.schemasBySimpleName[simpleName]) {
            this.schemasBySimpleName[simpleName] = schemaInfo;
        } else {
            this.schemasBySimpleName[simpleName] = null;
        }
    };

    Store.prototype.getSchemaInfo = function (schemaName, throwException) {
        if (typeof throwException === "undefined") { throwException = true; }
        if (!schemaName)
            return undefined;

        var schemaElement;
        if (schemaName.indexOf(':') < 0) {
            schemaElement = this.schemasBySimpleName[schemaName.toLowerCase()];
            if (schemaElement === null) {
                throw "Can not resolve schema element by its simple name due to duplicate elements. Use full name to resolve this schema element.";
            }
        } else {
            schemaElement = this.schemas[schemaName.toLowerCase()];
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
        this.schemas.forEach(function (v) {
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
        if (typeof throwException === "undefined") { throwException = true; }
        var schemaElement = this.getSchemaInfo(schemaName, throwException);
        if ((!schemaElement || (schemaElement.kind !== 1 /* Relationship */ && schemaElement.kind !== 0 /* Entity */)) && throwException) {
            throw "Unknown schema " + schemaName;
        }

        return schemaElement;
    };

    Store.prototype.getSchemaRelationship = function (schemaName, throwException) {
        if (typeof throwException === "undefined") { throwException = true; }
        var schemaElement = this.getSchemaInfo(schemaName, throwException);
        if ((!schemaElement || (schemaElement.kind !== 1 /* Relationship */)) && throwException) {
            throw "Unknown schema " + schemaName;
        }

        return schemaElement;
    };

    Store.prototype.getSchemaEntity = function (schemaName, throwException) {
        if (typeof throwException === "undefined") { throwException = true; }
        var schemaElement = this.getSchemaInfo(schemaName, throwException);
        if ((!schemaElement || (schemaElement.kind !== 0 /* Entity */)) && throwException) {
            throw "Unknown schema " + schemaName;
        }

        return schemaElement;
    };

    Store.prototype.runInSession = function (action) {
        var session = this.beginSession();
        try  {
            action();
            Session.current.acceptChanges();
        } finally {
            session.close();
        }
    };

    Store.prototype.get = function (id) {
        var domainName = id.substr(0, id.indexOf(':'));
        for (var i = 0; i < this._domains.length; i++) {
            var domain = this._domains[i];
            if (domain.name !== domainName)
                continue;

            var mel = domain.get(id);
            if (mel) {
                return mel;
            }
            break;
        }

        return undefined;
    };

    Store.prototype.find = function (schemaElement, kind) {
        if (typeof kind === "undefined") { kind = 3 /* EdgeOrNode */; }
        return Utils.selectMany(this.domains, function (domain) {
            return domain.GetElements(schemaElement, kind);
        });
    };

    Store.prototype.loadResources = function (url) {
    };
    return Store;
})();
exports.Store = Store;

var DomainModel = (function () {
    function DomainModel(store, name, extension) {
        this.store = store;
        this.name = name;
        this.extension = extension;
        this._sequence = 0;
        this.name = this.name.toLowerCase();
        this._graph = new Hypergraph(this);
        store.__addDomain(this);
        this.events = new EventManager(this.name);
        this._cache = {};
        this._adapters = [];
    }
    DomainModel.prototype.dispose = function () {
        Utils.forEach(this._adapters, function (a) {
            return a.dispose();
        });

        this._graph.dispose();
        this._graph = undefined;
        this.events.dispose();
        this.events = undefined;
        this._cache = undefined;
        this.eventDispatcher = undefined;
    };

    DomainModel.prototype.createId = function (id) {
        var n = parseInt(id);
        if (!isNaN(n) && n > this._sequence) {
            this._sequence = n;
        }

        return this.name + ":" + (id || ++this._sequence).toString();
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
                        } else {
                            schemaId = schema.name + ":" + e.name;
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

        if (def.entities || def.relationships) {
            this.store.runInSession(function () {
                return _this.loadFromHyperstoreJson(def);
            });
            return;
        }

        if (!rootSchema) {
            throw "rootSchema is required";
        }
        var refs = {};
        if (Utils.isArray(def)) {
            var list = [];
            this.store.runInSession(function () {
                Utils.forEach(def, function (e) {
                    return list.push(_this.parseJson(e, rootSchema, refs));
                });
            });
            return list;
        } else {
            var r;
            this.store.runInSession(function () {
                return r = [_this.parseJson(def, rootSchema, refs)];
            });
            return r;
        }
    };

    DomainModel.prototype.parseJson = function (obj, schema, refs) {
        var mel = this.createEntity(schema);
        for (var member in obj) {
            if (!obj.hasOwnProperty(member))
                continue;
            var val = obj[member];
            var prop = mel.schemaElement.getProperty(member, true);
            if (prop) {
                mel.setPropertyValue(prop, prop.deserialize(new SerializationContext(this, mel.id, undefined, undefined, undefined, undefined, val)));
                continue;
            }

            var rel = mel.schemaElement.getReference(member, true);
            if (rel) {
                var endSchema = this.store.getSchemaEntity(rel.schemaRelationship.endSchemaId);
                var values = val;
                if (Utils.isArray(val)) {
                    if (!rel.isCollection) {
                        throw "Property " + member + " must be a collection";
                    }
                } else {
                    values = [val];
                    if (rel.isCollection) {
                        throw "Property " + member + " must not be a collection";
                    }
                }

                for (var i in values) {
                    var v = values[i];
                    var elem;
                    if (v.$ref) {
                        elem = refs[v.$ref];
                    } else {
                        elem = this.parseJson(v, endSchema, refs);
                    }

                    var src = rel.opposite ? elem : mel;
                    var end = rel.opposite ? mel : elem;

                    if (!src.domain.findRelationships(rel.schemaRelationship, src, end).hasNext()) {
                        src.domain.createRelationship(rel.schemaRelationship, src, end.id, end.schemaElement.id);
                    }

                    if (v.$id) {
                        refs[v.$id] = elem;
                    }
                }
            }
        }
        return mel;
    };

    DomainModel.prototype.loadFromHyperstoreJson = function (def) {
        var list = [];
        var session = this.store.beginSession();
        try  {
            for (var k = 0; k < def.entities.length; k++) {
                var entity = def.entities[k];
                var entityId = this.createId(entity["id"]);
                if (entity.state && entity.state === "D") {
                    this.remove(entityId, entity.v);
                    continue;
                }

                var elem;
                var schemaId = this.findSchemaId(def.schemas, entity["schema"]);
                var schema = this.store.getSchemaElement(schemaId);
                if (!this.elementExists(entityId)) {
                    list.push(elem = this.createEntity(schema, entityId));
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
                    if (relationship.state && relationship.state === "D") {
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
        } finally {
            session.close();
        }
        return list;
    };

    DomainModel.prototype.findRelationships = function (schemaElement, start, end) {
        var _this = this;
        var list = [];
        var currentSchema = schemaElement;
        var tmpSchema = currentSchema;

        if (start) {
            var node = this._graph.getNode(start.id);
            if (node) {
                for (var relid in node.outgoings) {
                    var info = node.outgoings[relid];
                    if (end && end.id !== info.endId) {
                        continue;
                    }

                    tmpSchema = currentSchema;
                    if (schemaElement && schemaElement.id !== tmpSchema.id) {
                        tmpSchema = this.store.getSchemaElement(info.schemaId);
                        if (!tmpSchema.isA(schemaElement.id)) {
                            continue;
                        }
                    }
                    var rel = this.getFromCache(tmpSchema, start.id, start.schemaElement.id, info.endId, info.endSchemaId, info.id);
                    list.push(rel);
                }
            }
            return Cursor.from(list);
        } else if (end) {
            var node = this._graph.getNode(end.id);
            if (node) {
                for (var relid in node.incomings) {
                    var info = node.incomings[relid];
                    tmpSchema = currentSchema;
                    if (schemaElement && schemaElement.id !== tmpSchema.id) {
                        tmpSchema = this.store.getSchemaElement(info.schemaId);
                        if (!tmpSchema.isA(schemaElement.id)) {
                            continue;
                        }
                    }
                    var rel = this.getFromCache(tmpSchema, info.endId, info.endSchemaId, end.id, end.schemaElement.id, info.id);
                    list.push(rel);
                }
            }
            return Cursor.from(list);
        } else {
            return this._graph.getNodes(2 /* Edge */, schemaElement).map(function (n) {
                tmpSchema = currentSchema;
                if (schemaElement && schemaElement.id !== tmpSchema.id) {
                    tmpSchema = _this.store.getSchemaElement(info.schemaId);
                    if (tmpSchema.isA(schemaElement.id)) {
                        return _this.getFromCache(tmpSchema, n.startId, n.startSchemaId, n.endId, n.endSchemaId, n.id);
                    }
                }
                return undefined;
            });
        }
    };

    DomainModel.prototype.getPropertyValue = function (ownerId, property) {
        if (!this._graph.getNode(ownerId)) {
            throw "Invalid element " + ownerId;
        }

        var pid = ownerId + property.name;
        var node = this._graph.getPropertyNode(pid);
        var value = undefined;

        if (!node) {
            var def = property.defaultValue;
            if (!def) {
                return undefined;
            }
            return new PropertyValue(typeof (def) === "function" ? def() : def, undefined, 0);
        }

        return new PropertyValue(node.value, undefined, node.version);
    };

    DomainModel.prototype.setPropertyValue = function (ownerId, property, value, version) {
        var _this = this;
        var ownerNode = this._graph.getNode(ownerId);
        if (!ownerNode) {
            throw "Invalid element " + ownerId;
        }

        var pid = ownerId + property.name;
        var node = this._graph.getPropertyNode(pid);
        var oldValue = undefined;

        if (!node) {
            node = this._graph.addPropertyNode(pid, property.schemaProperty.id, value, version);
        } else {
            oldValue = node.value;
            node.value = value;
            node.version = version || Utils.getUtcNow();
        }
        var pv = new PropertyValue(value, oldValue, node.version);

        this.store.runInSession(function () {
            return Session.current.addEvent(new ChangePropertyValueEvent(_this.name, ownerId, ownerNode.schemaId, property.name, property.serialize(pv.value), property.serialize(pv.oldValue), Session.current.sessionId, pv.version));
        });
        return pv;
    };

    DomainModel.prototype.updateSequence = function (id) {
        if (!id) {
            return;
        }
        var key = id.substr(this.name.length + 1);
        var n = parseInt(key);
        if (!isNaN(n) && n > this._sequence) {
            this._sequence = n;
        }
    };

    DomainModel.prototype.createEntity = function (schemaElement, id, version) {
        var _this = this;
        Utils.Requires(schemaElement, "schemaElement");
        if (typeof (schemaElement) == "string")
            schemaElement = this.store.getSchemaEntity(schemaElement);

        var mel = schemaElement.deserialize(new SerializationContext(this, id));
        this.updateSequence(id);
        var node = this._graph.addNode(mel.id, schemaElement.id, version);
        this.store.runInSession(function () {
            return Session.current.addEvent(new AddEntityEvent(_this.name, mel.id, schemaElement.id, Session.current.sessionId, node.version));
        });
        this._cache[mel.id] = mel;
        return mel;
    };

    DomainModel.prototype.createRelationship = function (schemaRelationship, start, endId, endSchemaId, id, version) {
        var _this = this;
        Utils.Requires(schemaRelationship, "schemaRelationship");
        Utils.Requires(start, "start");
        Utils.Requires(endId, "endId");
        if (typeof (schemaRelationship) == "string")
            schemaRelationship = this.store.getSchemaRelationship(schemaRelationship);

        this.updateSequence(id);
        var mel = schemaRelationship.deserialize(new SerializationContext(this, id, start.id, start.schemaElement.id, endId, endSchemaId));
        var node = this._graph.addRelationship(mel.id, schemaRelationship.id, start.id, start.schemaElement.id, endId, endSchemaId, version);
        this.store.runInSession(function () {
            return Session.current.addEvent(new AddRelationshipEvent(_this.name, mel.id, schemaRelationship.id, start.id, start.schemaElement.id, endId, endSchemaId, Session.current.sessionId, node.version));
        });
        this._cache[mel.id] = mel;
        return mel;
    };

    DomainModel.prototype.remove = function (id, version) {
        var _this = this;
        var events;
        this.store.runInSession(function () {
            events = _this._graph.removeNode(id, version);
            Utils.forEach(events, function (e) {
                return Session.current.events.push(e);
            });
        });

        events.forEach(function (e) {
            var mel = _this._cache[e.id];
            if (mel) {
                mel.dispose();
                delete mel;
            }
        });
    };

    DomainModel.prototype.elementExists = function (id) {
        return !!this._graph.getNode(id);
    };

    DomainModel.prototype.get = function (id) {
        var node = this._graph.getNode(id);
        if (!node) {
            return undefined;
        }

        var schemaElement = this.store.getSchemaElement(node.schemaId);
        return this.getFromCache(schemaElement, node.startId, node.startSchemaId, node.endId, node.endSchemaId, node.id);
    };

    DomainModel.prototype.find = function (schemaElement, kind) {
        if (typeof kind === "undefined") { kind = 3 /* EdgeOrNode */; }
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
        mel = schemaElement.deserialize(new SerializationContext(this, id, startId, startSchemaId, endId, endSchemaId));
        this._cache[mel.id] = mel;
        return mel;
    };
    return DomainModel;
})();
exports.DomainModel = DomainModel;

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

    Hypergraph.prototype.addNodeCore = function (node) {
        var n = this._keys[node.id];
        if (n !== undefined && n !== Hypergraph.DELETED_NODE) {
            throw "Duplicate element " + node.id;
        }

        this._keys[node.id] = this._nodes.push(node) - 1;
        return node;
    };

    Hypergraph.prototype.addNode = function (id, schemaId, version) {
        var node = new GraphNode(id, schemaId, 1 /* Node */, version);
        return this.addNodeCore(node);
    };

    Hypergraph.prototype.addPropertyNode = function (id, schemaId, value, version) {
        var node = new GraphNode(id, schemaId, 4 /* Property */, version, undefined, undefined, undefined, undefined, value);
        return this._properties[id] = node;
    };

    Hypergraph.prototype.getPropertyNode = function (pid) {
        return this._properties[pid];
    };

    Hypergraph.prototype.addRelationship = function (id, schemaId, startId, startSchemaId, endId, endSchemaId, version) {
        var start = this.getNode(startId);
        if (!start) {
            throw "Invalid start element " + startId + " when adding relationship " + id;
        }

        var node = new GraphNode(id, schemaId, 2 /* Edge */, version, startId, startSchemaId, endId, endSchemaId);
        this.addNodeCore(node);

        if (startId === endId) {
            start.addEdge(id, schemaId, 3 /* Both */, startId, startSchemaId);
            return node;
        }

        start.addEdge(id, schemaId, 2 /* Outgoing */, endId, endSchemaId);
        var end = this.getNode(endId);
        if (end) {
            end.addEdge(id, schemaId, 1 /* Incoming */, startId, startSchemaId);
        }
        return node;
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
            version = Utils.getUtcNow();
        }

        var sawNodes = {};
        this.traverseNodes(node, function (node) {
            sawNodes[node.id] = true;
            var evt;
            if (!node.startId) {
                evt = new RemoveEntityEvent(_this.domain.name, node.id, node.schemaId, Session.current.sessionId, version);
            } else {
                evt = new RemoveRelationshipEvent(_this.domain.name, node.id, node.schemaId, node.startId, node.startSchemaId, node.endId, node.endSchemaId, Session.current.sessionId, version);
            }
            evt.TL = node.id === id;
            events.push(evt);
            if (Session.current.mode & (2048 /* Rollback */ | 24 /* UndoOrRedo */))
                return null;

            var nodes = [];
            for (var k in node.outgoings) {
                var edge = node.outgoings[k];
                if (!sawNodes[edge.id]) {
                    sawNodes[edge.id] = true;
                    nodes.push(_this.getNode(edge.id));
                }
            }

            for (var k in node.incomings) {
                var edge = node.incomings[k];
                if (!sawNodes[edge.id]) {
                    sawNodes[edge.id] = true;
                    nodes.push(_this.getNode(edge.id));
                }
            }

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
        events.forEach(function (e) {
            return _this.removeNodeInternal(e.id, sawNodes, pevents);
        });
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
            this._keys[key] = this._nodes.push(n) - 1;
        }
        this._nodes = nodes;
        this._deletedNodes = 0;
    };

    Hypergraph.prototype.removeNodeInternal = function (id, sawNodes, events) {
        var index = this._keys[id];
        if (index === undefined || index === Hypergraph.DELETED_NODE) {
            return;
        }

        var node = this._nodes[index];
        this._nodes[index] = null;
        this._deletedNodes++;
        this._keys[id] = Hypergraph.DELETED_NODE;

        if (node.kind === 2 /* Edge */) {
            var start = this.getNode(node.startId);
            if (!start) {
                throw "Invalid element " + node.startId;
            }

            start.removeEdge(id, 2 /* Outgoing */);

            var end = this.getNode(node.endId);
            if (end) {
                end.removeEdge(id, 1 /* Incoming */);
            }
        }

        var schema = this.domain.store.getSchemaElement(node.schemaId);
        var self = this;
        schema.getProperties(true).forEach(function (p) {
            var pid = node.id + p.name;
            var pnode = self._properties[pid];
            if (pnode) {
                delete self._properties[pid];
                events.push(new RemovePropertyEvent(self.domain.name, node.id, node.schemaId, p.name, pnode.value, Session.current.sessionId, pnode.version));
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

var Cursor = (function () {
    function Cursor() {
    }
    Cursor.prototype.reset = function () {
    };
    Cursor.prototype.hasNext = function () {
        throw "not implemented. Use Cursor.from to instanciate a cursor.";
    };
    Cursor.prototype.next = function () {
        return undefined;
    };

    Cursor.prototype.firstOrDefault = function () {
        var r = this.hasNext() ? this.next() : undefined;
        this.reset();
        return r;
    };

    Cursor.prototype.forEach = function (callback) {
        while (this.hasNext()) {
            callback(this.next());
        }
        this.reset();
    };

    Cursor.prototype.any = function () {
        var r = this.hasNext();
        this.reset();
        return r;
    };

    Cursor.prototype.toArray = function () {
        var list = [];
        this.forEach(function (n) {
            return list.push(n);
        });
        return list;
    };

    Cursor.prototype.map = function (callback) {
        return new MapCursor(callback, this);
    };

    Cursor.from = function (obj) {
        if (Array.isArray(obj))
            return new ArrayCursor(obj);

        if (obj.hasNext)
            return obj;

        if (obj instanceof ModelElementCollection)
            return new ArrayCursor(obj);

        throw "Not implemented";
    };
    return Cursor;
})();
exports.Cursor = Cursor;

var MapCursor = (function (_super) {
    __extends(MapCursor, _super);
    function MapCursor(_filter, _cursor) {
        _super.call(this);
        this._filter = _filter;
        this._cursor = _cursor;
        this.reset();
    }
    MapCursor.prototype.reset = function () {
        this._cursor.reset();
        this._current = undefined;
    };

    MapCursor.prototype.hasNext = function () {
        while (true) {
            if (!this._cursor.hasNext())
                return false;
            var r = this._filter(this._cursor.next());
            if (r) {
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
            this._index++;
            var node = this._graph._nodes[this._index - 1];
            if (node && node !== Hypergraph.DELETED_NODE && (node.kind & this._kind) !== 0 && (!this._schema || this._schema.id === node.schemaId)) {
                this._current = node;
                return true;
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
})(exports.Direction || (exports.Direction = {}));
var Direction = exports.Direction;

(function (NodeType) {
    NodeType[NodeType["Node"] = 1] = "Node";
    NodeType[NodeType["Edge"] = 2] = "Edge";
    NodeType[NodeType["EdgeOrNode"] = 3] = "EdgeOrNode";
    NodeType[NodeType["Property"] = 4] = "Property";
})(exports.NodeType || (exports.NodeType = {}));
var NodeType = exports.NodeType;

var NodeInfo = (function () {
    function NodeInfo(id, schemaId, version) {
        this.id = id;
        this.schemaId = schemaId;
        this.version = version;
        if (!version) {
            this.version = Utils.getUtcNow();
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
    function GraphNode(id, schemaId, kind, version, startId, startSchemaId, endId, endSchemaId, value) {
        _super.call(this, id, schemaId, version, endId, endSchemaId);
        this.value = value;

        this.kind = kind;
        this.startId = startId;
        this.startSchemaId = startSchemaId;

        this.outgoings = {};
        this.incomings = {};
    }
    GraphNode.prototype.addEdge = function (id, edgeSchemaId, direction, endId, endSchemaId) {
        var edge = new EdgeInfo(id, edgeSchemaId, undefined, endId, endSchemaId);

        if ((direction & 1 /* Incoming */) === 1 /* Incoming */) {
            this.incomings[id] = edge;
        }
        if ((direction & 2 /* Outgoing */) === 2 /* Outgoing */) {
            this.outgoings[id] = edge;
        }
    };

    GraphNode.prototype.removeEdge = function (id, direction) {
        if ((direction & 1 /* Incoming */) === 1 /* Incoming */) {
            delete this.incomings[id];
        }
        if ((direction & 2 /* Outgoing */) === 2 /* Outgoing */) {
            delete this.outgoings[id];
        }
    };
    return GraphNode;
})(EdgeInfo);

var ModelElement = (function () {
    function ModelElement() {
    }
    ModelElement.prototype.dispose = function () {
        this.disposed = true;
        for (var p in this) {
            if (this.hasOwnProperty(p) && p.substr(0, 5) === "__ref") {
                var prop = this[p];
                if (prop && prop.dispose) {
                    prop.dispose();
                }
            }
        }
    };

    ModelElement.prototype.getPropertyValue = function (property) {
        if (this.disposed) {
            throw "Can not use a disposed element";
        }
        if (typeof (property) === "string")
            property = this.schemaElement.getProperty(property, true);
        if (!property)
            return undefined;
        var pv = this.domain.getPropertyValue(this.id, property);
        if (!pv) {
            return undefined;
        }
        return pv.value;
    };

    ModelElement.prototype.setPropertyValue = function (property, value) {
        if (this.disposed) {
            throw "Can not use a disposed element";
        }
        if (typeof (property) === "string")
            property = this.schemaElement.getProperty(property, true);

        return this.domain.setPropertyValue(this.id, property, value);
    };

    ModelElement.prototype.__initialize = function (domain, id, schemaElement, startId, startSchemaId, endId, endSchemaId) {
        this.disposed = false;
        this.domain = domain;
        this.schemaElement = schemaElement;
        this.id = id;
        if (!id) {
            this.id = this.domain.createId();
        }
        this.startId = startId;
        this.startSchemaId = startSchemaId;
        this.endId = endId;
        this.endSchemaId = endSchemaId;
    };

    Object.defineProperty(ModelElement.prototype, "start", {
        get: function () {
            if (this.disposed) {
                throw "Can not use a disposed element";
            }

            if (!this._start) {
                this._start = this.domain.get(this.startId);
            }
            return this._start;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(ModelElement.prototype, "end", {
        get: function () {
            if (this.disposed) {
                throw "Can not use a disposed element";
            }

            if (!this._end) {
                this._end = this.domain.store.get(this.endId);
            }
            return this._end;
        },
        enumerable: true,
        configurable: true
    });

    ModelElement.prototype.stringify = function () {
        if (this.disposed) {
            throw "Can not use a disposed element";
        }

        var seen = [];

        var json = JSON.stringify(this, function (k, v) {
            if (k.length === 0 || !isNaN(parseInt(k)) || !v) {
                return v;
            }

            switch (k) {
                case "id":
                    if (seen.indexOf(v) !== -1) {
                        return undefined;
                    }
                    seen.push(v);
                    return v;
                case "startId":
                case "startSchemaId":
                case "endId":
                case "endSchemaId":
                case "$id":
                    return v;
                case "schemaElement":
                    return v.id;
                case "domain":
                case "start":
                case "end":
                case "_start":
                case "_end":
                    return undefined;
            }

            var p = this.schemaElement.getProperty(k, true);
            if (!p) {
                var r = this.schemaElement.getReference(k, true);

                if (r && (!r.opposite && r.schemaRelationship.startProperty || r.opposite && r.schemaRelationship.endProperty)) {
                    if (r.schemaRelationship.cardinality === 3 /* ManyToMany */ || !r.opposite && r.schemaRelationship.cardinality === 1 /* OneToMany */ || r.opposite && r.schemaRelationship.cardinality === 2 /* ManyToOne */) {
                        return Utils.select(v.items, function (i) {
                            return seen.indexOf(i.id) === -1 ? i : { $id: i.id };
                        });
                    }

                    return seen.indexOf(v.id) === -1 ? v : { $id: v.id };
                }

                return undefined;
            }
            return p.kind === 1 /* Calculated */ ? undefined : p.serialize(v);
        });

        return json;
    };

    ModelElement.prototype.getRelationships = function (schemaElement, direction) {
        if (typeof direction === "undefined") { direction = 2 /* Outgoing */; }
        var list;
        if ((direction & 2 /* Outgoing */) !== 0) {
            list = this.domain.findRelationships(schemaElement, this);
        }
        if ((direction & 1 /* Incoming */) !== 0) {
            var list2 = this.domain.findRelationships(schemaElement, undefined, this);
            if (list && list.any()) {
                list = list.concat(list2);
            }
        }
        return list;
    };
    return ModelElement;
})();
exports.ModelElement = ModelElement;

var ModelElementCollection = (function () {
    function ModelElementCollection(source, schemaRelationship, opposite, filter) {
        if (typeof opposite === "undefined") { opposite = false; }
        if (schemaRelationship.cardinality === 0 /* OneToOne */) {
            throw "Invalid cardinality. Use reference instead.";
        }

        if (!opposite && !source.schemaElement.isA(schemaRelationship.startSchemaId)) {
            throw "Invalid source type";
        }
        if (opposite && !source.schemaElement.isA(schemaRelationship.endSchemaId)) {
            throw "Invalid end type";
        }

        this._source = opposite ? undefined : source;
        this._end = opposite ? source : undefined;
        this._schemaRelationship = schemaRelationship;
        this._domain = source.domain;

        this._filter = filter;
        var self = this;

        this._sessionCompletedCookie = this._domain.events.on(EventManager.SessionCompleted, function (s) {
            if (s.aborted) {
                return;
            }

            Utils.forEach(s.events, function (e) {
                if (e.eventName !== EventManager.AddRelationshipEvent && e.eventName !== EventManager.RemoveRelationshipEvent) {
                    return;
                }

                if (e.schemaId === self._schemaRelationship.id && (self._source && e.startId === self._source.id) || (self._end && e.endId === self._end.id)) {
                    if (e.eventName === EventManager.AddRelationshipEvent) {
                        var rel = self._domain.store.get(e.id);
                        if (!rel)
                            return;

                        var mel = self._source ? rel.end : rel.start;

                        if (!self._filter || self._filter(mel)) {
                            Array.prototype.push.call(self, mel);
                            self._count++;
                        }
                    } else {
                        var id = self._source ? e.endId : e.startId;
                        for (var k = 0; k < self._count; k++) {
                            if (self[k].id === id) {
                                if (Array.prototype.splice.call(self, k, 1).length === 1) {
                                    self._count--;
                                }
                                break;
                            }
                        }
                    }
                }
            });
        });

        for (var p in this) {
            if (this.hasOwnProperty(p)) {
                var desc = Object.getOwnPropertyDescriptor(this, p);
                desc.configurable = false;
                Object.defineProperty(this, p, desc);
            }
        }

        this._count = 0;
        this.loadItems();
    }
    ModelElementCollection.prototype.setFilter = function (where) {
        this._filter = where;
        this.clear();
        this.loadItems();
    };

    ModelElementCollection.prototype.clear = function () {
        this._count = 0;
        var self = this;
        while (self.length > 0) {
            self.pop();
        }
    };

    Object.defineProperty(ModelElementCollection.prototype, "count", {
        get: function () {
            return this._count;
        },
        enumerable: true,
        configurable: true
    });

    ModelElementCollection.prototype.loadItems = function () {
        var opposite = !!this._source;
        var cursor = this._domain.findRelationships(this._schemaRelationship, this._source, this._end);
        while (cursor.hasNext()) {
            var rel = cursor.next();
            var elem = opposite ? rel.end : rel.start;
            if (!this._filter || this._filter(elem)) {
                Array.prototype.push.call(this, elem);
                this._count++;
            }
        }
    };

    ModelElementCollection.prototype.dispose = function () {
        this._domain.events.remove(this._sessionCompletedCookie);
        this.clear();
    };

    ModelElementCollection.prototype.remove = function (mel) {
        if ((this._source || this._end).disposed) {
            throw "Can not use a disposed element";
        }

        if (mel == null) {
            return;
        }

        var source = this._source ? this._source : mel;
        var end = this._end ? this._end : mel;

        var rel = this._domain.findRelationships(this._schemaRelationship, source, end).firstOrDefault();
        if (rel) {
            this._domain.remove(rel.id);
        }
    };

    ModelElementCollection.prototype.add = function (mel) {
        if ((this._source || this._end).disposed) {
            throw "Can not use a disposed element";
        }

        if (mel == null) {
            return;
        }

        var source = this._source ? this._source : mel;
        var end = this._end ? this._end : mel;

        var rel = this._source.domain.createRelationship(this._schemaRelationship, source, end.id, end.schemaElement.id);
    };
    return ModelElementCollection;
})();
exports.ModelElementCollection = ModelElementCollection;


(function (ConstraintKind) {
    ConstraintKind[ConstraintKind["Check"] = 0] = "Check";
    ConstraintKind[ConstraintKind["Validate"] = 1] = "Validate";
})(exports.ConstraintKind || (exports.ConstraintKind = {}));
var ConstraintKind = exports.ConstraintKind;

(function (MessageType) {
    MessageType[MessageType["Warning"] = 0] = "Warning";

    MessageType[MessageType["Error"] = 1] = "Error";
})(exports.MessageType || (exports.MessageType = {}));
var MessageType = exports.MessageType;

var ConstraintContext = (function () {
    function ConstraintContext(kind) {
        this.kind = kind;
        this.messages = new Array();
    }
    ConstraintContext.prototype.log = function (msg, messageType, propertyName) {
        if (typeof messageType === "undefined") { messageType = 0 /* Warning */; }
        var diag = new DiagnosticMessage(messageType, msg, this.element, this.propertyName || propertyName);
        this.messages.push(diag);
    };
    return ConstraintContext;
})();
exports.ConstraintContext = ConstraintContext;

var ConstraintsManager = (function () {
    function ConstraintsManager(schema) {
        this.schema = schema;
        this._constraints = {};
    }
    ConstraintsManager.prototype.addPropertyConstraint = function (property, condition, message, asError, kind) {
        var _this = this;
        if (typeof asError === "undefined") { asError = false; }
        if (typeof kind === "undefined") { kind = 0 /* Check */; }
        var def = { condition: condition, message: message, error: asError, kind: kind };
        this.setPropertyConstraint(def, property);

        var schema = property.schemaProperty;
        while (schema) {
            Utils.forEach(schema.constraints, function (c) {
                return _this.setPropertyConstraint(c, property, schema);
            });
            schema = schema.parent;
        }
    };

    ConstraintsManager.prototype.setPropertyConstraint = function (def, property, schema) {
        if (!def.condition) {
            return;
        }

        var condition = schema ? def.condition.bind(schema) : def.condition;
        var message = DiagnosticMessage.__prepareMessage(def.message, schema) || "Constraint failed for element {id} {propertyName}";

        this.addConstraint(property.owner, {
            propertyName: property.name,
            messageType: def.messageType,
            execute: function (self, ctx) {
                var pv = ctx.element.domain.getPropertyValue(self.id, property);
                if (!pv) {
                    return null;
                }
                var result = null;
                ctx.propertyName = property.name;
                try  {
                    if (!condition(pv.value, pv.oldValue, ctx)) {
                        result = DiagnosticMessage.__format(message, ctx.element, property.name, pv.value, pv.oldValue);
                    }
                } catch (e) {
                    ctx.log(e, 1 /* Error */);
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
                try  {
                    if (!constraint.condition(self, ctx)) {
                        result = DiagnosticMessage.__format(message, ctx.element, constraint.propertyName);
                    }
                } catch (e) {
                    ctx.log(e, 1 /* Error */);
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
            elements = elements.find();
        return this.checkOrValidateElements(elements, 1 /* Validate */);
    };

    ConstraintsManager.prototype.checkOrValidateElements = function (elements, kind) {
        var ctx = new ConstraintContext(kind);
        for (var key in elements) {
            var mel = elements[key];
            try  {
                ctx.element = mel;
                this.checkCondition(ctx, mel.schemaElement);
            } catch (e) {
                ctx.log(e, 1 /* Error */);
            }
        }

        return ctx.messages;
    };

    ConstraintsManager.prototype.checkCondition = function (ctx, schemaElement) {
        var constraints = this._constraints[schemaElement.id];
        if (constraints) {
            for (var key in constraints) {
                var constraint = constraints[key];
                if (constraint.kind === ctx.kind) {
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
exports.ConstraintsManager = ConstraintsManager;

var DiagnosticMessage = (function () {
    function DiagnosticMessage(messageType, message, element, propertyName) {
        this.messageType = messageType;
        this.message = message;
        this.element = element;
        this.propertyName = propertyName;
        if (element) {
            this.id = element.id;
        }
    }
    DiagnosticMessage.__format = function (message, element, propertyName, val, old) {
        var self = this;
        var regex = /{\s*([^}\s]*)\s*}/g;
        return message.replace(regex, function (match, name) {
            switch (name) {
                case "value":
                    return val;
                case "oldValue":
                    return old;
                case "propertyName":
                    return propertyName;
                default:
                    return element ? element[name] : null;
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
exports.DiagnosticMessage = DiagnosticMessage;


var EventBus = (function () {
    function EventBus(store, eventDispatcher) {
        var _this = this;
        this.store = store;
        this.cookie = store.onSessionCompleted(function (s) {
            return _this.sendEvents(s);
        });
        this._channels = [];
        this.defaultEventDispatcher = eventDispatcher || new EventDispatcher(store);
    }
    EventBus.prototype.dispose = function () {
        this.store.removeSessionCompleted(this.cookie);
        this._channels.forEach(function (c) {
            return c.close();
        });
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

        this._channels.forEach(function (c) {
            return c._sendEvents(s);
        });
    };
    return EventBus;
})();
exports.EventBus = EventBus;

var AbstractChannel = (function () {
    function AbstractChannel(domain) {
        this.domain = domain;
    }
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
            events: Utils.select(session.events, function (e) {
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
exports.AbstractChannel = AbstractChannel;

var Adapter = (function () {
    function Adapter(reset) {
        if (typeof reset === "undefined") { reset = false; }
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

            var elements = Utils.select(s.trackingData.involvedTrackedElements, function (e) {
                return (e.domain === _this.domain.name) ? e : undefined;
            });

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
exports.Adapter = Adapter;

var IndexedDbAdapter = (function (_super) {
    __extends(IndexedDbAdapter, _super);
    function IndexedDbAdapter() {
        _super.call(this);

        this.indexedDB = indexedDB || this.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
    }
    IndexedDbAdapter.prototype.open = function () {
        var self = this;
        var q = Q.defer();

        var request = self.indexedDB.open(self.domain.name, 2);
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(IndexedDbAdapter.DB_NAME)) {
                db.createObjectStore(IndexedDbAdapter.DB_NAME, { autoIncrement: false });
            }
            e.target.transaction.oncomplete = function (e) {
                q.resolve(db);
            };
        };
        request.onsuccess = function (e) {
            var db = e.target.result;
            if (self.reset) {
                var trx = db.transaction([IndexedDbAdapter.DB_NAME], "readwrite");
                var ostore = trx.objectStore(IndexedDbAdapter.DB_NAME);
                var rq = ostore.clear();
                rq.onsuccess = function (e) {
                    return q.resolve(self);
                };
                rq.onerror = function (e) {
                    return q.reject(e);
                };
            } else {
                q.resolve(db);
            }
        };
        request.onerror = function (e) {
            q.reject(e);
        };

        return q.promise;
    };

    IndexedDbAdapter.prototype.persistElements = function (s, elements) {
        var self = this;
        var r = Session.current.result;

        var q = Q.defer();
        r.addPromise(q);
        this.open().then(function (db) {
            var trx = db.transaction([IndexedDbAdapter.DB_NAME], "readwrite");
            var ostore = trx.objectStore(IndexedDbAdapter.DB_NAME);
            q.resolve(this);
            elements.forEach(function (element) {
                switch (element.state) {
                    case 0 /* Added */:
                        var data = { schema: element.schemaId, version: element.version };
                        if (element.startId) {
                            data.startId = element.startId;
                            data.endId = element.endId;
                            data.endSchemaId = element.endSchemaId;
                        }
                        ;
                        ostore.add(data, element.id);

                    case 2 /* Updated */:
                        if (element.properties) {
                            var schemaElement = self.domain.store.getSchemaElement(element.schemaId);
                            for (var pn in element.properties) {
                                var pv = element.properties[pn];
                                if (pv && pv.value) {
                                    var ps = schemaElement.getProperty(pn, true);
                                    var data = { va: ps.serialize(pv.value), ve: pv.version };
                                    ostore.put(data, element.id + pn);
                                }
                            }
                        }
                        break;

                    case 1 /* Removed */:
                        ostore.delete(element.id);
                        var schemaElement = self.domain.store.getSchemaElement(element.schemaId);

                        Utils.forEach(schemaElement.getProperties(true), function (p) {
                            ostore.delete(element.id + p.name);
                        });
                        break;
                }
            });
        });
    };

    IndexedDbAdapter.prototype.loadElementsAsync = function (filter) {
        var self = this;
        var defer = Q.defer();
        this.open().then(function (db) {
            var trx = db.transaction([IndexedDbAdapter.DB_NAME]);
            var ostore = trx.objectStore(IndexedDbAdapter.DB_NAME);
            var entities = [];
            var relationships = [];

            var dl = this.domain.name.length;

            ostore.openCursor().onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    var data = cursor.value;
                    if (data.schema) {
                        if (!filter || filter(data.id, data.schema)) {
                            data.id = cursor.key;
                            if (data.startId) {
                                relationships.push(data);
                            } else {
                                entities.push(data);
                            }
                        }
                    }
                    cursor.continue();
                } else {
                    var session = self.domain.store.beginSession({ mode: 4 /* Loading */ });
                    try  {
                        for (var i = 0; i < entities.length; i++) {
                            var data = entities[i];
                            var s = self.domain.store.getSchemaEntity(data.schema);
                            self.domain.createEntity(s, data.id, data.version);
                            self.loadProperties(data.id, s, ostore);
                        }

                        for (var i = 0; i < relationships.length; i++) {
                            var data = relationships[i];
                            var rs = self.domain.store.getSchemaRelationship(data.schema);
                            var start = self.domain.get(data.startId);
                            if (start) {
                                self.domain.createRelationship(rs, start, data.endId, data.endSchemaId, data.id, data.version);
                                self.loadProperties(data.id, rs, ostore);
                            }
                        }
                        session.acceptChanges();
                    } finally {
                        defer.resolve(session.close());
                    }
                }
            };
        });
        return defer.promise;
    };

    IndexedDbAdapter.prototype.loadProperties = function (id, schema, ostore) {
        var self = this;
        var ctx = new SerializationContext(self.domain, id);
        schema.getProperties(true).forEach(function (p) {
            var rq = ostore.get(id + p.name);
            rq.onsuccess = function (r) {
                var data = rq.result;
                if (data) {
                    ctx.value = data.va;
                    self.domain.setPropertyValue(id, p, p.deserialize(ctx), data.ve);
                }
            };
        });
    };
    IndexedDbAdapter.DB_NAME = "HY$DB";
    return IndexedDbAdapter;
})(Adapter);
exports.IndexedDbAdapter = IndexedDbAdapter;

var LocalStorageAdapter = (function (_super) {
    __extends(LocalStorageAdapter, _super);
    function LocalStorageAdapter() {
        _super.apply(this, arguments);
    }
    LocalStorageAdapter.prototype.clearAsync = function () {
        var defer = Q.defer();

        var dl = this.domain.name.length;
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!key || key.length < LocalStorageAdapter.PREFIX.length) {
                continue;
            }

            if (key.substr(LocalStorageAdapter.PREFIX.length, dl) !== this.domain.name) {
                continue;
            }
            localStorage.removeItem(key);
        }

        defer.resolve(true);
        return defer.promise;
    };

    LocalStorageAdapter.prototype.persistElements = function (s, elements) {
        if (!localStorage)
            return;
        var self = this;

        if (this.reset) {
            this.clearAsync();
        }

        elements.forEach(function (element) {
            switch (element.state) {
                case 0 /* Added */:
                    var data = { schema: element.schemaId, version: element.version };
                    if (element.startId) {
                        data.startId = element.startId;
                        data.endId = element.endId;
                        data.endSchemaId = element.endSchemaId;
                    }

                    localStorage.setItem(LocalStorageAdapter.PREFIX + element.id, JSON.stringify(data));

                case 2 /* Updated */:
                    if (element.properties) {
                        var schemaElement = self.domain.store.getSchemaElement(element.schemaId);
                        for (var pn in element.properties) {
                            var pv = element.properties[pn];
                            if (pv && pv.value) {
                                var ps = schemaElement.getProperty(pn, true);
                                var data = { va: ps.serialize(pv.value), ve: pv.version };
                                localStorage.setItem(LocalStorageAdapter.PREFIX + element.id + pn, JSON.stringify(data));
                            }
                        }
                    }
                    break;

                case 1 /* Removed */:
                    localStorage.removeItem(LocalStorageAdapter.PREFIX + element.id);
                    var schemaElement = self.domain.store.getSchemaElement(element.schemaId);

                    Utils.forEach(schemaElement.getProperties(true), function (p) {
                        localStorage.removeItem(LocalStorageAdapter.PREFIX + element.id + p.name);
                    });
                    break;
            }
        });
    };

    LocalStorageAdapter.prototype.loadElementsAsync = function (filter) {
        var defer = Q.defer();

        var session = this.domain.store.beginSession({ mode: 4 /* Loading */ });
        try  {
            var entities = [];
            var relationships = [];

            var dl = this.domain.name.length;
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (!key || key.length < LocalStorageAdapter.PREFIX.length) {
                    continue;
                }

                key = key.substr(LocalStorageAdapter.PREFIX.length);
                if (key.substr(0, dl) !== this.domain.name) {
                    continue;
                }

                var data = JSON.parse(localStorage.getItem(key));
                if (!data || !data.schema) {
                    continue;
                }

                if (filter && !filter(data.id, data.schema)) {
                    continue;
                }

                data.id = key;
                if (data.startId) {
                    relationships.push(data);
                } else {
                    entities.push(data);
                }
            }
            for (var i = 0; i < entities.length; i++) {
                var data = entities[i];
                var s = this.domain.store.getSchemaEntity(data.schema);
                this.domain.createEntity(s, data.id, data.version);
                this.loadProperties(data.id, s);
            }

            for (var i = 0; i < relationships.length; i++) {
                var data = relationships[i];
                var rs = this.domain.store.getSchemaRelationship(data.schema);
                var start = this.domain.get(data.startId);
                this.domain.createRelationship(rs, start, data.endId, data.endSchemaId, data.id, data.version);
                this.loadProperties(data.id, rs);
            }
            session.acceptChanges();
        } finally {
            defer.resolve(session.close());
        }
        return defer.promise;
    };

    LocalStorageAdapter.prototype.loadProperties = function (id, schema) {
        var self = this;
        var ctx = new SerializationContext(self.domain, id);
        schema.getProperties(true).forEach(function (p) {
            var data = localStorage.getItem(id + p.name);
            if (data) {
                data = JSON.parse(data);
                ctx.value = data.va;
                self.domain.setPropertyValue(id, p, p.deserialize(ctx), data.ve);
            }
        });
    };
    LocalStorageAdapter.PREFIX = "HY$:";
    return LocalStorageAdapter;
})(Adapter);
exports.LocalStorageAdapter = LocalStorageAdapter;

var SignalRChannel = (function (_super) {
    __extends(SignalRChannel, _super);
    function SignalRChannel(domain, hub) {
        _super.call(this, domain);
        this.hub = hub;
        var self = this;

        this.hub = hub || $.hubConnection();

        this.proxy = this.hub.createHubProxy('hyperstore');
        this.proxy.on('onEvents', function (env) {
            if (env.origin === self.domain.store.storeId) {
                return;
            }

            var session = self.domain.store.beginSession({ origin: env.origin });
            try  {
                env.events.forEach(function (e) {
                    var evt = EventManager.createEvent(e.eventName);
                    if (!evt) {
                        evt = {};
                        evt.eventName = e.eventName;
                    }

                    var obj = JSON.parse(e.data);
                    for (var f in obj) {
                        if (obj.hasOwnProperty(f)) {
                            evt[f] = obj[f];
                        }
                    }

                    self.dispatcher.handleEvent(evt);
                });

                session.acceptChanges();
            } finally {
                session.close();
            }
        });
    }
    SignalRChannel.prototype.sendMessage = function (message) {
        this.proxy.invoke('notify', message);
    };

    SignalRChannel.prototype.start = function (callback) {
        _super.prototype.start.call(this);

        this.hub.start().done(function () {
            if (callback) {
                callback(this);
            }
        });
    };

    SignalRChannel.prototype.close = function () {
        _super.prototype.close.call(this);
        this.hub.stop();
    };
    return SignalRChannel;
})(AbstractChannel);
exports.SignalRChannel = SignalRChannel;

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
        domain.events.on(EventManager.SessionCompleted, function (s) {
            if (!s.aborted && self.Enabled && (s.mode & (24 /* UndoOrRedo */ | 4 /* Loading */)) === 0) {
                self.push.call(self, s);
            }
        });
    };

    UndoManager.prototype.performPop = function (mainStack, altStack, mode, toSavePoint) {
        var events = [];
        var session = this.store.beginSession({ mode: mode });
        var sid;

        try  {
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
        } finally {
            session.close();
        }
    };

    UndoManager.prototype.push = function (session) {
        var _this = this;
        var events = Utils.where(session.events, function (e) {
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
exports.UndoManager = UndoManager;

var Query = (function () {
    function Query(store, _config, _schema) {
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
        this._subQueries.forEach(function (q) {
            return q.reset();
        });
    };

    Query.prototype.setStart = function (obj) {
        this._iterator = Cursor.from(obj);
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
                        this._subQueries.forEach(function (q) {
                            return q.setStart(elem);
                        });
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
                    } else {
                        this._state = 3;
                    }
                case 3:
                    if (!this._subQueries[this._iter].hasNext()) {
                        this._state = 2;
                    } else {
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
        if (typeof flag === "undefined") { flag = false; }
        for (var field in config) {
            if (!config.hasOwnProperty(field))
                continue;

            var val;
            var data = config[field];
            switch (field) {
                case "$schema":
                    val = elem.schemaElement.id;
                    break;
                case "$filter":
                    if (data(elem) === flag)
                        return flag;
                    break;
                case "$or":
                    if (this.filter(elem, data, true) === flag)
                        return flag;
                    break;
                case "id":
                    val = elem.id;
                    break;
                default:
                    if (field[0] == '$')
                        continue;
                    var prop = elem.schemaElement.getProperty(field, true);
                    if (!prop)
                        continue;
                    val = elem.getPropertyValue(field);
            }

            var r = !flag;
            if (data instanceof RegExp) {
                r = data.test(val);
            } else if (typeof (data) === "object") {
                r = this.evalExpression(val, data);
            } else {
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
})();
exports.Query = Query;

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