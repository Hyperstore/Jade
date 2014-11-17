//	Copyright © 2013 - 2014, Alain Metge. All rights reserved.
//
//		This file is part of hyperstore (http://www.hyperstore.org)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

angular.module("hyperstore", [])

.factory('$store', ['$http', function ($http) {
    var cookie;
    var offDestroy;

    var unsubscribe = function (store) {
        if (cookie) {
            store.removeSessionCompleted(cookie);
        }
        cookie = undefined;
    };

    return {
        store: undefined,

        loadDomain: function ($scope, domain, url, root) {
            var defer = $.Deferred();

            $http.get(url).then(function (result) {
                if (result.status == 200) {
                    unsubscribe(domain.store);

                    var schema;
                    var data = result.data;
                    if (root) {
                        if (root.schema)
                            schema = domain.store.getSchemaElement(root.schema);
                        if (root.get)
                            data = root.get(data);
                    }
                    var list = domain.loadFromJson(data, schema);

                    cookie = domain.store.onSessionCompleted(function () {
                        if (!$scope.$$phase)
                            $scope.$digest();
                    });

                    offDestroy = $scope.$on("$destroy", function () { offDestroy(); unsubscribe(domain.store); });

                    defer.resolve({ domain: domain, elements: list });
                }
                else {
                    defer.reject();
                }
            });
            return defer.promise();
        },

        createDomain: function (name, def, adapters) {
            this.store = this.store || new Hyperstore.Store();

            new Hyperstore.Schema(this.store, undefined, def);
            var domain = new Hyperstore.DomainModel(this.store, name);

            var defer = $.Deferred();

            var tasks = [];
            Hyperstore.Utils.forEach(adapters, function (a) {
                var d = $.Deferred();
                tasks.push(d.promise());
                domain.addAdapterAsync.call(domain, a).then(
                    function (adapter) {
                        adapter.loadElementsAsync().done(function (result) {
                            d.resolve(result.maxVersionNumber);
                        });
                    }
                )
            });

            $.when.apply($, tasks).done(function (version) {
                defer.resolve({ domain: domain, version: version });
            });
            return defer.promise();
        }
    };
}])

.directive('ngModel', ["$store", function ($store) {
    return {
        restrict: 'A',
        require: '?ngModel',
        link: function (scope, elem, attrs, ngModel) {
            var fn = ngModel.$setViewValue;
            var store = $store.store;
            ngModel.$setViewValue = function (val) {
                var session = store.beginSession();
                fn.call(ngModel, val);
                session.acceptChanges();
                var result = session.close();
                Hyperstore.Utils.forEach(result.involvedElements, function (mel) {
                    delete mel.$errors;
                });

                for (var k in result.messages) {
                    var msg = result.messages[k];
                    var name = msg.propertyName || "$element";
                    msg.element.$errors = msg.element.$errors || {};
                    ngModel.$setValidity(name, false);
                    msg.element.$errors[name] = msg.element.$errors[name] || [];
                    msg.element.$errors[name].push(msg.toString());
                }
            }
        }
    }
}]);