exports.schema = {
    id: "MyDataSchema",
    types: {
        enum: {
            values: [],
            constraints: {
                "invalid": {
                    message: "Invalid value",
                    check: function (val) {
                        return this.values.indexOf(val) !== -1;
                    }
                }
            }
        },
    },
    Application: {
        properties: {
             name: "string"
        },
        references: {
            Data: {
                end: "Data",
                kind: "1=>1"
            },
        }
    },
    Data: {
        properties : {
             id : { type: "string" }
        },
        references : {
             Entities : {
                end : "Entity",
                kind : "1=>*"
            },
        }
    },
    Property: {
        properties : {
            name : { type: "string", isKey: true },
            type : { type: "enum", values: ["string", "boolean", "array", "number", "object", "value", "whitespace", "null"], defaultValue: "string" },
        }
    },
    Entity: {
        properties : {
            name : { type: "string", isKey: true }
        },
        references : {
             Properties : {
                end : "Property",
                kind : "1=>*"
            }
        }
    }
}