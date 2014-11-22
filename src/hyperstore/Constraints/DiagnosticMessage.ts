
/// <reference path="../_references.ts" />
module Hyperstore
{

    /**
     * A diagnostic message is emitted by a constraint and has some extended formatting features. Since constraint
     * are executed on a domain element, every diagnostic has a reference to this element and if the constraint is a
     * property constraint, the propertyName property is set.
     *
     * You can use this dynamic informations to create a message with pattern like {{property_Name}}
     * (Only simple properties are allowed. xxx.yyy are not take into account.)
     *
     * **example** : "{{Email}} is already taken for customer {{Name}}"
     *
     * The special pattern {{propertyName}} can be used to include the property in error.
     */
    export class DiagnosticMessage
    {
        public id:string;

        /**
         * create a diagnostic message instance - do not use directly
         * @param messageType
         * @param rawMessage
         * @param element
         * @param propertyName
         */
        constructor(
            public messageType:MessageType, public rawMessage:string, private element?:ModelElement,
            public propertyName?:string)
        {
            if (element)
            {
                this.id = element.id;
            }
        }

        /**
         * get the formatted message
         * @returns {string} - formatted message
         */
        get message():string
        {
            if (!this.element)
            {
                return this.rawMessage;
            }

            var self = this;
            var regex = /{\s*(\S*)\s*}/g;
            return this.rawMessage
                .replace(
                regex, function (match, name)
                {
                    return name === "propertyName" ? this.propertyName : self.element[name];
                }
            );
        }
    }
}