'use strict';

angular.module('ajenti.dashboard', ['core']);

angular.module('ajenti.dashboard').run(function (customization) {
    customization.plugins.dashboard = {
        allowMove: true,
        allowRemove: true,
        allowConfigure: true,
        allowAdd: true,
        defaultConfig: {
            widgetsLeft: [{
                id: 'w1',
                typeId: 'hostname'

            }, {
                id: 'w2',
                typeId: 'cpu'
            }, {
                id: 'w3',
                typeId: 'loadavg'
            }],
            widgetsRight: [{
                id: 'w4',
                typeId: 'uptime'
            }, {
                id: 'w5',
                typeId: 'memory'
            }]
        }
    };
});


'use strict';

angular.module('core').config(function ($routeProvider) {
    $routeProvider.when('/view/dashboard', {
        templateUrl: '/dashboard:resources/partial/index.html',
        controller: 'DashboardIndexController'
    });
});


'use strict';

angular.module('ajenti.dashboard').controller('DashboardIndexController', function ($scope, $interval, gettext, notify, pageTitle, customization, messagebox, dashboard, config) {
    pageTitle.set(gettext('Dashboard'));

    $scope.ready = false;
    $scope._ = {};

    dashboard.getAvailableWidgets().then(function (data) {
        $scope.availableWidgets = data;
        $scope.widgetTypes = {};
        data.forEach(function (w) {
            return $scope.widgetTypes[w.id] = w;
        });
    });

    $scope.addWidget = function (index, widget) {
        widget = {
            id: Math.floor(Math.random() * 0x10000000).toString(16),
            typeId: widget.id
        };
        $scope.userConfig.dashboard.tabs[index].widgetsLeft.push(widget);
        return $scope.save().then(function () {
            if (widget.config_template) {
                $scope.configureWidget(widget);
            }
            $scope.refresh();
        });
    };

    config.getUserConfig().then(function (userConfig) {
        $scope.userConfig = userConfig;
        $scope.userConfig.dashboard = $scope.userConfig.dashboard || customization.plugins.dashboard.defaultConfig;

        if (!$scope.userConfig.dashboard.tabs) {
            $scope.userConfig.dashboard.tabs = [{
                name: 'Home',
                width: 2,
                widgetsLeft: $scope.userConfig.dashboard.widgetsLeft,
                widgetsRight: $scope.userConfig.dashboard.widgetsRight
            }];
            delete $scope.userConfig.dashboard['widgetsLeft'];
            delete $scope.userConfig.dashboard['widgetsRight'];
        }

        var updateInterval = $interval(function () {
            return $scope.refresh();
        }, 1000);

        $scope.$on('$destroy', function () {
            return $interval.cancel(updateInterval);
        });
    });

    $scope.onSort = function () {
        return $scope.save();
    };

    $scope.refresh = function () {
        var rq = [];
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = $scope.userConfig.dashboard.tabs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var tab = _step.value;
                var _iteratorNormalCompletion2 = true;
                var _didIteratorError2 = false;
                var _iteratorError2 = undefined;

                try {
                    for (var _iterator2 = tab.widgetsLeft.concat(tab.widgetsRight)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                        var widget = _step2.value;

                        rq.push({
                            id: widget.id,
                            typeId: widget.typeId,
                            config: widget.config || {}
                        });
                    }
                } catch (err) {
                    _didIteratorError2 = true;
                    _iteratorError2 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion2 && _iterator2.return) {
                            _iterator2.return();
                        }
                    } finally {
                        if (_didIteratorError2) {
                            throw _iteratorError2;
                        }
                    }
                }
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                    _iterator.return();
                }
            } finally {
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }

        dashboard.getValues(rq).then(function (data) {
            $scope.ready = true;
            data.forEach(function (resp) {
                return $scope.$broadcast('widget-update', resp.id, resp.data);
            });
        });
    };

    $scope.addTab = function (index) {
        return messagebox.prompt(gettext('New name')).then(function (msg) {
            if (!msg.value) {
                return;
            }
            $scope.userConfig.dashboard.tabs.push({
                widgetsLeft: [],
                widgetsRight: [],
                name: msg.value
            });
            $scope.save();
        });
    };

    $scope.removeTab = function (index) {
        messagebox.show({
            text: gettext('Remove the \'' + $scope.userConfig.dashboard.tabs[index].name + '\' tab?'),
            positive: gettext('Remove'),
            negative: gettext('Cancel')
        }).then(function () {
            $scope.userConfig.dashboard.tabs.splice(index, 1);
            $scope.save();
        });
    };

    $scope.renameTab = function (index) {
        var tab = $scope.userConfig.dashboard.tabs[index];
        messagebox.prompt(gettext('New name'), tab.name).then(function (msg) {
            if (!msg.value) {
                return;
            }
            tab.name = msg.value;
            $scope.save();
        });
    };

    $scope.configureWidget = function (widget) {
        widget.config = widget.config || {};
        $scope.configuredWidget = widget;
    };

    $scope.saveWidgetConfig = function () {
        $scope.save().then(function () {
            return $scope.refresh();
        });
        $scope.configuredWidget = null;
    };

    $scope.removeWidget = function (tab, widget) {
        tab.widgetsLeft.remove(widget);
        tab.widgetsRight.remove(widget);
        $scope.save();
    };

    $scope.save = function () {
        return config.setUserConfig($scope.userConfig);
    };
});


'use strict';

angular.module('ajenti.dashboard').controller('CPUWidgetController', function ($scope) {
    $scope.$on('widget-update', function ($event, id, data) {
        if (id !== $scope.widget.id) {
            return;
        }
        $scope.avg = 0;
        $scope.cores = 0;
        for (var i = 0; i < data.length; i++) {
            var x = data[i];
            $scope.avg += x / data.length;
            if (x > 0) {
                $scope.cores += 1;
            }
        }
        $scope.avgPercent = Math.floor($scope.avg * 100);
        $scope.values = data;
    });
});


'use strict';

angular.module('ajenti.dashboard').controller('HostnameWidgetController', function ($scope) {
    $scope.$on('widget-update', function ($event, id, data) {
        if (id !== $scope.widget.id) {
            return;
        }
        $scope.hostname = data;
    });
});


'use strict';

angular.module('ajenti.dashboard').controller('LoadAverageWidgetController', function ($scope) {
    $scope.$on('widget-update', function ($event, id, data) {
        if (id !== $scope.widget.id) {
            return;
        }
        $scope.load = data;
    });
});


'use strict';

angular.module('ajenti.dashboard').controller('MemoryWidgetController', function ($scope) {
    $scope.$on('widget-update', function ($event, id, data) {
        if (id !== $scope.widget.id) {
            return;
        }
        $scope.used = data.used;
        $scope.total = data.total;
        $scope.usage = Math.floor(100 * $scope.used / $scope.total);
    });
});


'use strict';

angular.module('ajenti.dashboard').controller('UptimeWidgetController', function ($scope) {
    $scope.$on('widget-update', function ($event, id, data) {
        if (id !== $scope.widget.id) {
            return;
        }
        $scope.uptime = data;
    });
});


'use strict';

angular.module('ajenti.dashboard').service('dashboard', function ($http, $q) {
    this.getAvailableWidgets = function () {
        return $http.get("/api/dashboard/widgets").then(function (response) {
            return response.data;
        });
    };

    this.getValues = function (data) {
        return $http.post("/api/dashboard/widgets-values", data, { ignoreLoadingBar: true }).then(function (response) {
            return response.data;
        });
    };

    return this;
});


