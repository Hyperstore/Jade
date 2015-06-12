var chance = require('chance').Chance();

exports.schema = {
    id : "MyChanceDataSchema",
    extends: "MyDataSchema",
    Entity: {
        properties: {
            repeat: { type: "number", defaultValue : 1 },
        }
    },
    Property: {
        constraints: {
            "only one qualifier can be defined" : {
                message: "only one qualifier can be defined",
                check : function (self, ctx) {
                    var result = 0 + (null != self.stringQualifier) 
                + (null != self.boolQualifier) 
                + (null != self.wordQualifier) 
                + (null != self.nameQualifier) 
                + (null != self.enumQualifier);
                    return result < 2;
                }
            }
        },
        properties: {
            qualifier: function () {
                return this.stringQualifier ? this.stringQualifier : 
                    this.boolQualifier ? this.boolQualifier : 
                    this.wordQualifier ? this.wordQualifier : 
                    this.nameQualifier ? this.nameQualifier : 
                    this.enumQualifier ? this.enumQualifier : null;
            }
        },
        references : {
            stringQualifier : {
                end : "StringQualifier",
                kind : "1=>1"
            },
            boolQualifier : {
                end : "BoolQualifier",
                kind : "1=>1"
            },
            wordQualifier : {
                end : "WordQualifier",
                kind : "1=>1"
            },
            nameQualifier : {
                end : "NameQualifier",
                kind : "1=>1"
            },
            enumQualifier : {
                end : "EnumQualifier",
                kind : "1=>1",
                name : "PropertyHasEnumQualifier",
            },
        }
    },
    Qualifier : {
        properties: {
            qualify: function () {
                return this.__qualify;
            }
        },
    },
    BoolQualifier : {
        extends: "Qualifier",
        properties: {
            likelihood: { type: "number" },
            __qualify: function () {
                return chance.bool({ likelihood: this.likelihood });
            }
        },
    },
    StringQualifier : {
        extends: "Qualifier",
        properties: {
            length: { type: "number" },
            pool: { type: "string" },
            __qualify: function () {
                return chance.string({ length: this.length, pool: this.pool });
            }
        },
    },    
    WordQualifier : {
        extends: "Qualifier",
        properties: {
            syllables: { type: "number" },
            length: { type: "number" },
            __qualify: function () {
                return chance.word({ length: this.length, syllables: this.syllables });
            }
        },
    },
    NameQualifier : {
        extends: "Qualifier",
        properties: {
            middle: { type: "Boolean" },
            middle_initial: { type: "Boolean" },
            prefix: { type: "Boolean" },
            suffix: { type: "Boolean" },
            gender: { type: "string" },
            __qualify: function () {
                return chance.name({
                    middle: this.middle, 
                    middle_initial: this.middle_initial,
                    prefix: this.prefix, 
                    suffix: this.suffix,
                    gender: this.gender,
                });
            }
        },
    },
    EnumQualifier : {
        extends: "Qualifier",
        properties: {
            __qualify: function () {
                var values = this.Qualified.type.values;
                var choice = chance.integer({ min: 0, max: values.length - 1 })
                return values[choice];
            }
        },
        references : {
            Qualified : {
                end : "Property",
                kind : "1<=1",
                name : "PropertyHasEnumQualifier",
            },
        }
    },
    
}