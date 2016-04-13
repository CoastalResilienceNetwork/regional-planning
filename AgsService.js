define([
        "dojo/_base/declare",
        "underscore",
        "framework/util/ajax",
        "./util",
        "./LayerNode"
    ],
    function(declare,
             _,
             ajaxUtil,
             util,
             LayerNode) {
        "use strict";

        return declare(null, {
            constructor: function(server) {
                this.server = server;
            },

            getServiceUrl: function() {
                return util.urljoin(this.server.url, this.server.name, 'MapServer');
            },

            // Return a promise containing map service data.
            fetchMapService: function() {
                return ajaxUtil.fetch(this.getServiceUrl());
            },

            // Return cached map service data.
            getServiceData: function() {
                var serviceUrl = this.getServiceUrl();

                // If service information is only partially
                // defined or the config is bad for this
                // service, don't bother getting the data
                // because it the response is an error.
                if (serviceUrl.match(/undefined/) === null) {
                    return ajaxUtil.get(this.getServiceUrl());
                }

                return null;
            },

            // Return a promise with service layer data.
            fetchLayerDetails: function(tree, layerId) {
                var self = this;
                // We need to fetch the service before we can fetch the details.
                return this.fetchMapService()
                    .then(function(serviceData) {
                        var layer = tree.findLayer(layerId),
                            serviceLayer = self.findServiceLayer(layer),
                            url = util.urljoin(self.getServiceUrl(), serviceLayer.id);
                        return ajaxUtil.fetch(url);
                    });
            },

            // Return cached layer details.
            getLayerDetails: function(serviceLayer) {
                if (!serviceLayer) {
                    return;
                }
                var url = util.urljoin(this.getServiceUrl(), serviceLayer.id);
                return ajaxUtil.get(url);
            },

            // Find the corresponding data for `layer` in the map service.
            findServiceLayer: function(layer) {
                var serviceData = this.getServiceData();

                if (!serviceData || !layer) {
                    return null;
                } else if (serviceData instanceof Error) {
                    // If the response from the server was an
                    // error, the service is unavailable.
                    return {
                        isUnavailable: true
                    };
                }

                return _.find(serviceData.layers, function(serviceLayer) {
                    if (layer.getName() === serviceLayer.name) {
                        // Compare not only the name, but the structure as well.
                        // Protects against an edge case where a map service
                        // contains a parent and child layer with the same name.
                        if (layer.hasChildren() && serviceLayer.subLayerIds) {
                            return true;
                        } else if (!layer.hasChildren() && !serviceLayer.subLayerIds) {
                            return true;
                        }
                    }
                    return false;
                });
            },

            findServiceLayerById: function(layerId) {
                var serviceData = this.getServiceData();
                if (serviceData) {
                    return _.findWhere(serviceData.layers, { id: layerId });
                }
                return null;
            },

            supportsOpacity: function() {
                var serviceData = this.getServiceData();
                return serviceData && serviceData.supportsDynamicLayers;
            }
        });
    }
);