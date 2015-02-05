
exports.schema = {
    id: "Lib",
    types: {
        Email: {
            type: "string",
            serialize: function (val) {
                return val;
            },
            constraints: {
                "Malformed email": function (value, oldValue) {
                    return value != null;
                }
            }
        }
        //deserialize
    },
    Library: {
        properties: {
            Name: "string"
        },
        references: {
            Books: {
                end: "Book",
                kind: "1=>*"
            }
        }
    },
    Book: {
        properties: {
            Copies: {type: "number", default: 0},
            Title: {
                type: "string",
                default: undefined,
                constraints: {
                    "Title is required": function (value, oldValue) {
                        return value != null;
                    }
                }
            },
            AsString: function (self) {
                return self.Title + " Copies : " + self.Copies;
            }
        },
        references: {
            Library: {
                end: "Library",
                kind: "*<=1"
            } // Opposite
        },
        LibraryHasBooks: {
            source: "Library",
            end: "Book",
            kind: "1=>*"
        }
    }
};