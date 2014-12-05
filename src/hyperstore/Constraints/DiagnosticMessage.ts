
/// <reference path="../_references.ts" />
module Hyperstore
{

    /**
     * A diagnostic message is emitted by a constraint and has some extended formatting features. Since constraint
     * are executed on a domain element, every diagnostic has a reference to this element and if the constraint is a
     * property constraint, the propertyName property is set.
     *
     * You can use this dynamic informations to create a message with pattern like {{property_name}}
     * (Only simple properties are allowed. xxx.yyy are not take into account.)
     *
     * **example** : "{{Email}} is already taken for customer {{Name}}"
     *
     * The special pattern {{propertyName}} can be used to include the property in error and property
     * beginning with a $ references property of the current constraint (useful for valueobject constraint)
     */
    export class DiagnosticMessage
    {
        public id:string;

        /**
         * create a diagnostic message instance - do not use directly
         * @param messageType
         * @param message
         * @param element
         * @param propertyName
         */
        constructor(
            public messageType:MessageType, public message:string, private element?:ModelElement,
            public propertyName?:string)
        {
            if (element)
            {
                this.id = element.id;
            }
        }

        /**
         *
         * @returns {string}
         * @private
         */
        static __format(message:string, element, propertyName:string, val?, old?):string
        {
            var self = this;
            var regex = /{\s*([^}\s]*)\s*}/g;
            return message.replace(regex, function (match, name)
                    {
                        switch(name)
                        {
                            case "value" :
                                return val;
                            case "oldValue" :
                                return old;
                            case "propertyName" :
                                return propertyName;
                            default :
                                return element ? element[name] : null;
                        }
                    });
        }

        static __prepareMessage(msg:string, constraint) : string {
            if( !msg || !constraint )
                return msg;

            var regex = /{\s*\$([^}\s]*)\s*}/g;
            return msg.replace(regex, function (match, name)
                {
                    return constraint[name];
                }
            );
        }
    }
}