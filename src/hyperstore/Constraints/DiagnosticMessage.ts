
/// <reference path="../_references.ts" />
module Hyperstore
{

    /**
     * A diagnostic message is emitted by a constraint and has some extended formatting features. Since constraint
     * are executed on a domain element, every diagnostic has a reference to this element and if the constraint is a
     * property constraint, the propertyName property is set.
     *
     * You can use this dynamic informations to create a message with pattern like {{$property_name}}
     * (Only simple properties are allowed. xxx.yyy are not take into account.)
     *
     * **example** : "{{Email}} is already taken for customer {{Name}}"
     *
     * Special patterns :
     *  - $propertyName : Name of the current checked property (*)
     *  - $id           : Current element id
     *  - $schema       : Current element schema id
     *  - $identity     : Try to display an identity for the current element by checking in order :
     *          1 - IsKey property(ies) value
     *          2 - An id property
     *          3 - A name property
     *          4 - $id
     *  - $value        : value of the checked property (*)
     *  - $oldValue     : old value of the checked property (*)
     *  can be used.
     *  (*) Only valid on a property constraint.
     *  Property beginning with '@', references property of the current constraint (useful for valueobject constraint)
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
            public messageType:MessageType, public message:string, private element?:Element,
            public propertyName?:string)
        {
            if (element)
            {
                this.id = element.getInfo().id;
            }
        }

        /**
         *
         * @returns {string}
         */
        toString() {
            return this.message;
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
                            case "$value" :
                                return val;
                            case "$schema":
                                return element.getSchemaElement().id;
                            case "$identity" :
                                return element.id || element.name || element.getKey(true) || element.getId();
                            case "$id" :
                                return element.getId();
                            case "$oldValue" :
                                return old;
                            case "$propertyName" :
                                return propertyName;
                            default :
                                if(!element) return null;
                                if(name[0] === '$') {
                                    var info = element.getInfo();
                                    return info[name.substring(1)];
                                }
                                return element[name];
                        }
                    });
        }

        static __prepareMessage(msg:string, constraint) : string {
            if( !msg || !constraint )
                return msg;

            var regex = /{\s*\@([^}\s]*)\s*}/g;
            return msg.replace(regex, function (match, name)
                {
                    return constraint[name];
                }
            );
        }
    }
}