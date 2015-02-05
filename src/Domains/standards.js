/*var standard_fr = {
    "http://www.hyperstore.org/schemas/standards" : {
        "constraints.required.message": "Propriété {propertyName} est requise.",
        "types.email.constraints.check_format.message": "Addresse mail invalide."
    }
};
*/
var domain =
{
    id: "Standards",
    // Shared constraints can be referenced with the $ref property name.
    constraints: {
        "required": {
            message: "Property {propertyName} is required",
            check: function (val) {
                return val != undefined;
            }
        }
    },
    types: {
        "identity": {
            constraints : {
                "duplicate": {
                    message: "Duplicate value {value} for {propertyName}",
                    check: function (val, old, ctx) {
                        if (!val) return true;
                        var element = ctx.element.getInfo();
                        // find embedded relationship to this element.
                        var rel = ctx.element.getRelationships(undefined, Direction.incomings).firstOrDefault(function (r) {
                            return r.embedded
                        });
                        var others = rel ?
                            rel.getStart().getRelationships(rel.getInfo().schemaElement) : // sibling elements
                            element.domain.getElements(element.schemaElement); // all same type elements
                        return !others.any(function (e) {
                            return e.name === val && e.id !== element.id
                        });
                    }
                }
            }
        },
        maxLength: {
            type: "string",
            max: 0,
            constraints: {
                "Value {propertyName} must have less than {$max} characters.": function (val) {
                    return this.max === 0 || val.length <= this.max;
                }
            }
        },
        email: {
            type: "string",
            optional: true,
            pattern: /[a-zA-Z0-9.!#$%&'*+-/=?\^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*/,
            constraints: {
                check_format: {
                    message: "Invalid email",
                    check: function (val) {
                        return (!val && this.optional) || this.pattern.test(val);
                    }
                }
            }
        },
        enum: {
            values: [],
            constraints: {
                "invalid": {
                    message: "Invalid property {propertyName} must be one of {$values}",
                    check: function (val) {
                        return this.values.indexOf(val) !== -1;
                    }
                }
            }
        },
        range: {
            type: "number",
            min: 0,
            max: 1,
            optional: false,
            constraints: {
                "invalid": {
                    message: "Invalid {propertyName} value must be between {$min} and {$max}",
                    check: function (val) {
                        return (!val && this.optional) || val >= this.min && val <= this.max;
                    }
                }
            }
        },
        arrayOf: {
            valueType: "string",
            optional: false,
            constraints: {
                "invalid": {
                    message: "Invalid {propertyName}. Must be an array of {$valueType}",
                    check: function (val) {
                        if (!val) return this.optional;
                        if (!val.length) return false;
                        var ok = true;
                        val.forEach(function (v) {
                            if (typeof v !== this.valueType) ok = false;
                        });
                        return ok;
                    }
                }
            }
        }
    }
};
