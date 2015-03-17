/*var standard_fr = {
 "Standards" : {
 "constraints.required.message": "Propriété {propertyName} est requise.",
 "types.email.constraints.check_format.message": "Addresse mail invalide."
 }
 };
 */
(function (hyperstore, definition) {
    if (typeof module != 'undefined') definition(module.exports);
    else if (typeof define == 'function' && typeof define.amd == 'object') define(['exports', 'require'], definition(exports, require));
    else {
        definition(hyperstore);
    }
}(this.Hyperstore, function (exports) {
    exports.Schemas = exports.Schemas || {};

    // ***************************************************************************************
    // Shared types and constraints
    // ***************************************************************************************

    exports.Schemas.Standards = {
        id: "Standards",
        // Shared constraints can be referenced with the $ref property name.
        constraints: {
            "required": {
                message: "Property '{propertyName}' is required",
                check: function (val) {
                    return val != undefined;
                }
            }
        },
        // Shared types
        types: {
            "Date" : {
              constraints : {
                  "{value} is not a date for {propertyName}." : function(val) {
                      return val instanceof Date;
                  }
              }
            },
            // Identity is a string with a constraint checking if there is no another sibling element with
            // a property with the same value
            "identity": {
                type: "string",
                constraints: {
                    "duplicate": {
                        message: "Duplicate value '{value}' for {propertyName}",
                        // Property condition
                        // val : current value
                        // old : old value
                        // ctx : check context
                        //   - propertyName : current checked property
                        //   - element : current owner element
                        //   - log(msg,messageType?) - log a new diagnostic message
                        check: function (val, old, ctx) {
                            if (!val) return true;
                            var element = ctx.element.getInfo();
                            // find embedded relationship to this element.
                            var rel = ctx.element.getRelationships(undefined, 1 /*Incomings*/).firstOrDefault(function (r) {
                                return r.getSchemaElement().embedded;
                            });
                            var others = rel ?
                                rel.getStart().getRelationships(rel.getInfo().schemaElement).map(function(r) {return r.getEnd();}) : // sibling elements
                                element.domain.getElements(element.schemaElement); // all same type elements
                            return !others.any(function (e) {
                                return e[ctx.propertyName] === val && e.getId() !== element.id;
                            });
                        }
                    }
                }
            },
            // Check the max length of a string
            maxLength: {
                type: "string",
                max: 0,
                constraints: {
                    " Invalid value '{value}' for  {propertyName} must have less than {$max} characters.": function (val) {
                        return this.max === 0 || val.length <= this.max;
                    }
                }
            },
            // check email format
            email: {
                type: "string",
                optional: true,
                pattern: /[a-zA-Z0-9.!#$%&'*+-/=?\^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*/,
                constraints: {
                    check_format: {
                        message: "Invalid email '{value}' for property '{propertyName}'.",
                        check: function (val) {
                            return (!val && this.optional) || this.pattern.test(val);
                        }
                    }
                }
            },
            // Value must be one of a values list
            enum: {
                values: [],
                constraints: {
                    "invalid": {
                        message: "Invalid value '{value}' for property '{propertyName}' must be one of {$values}",
                        check: function (val) {
                            return this.values.indexOf(val) !== -1;
                        }
                    }
                }
            },
            // Value must be a number between min and max
            range: {
                type: "number",
                min: 0,
                max: 1,
                optional: false,
                constraints: {
                    "invalid": {
                        message: "Invalid value '{value}' for '{propertyName}' value must be between {$min} and {$max}",
                        check: function (val) {
                            return (!val && this.optional) || val >= this.min && val <= this.max;
                        }
                    }
                }
            },
            // Value must be an array where all elements are of a specified type
            arrayOf: {
                valueType: "string",
                optional: false,
                constraints: {
                    "invalid": {
                        message: "Invalid value '{value}' for '{propertyName}'. Must be an array of {$valueType}",
                        check: function (val) {
                            if (!val) return this.optional;
                            if (!val.length) return false;
                            var ok = true;
                            var self = this;
                            val.forEach(function (v) {
                                if (typeof v !== self.valueType) ok = false;
                            });
                            return ok;
                        }
                    }
                }
            }
        }
    };
}));