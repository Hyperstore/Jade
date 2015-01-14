var loc_fr = {
    "http://www.hyperstore.org/schemas/standards" : {
        $constraints : {
            "required" : {
                message : "Propriété {propertyName} est requise."
            }
        },
        $types : {
            email : {
                $constraints : {
                    check_format : {
                        message : "Addresse mail invalide."
                    }
                }
            }
        }
    }
};

var config =
{
    schemas: {
        std: {
            $name: "http://www.hyperstore.org/schemas/standards",
            // Shared constraints can be referenced with the $ref property name.
            $constraints: {
                "Property {propertyName} is required": {
                    name: "required", // unique id
                    check: function (val) {
                        return val != undefined;
                    }
                },
                "Duplicate value {value} for {propertyName}" : function(val, old, ctx) {
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
            },
            $types: {
                maxLength : {
                    $type:"string",
                    max:0,
                    $constraints : {
                        "Value {propertyName} must have less than {$max} characters." : function(val) {
                            return this.max === 0 || val.length <= this.max;
                        }
                    }
                },
                email : {
                    $type:"string",
                    optional:true,
                    reg : /[a-zA-Z0-9.!#$%&'*+-/=?\^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*/,
                    $constraints : {
                        "Invalid email" : {
                            name:"check_format",
                            check: function(val) {
                                return (!val && this.optional) || this.reg.test(val);
                            }
                        }
                    }
                },
                enum: {
                    values: [],
                    $constraints: {
                        "Invalid property {propertyName} must be one of {$values}": function (val) {
                            return this.values.indexOf(val) !== -1;
                        }
                    }
                },
                range: {
                    $type: "number",
                    min: 0,
                    max: 1,
                    optional:false,
                    $constraints: {
                        "Invalid {propertyName} value must be between {$min} and {$max}": function (val) {
                            return (!val && this.optional) || val >= this.min && val <= this.max;
                        }
                    }
                },
                arrayOf: {
                    type: "string",
                    optional:false,
                    $constraints: {
                        "Invalid {propertyName}. Must be an array of {$type}": function (val) {
                            if (!val) return this.optional;
                            if (!val.length) return false;
                            var ok = true;
                            val.forEach(function (v) {
                                if (typeof v !== this.type) ok = false;
                            });
                            return ok;
                        }
                    }
                }
            }
        }
    }
};