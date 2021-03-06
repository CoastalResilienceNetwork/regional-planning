﻿require({
    packages: [
        {
            name: "jquery",
            location: "//ajax.googleapis.com/ajax/libs/jquery/1.9.0",
            main: "jquery.min"
        }
    ]
});

define([
        "dojo/_base/declare",
        "dojo/Deferred",
        "dojo/promise/all",
        "jquery",
        "underscore",
        "dojo/text!./templates.html",
        "dojo/text!./overrides.json",
        "esri/layers/FeatureLayer",
        "esri/layers/ArcGISDynamicMapServiceLayer",
        "esri/layers/ArcGISTiledMapServiceLayer",
        "esri/layers/WMSLayer",
        "esri/layers/LayerDrawingOptions",
        "framework/PluginBase",
        "framework/util/ajax",
        //"./tests/index",
        "./State",
        "./Config",
        "./Tree",
        "./LayerNode",
    ],
    function(declare,
             Deferred,
             all,
             $,
             _,
             templates,
             overridesJson,
             FeatureLayer,
             ArcGISDynamicMapServiceLayer,
             ArcGISTiledMapServiceLayer,
             WMSLayer,
             LayerDrawingOptions,
             PluginBase,
             ajaxUtil,
             //unitTests,
             State,
             Config,
             Tree,
             LayerNode) {
        "use strict";

        var overrides = JSON.parse(overridesJson);
        return declare(PluginBase, {
            toolbarName: overrides.name || "Regional Planning",
            fullName: overrides.description || "Regional Planning",
            size: overrides.size || 'small',
            width: overrides.width || 300,
            hasCustomPrint: _.isUndefined(overrides.hasCustomPrint) ? true : overrides.hasCustomPrint,
            infoGraphic: _.isUndefined(overrides.infoGraphic) ? undefined : overrides.infoGraphic,
            toolbarType: "sidebar",
            allowIdentifyWhenActive: true,

            initialize: function (frameworkParameters, currentRegion) {
                declare.safeMixin(this, frameworkParameters);

                this.pluginTmpl = _.template(this.getTemplateById('plugin'));
                this.infoBoxContainerTmpl = _.template(this.getTemplateById('info-box-container'));
                this.layersPluginTmpl = _.template(this.getTemplateById('layers-plugin'));
                this.filterTmpl = _.template(this.getTemplateById('filter'));
                this.treeTmpl = _.template(this.getTemplateById('tree'));
                this.layerTmpl = _.template(this.getTemplateById('layer'));
                this.infoBoxTmpl = _.template(this.getTemplateById('info-box'));
                this.layerMenuId = _.uniqueId('layer-selector2-layer-menu-');

                this.state = new State();
                this.config = new Config();
                this.rebuildTree();

                this.bindEvents();
            },

            bindEvents: function() {
                this.bindTreeEvents();
                this.bindLayerMenuEvents();
            },

            bindTreeEvents: function() {
                var self = this;

                $(this.container)
                    .on('click', 'a.layer-row', function() {
                        if ($(this).parent().hasClass('unavailable')) {
                            return;
                        }

                        var layerId = self.getClosestLayerId(this),
                            layer = self.tree.findLayer(layerId);
                        self.toggleLayer(layer);
                    })
                    .on('click', 'a.info', function() {
                        self.state = self.state.setInfoBoxLayerId(self.getClosestLayerId(this));
                        self.showLayerInfo();
                    })
                    .on('keyup', 'input.filter', function() {
                        var $el = $(this),
                            filterText = $el.val();
                        self.applyFilter(filterText);
                    })
                    .on('click', 'a.reset', function() {
                        self.clearAll();
                    });
            },

            bindLayerMenuEvents: function() {
                var self = this;
                $(self.container)
                    .on('click', 'a.zoom', function() {
                        self.zoomToLayerExtent(self.getClosestLayerId(this));
                    })
                    .on('change', '.layer-tools .slider', function() {
                        var layerId = self.getClosestLayerId(this),
                            opacity = parseFloat($(this).find('input').val());
                        self.setLayerOpacity(layerId, opacity);
                    });
            },

            getClosestLayerId: function(el) {
                var $el = $(el),
                    $parent = $el.closest('[data-layer-id]'),
                    layerId = $parent.attr('data-layer-id');
                return layerId;
            },

            updateMap: function() {
                var selectedLayers = this.tree.findLayers(this.state.getSelectedLayers()),
                    visibleLayerIds = this.getVisibleLayers(selectedLayers);

                _.each(visibleLayerIds, function(layerServiceIds, serviceUrl) {
                    var mapLayer = this.map.getLayer(serviceUrl);

                    // Ignore feature group added by Draw & Report.
                    if (mapLayer instanceof esri.layers.GraphicsLayer) {
                        return;
                    }

                    if (mapLayer instanceof esri.layers.ArcGISTiledMapServiceLayer) {
                        if (layerServiceIds.length === 0) {
                            mapLayer.hide();
                        } else {
                            mapLayer.show();
                        }
                    } else {
                        if (layerServiceIds.length === 0) {
                            mapLayer.setVisibleLayers([]);
                        } else {
                            mapLayer.setVisibleLayers(layerServiceIds);
                        }
                    }
                }, this);

                this.setOpacityForSelectedLayers(selectedLayers);
            },

            // Return array of layer service IDs grouped by service URL.
            // ex. { serviceUrl: [id, ...], ... }
            getVisibleLayers: function(layers) {
                var visibleLayerIds = {};

                // Default existing layers to empty so that deselecting
                // all layers in a service will work correctly.
                _.each(this.map.getMyLayers(), function(mapLayer) {
                    visibleLayerIds[mapLayer.id] = [];
                });

                _.each(layers, function(layer) {
                    var service = layer.getService(),
                        serviceUrl = service.getServiceUrl(),
                        serviceId = layer.getServiceId();

                    if (_.isUndefined(serviceId)) {
                        return;
                    }

                    this.addServiceMapLayerIfNotExists(layer);

                    if (!visibleLayerIds[serviceUrl]) {
                        visibleLayerIds[serviceUrl] = [];
                    }

                    if (layer.isCombined()) {
                        _.each(layer.getChildren(), function(child) {
                            visibleLayerIds[serviceUrl].push(child.getServiceId());
                        });
                    } else {
                        visibleLayerIds[serviceUrl].push(layer.getServiceId());
                    }
                }, this);

                return visibleLayerIds;
            },

            setOpacityForSelectedLayers: function(layers) {
                // If the layers haven't been added to the map yet we can't proceed.
                if (_.isEmpty(layers)) { return; }

                var layerByService = _.groupBy(layers, function(layer) {
                        return layer.getService().getServiceUrl();
                    });

                _.each(layerByService, function(layers, serviceUrl) {
                    var service = layers[0].getService();
                    if (service.supportsOpacity()) {
                        var drawingOptions = this.getDrawingOptions(layers),
                            mapLayer = this.map.getLayer(serviceUrl);

                        mapLayer.setImageFormat('png32');
                        mapLayer.setLayerDrawingOptions(drawingOptions);
                    }
                }, this);
            },

            getDrawingOptions: function(layers) {
                var self = this,
                    drawingOptions = _.reduce(layers, function(memo, layer) {
                        var drawingOption = new LayerDrawingOptions({
                                // 0 is totally opaque, 100 is 100% transparent.
                                // Opacity is stored as a decimal from 0 (transparent)
                                // to 1 (opaque) so we convert it and invert it here.
                                transparency: 100 - (layer.getOpacity() * 100)
                            });

                        memo[layer.getServiceId()] = drawingOption;

                        return memo;
                    }, []);
                return drawingOptions;
            },

            // Create service layer and add it to the map if it doesn't already exist.
            addServiceMapLayerIfNotExists: function(layer) {
                var server = layer.getServer(),
                    serviceUrl = layer.getService().getServiceUrl(),
                    mapLayer = this.map.getLayer(serviceUrl);

                // There's nothing to do if the service layer already exists.
                if (mapLayer) {
                    return;
                }

                mapLayer = this.createServiceMapLayer(server, serviceUrl);

                // Need to assign a deterministic ID, otherwise, the ESRI
                // JSAPI will generate a unique ID for us.
                mapLayer.id = serviceUrl;
                this.map.addLayer(mapLayer);
            },

            createServiceMapLayer: function(server, serviceUrl) {
                if (server.type === 'ags') {
                    if (server.layerType === 'dynamic') {
                        return new ArcGISDynamicMapServiceLayer(serviceUrl);
                    } else if (server.layerType === 'tiled') {
                        return new ArcGISTiledMapServiceLayer(serviceUrl);
                    } else if (server.layerType === 'feature-layer') {
                        return new FeatureLayer(serviceUrl);
                    } else {
                        throw new Error('AGS service layer type is not supported: ' + server.layerType);
                    }
                } else if (server.type === 'wms') {
                    return new WMSLayer(serviceUrl);
                } else {
                    throw new Error('Service type not supported: ' + server.type);
                }
            },

            render: function() {
                var $el = $(this.pluginTmpl({}));

                // The info box floats outside of the side bar,
                // so we attach it to the body.
                $('body').append($(this.infoBoxContainerTmpl()));
                this.$infoBoxContainer = $('.info-box-container');

                $el.find('#layers').append($(this.layersPluginTmpl()));

                $(this.container).empty().append($el);
                this.renderLayerSelector();
            },

            renderLayerSelector: function() {
                this.renderFilter();
                this.renderTree();
                this.showLayerInfo();

                // Localize
                if ($.i18n) {
                    $(this.container).localize();
                }
            },

            renderFilter: function() {
                var html = this.filterTmpl({
                    filterText: this.state.getFilterText()
                });
                $(this.container).find('.filter-container').html(html);
            },

            renderTree: _.debounce(function() {
                var html = this.treeTmpl({
                    tree: this.filteredTree,
                    renderLayer: _.bind(this.renderLayer, this, 0)
                });
                $(this.container).find('.tree-container').html(html);

                if ($.i18n) {
                    $(this.container).localize();
                }
            }, 5),

            renderLayer: function(indent, layer) {
                var isSelected = layer.isSelected(),
                    isExpanded = layer.isExpanded(),
                    isUnavailable = layer.isUnavailable(),
                    infoBoxIsDisplayed = layer.infoIsDisplayed(),
                    opacity = layer.getOpacity(),
                    service = layer.getService(),
                    supportsOpacity = service.supportsOpacity();

                var cssClass = [];
                if (isSelected) {
                    cssClass.push('selected');
                }
                if (infoBoxIsDisplayed) {
                    cssClass.push('active');
                }
                if (isUnavailable) {
                    cssClass.push('unavailable');
                }
                cssClass.push(layer.isFolder() ? 'parent-node' : 'leaf-node');
                cssClass = cssClass.join(' ');

                return this.layerTmpl({
                    layer: layer,
                    cssClass: cssClass,
                    isSelected: isSelected,
                    isExpanded: isExpanded,
                    infoBoxIsDisplayed: infoBoxIsDisplayed,
                    indent: indent,
                    opacity: opacity,
                    renderLayer: _.bind(this.renderLayer, this, indent + 1),
                    supportsOpacity: supportsOpacity,
                });
            },

            getTemplateById: function(id) {
                return $('<div>').append(templates)
                    .find('#' + id)
                    .html().trim();
            },

            getState: function() {
                return {
                    layers: this.state.getState(),
                };
            },

            setState: function(data) {
                var self = this;

                var layerData = data.layers;

                this.state = new State(layerData);
                this.rebuildTree();
                this.renderLayerSelector();
                this.restoreSelectedLayers();
            },

            // Restore map service data for each selected layer
            // loaded from a saved state.
            restoreSelectedLayers: function() {
                var selectedLayers = this.state.getSelectedLayers(),
                    layerIds = _.reduce(selectedLayers, function(acc, layerId) {
                        // Map service data will be unavailable for on-demand
                        // layers that were persisted to state. Resolve this by
                        // also loading each parent layer.
                        return acc.concat(LayerNode.extractParentPaths(layerId));
                    }, []);

                _.each(layerIds, function(layerId) {
                    var layer = this.tree.findLayer(layerId);
                    if (layer) {
                        layer.getService().fetchMapService()
                            .then(this.rebuildTree.bind(this));
                    }
                }, this);
            },

            showSpinner: function() {
                $(this.container).find('#layers .loading').show();
            },

            hideSpinner: function() {
                $(this.container).find('#layers .loading').hide();
            },

            // Fetch all map services so that on-demand layers are available
            // for filtering. (See issue #555)
            preload: function() {
                if (this._preloaded) {
                    return new Deferred().resolve();
                }

                // Create list of distinct service urls.
                var serviceUrls = {};
                this.tree.walk(function(layer) {
                    var service = layer.getService(),
                        serviceUrl = service.getServiceUrl();
                    serviceUrls[serviceUrl] = true;
                });

                var self = this,
                    defer = new Deferred();

                this.showSpinner();

                // Fetch all map services found.
                var promise = all(_.map(serviceUrls, function(v, serviceUrl) {
                    // Cache map service response.
                    var options = {};
                    if (serviceUrl.match(/WMS/i)) {
                        options.format = 'text';
                        options.content = '';
                    }

                    return ajaxUtil.fetch(serviceUrl, options);
                }));

                promise.always(function() {
                    self._preloaded = true;
                    self.rebuildTree();

                    // Let the loading animation play for at least 1 second
                    // before hiding to prevent flashing.
                    _.delay(function() {
                        self.hideSpinner();
                        defer.resolve();
                    }, 1000);
                });

                return defer.promise;
            },

            activate: function() {
                var self = this;

                this.render();

                this.preload().then(function() {
                    self.renderLayerSelector();
                });

                this.$infoBoxContainer.show();
            },

            deactivate: function() {
                this.$infoBoxContainer.hide();
            },

            hibernate: function() {
                this.clearAll();
            },

            subregionActivated: function(currentRegion) {
                this.state = this.state.setCurrentRegion(currentRegion.id);
            },

            subregionDeactivated: function(currentRegion) {
                this.state = this.state.setCurrentRegion(null);
            },

            zoomToLayerExtent: function(layerId) {
                var self = this,
                    layer = this.tree.findLayer(layerId),
                    service = layer.getService();

                service.fetchLayerDetails(this.tree, layerId)
                    .then(function() {
                        self.rebuildTree();

                        var layer = self.tree.findLayer(layerId);
                        self.map.setExtent(layer.getExtent());
                    })
                    .otherwise(function(err) {
                        console.error(err);
                    });
            },

            showLayerInfo: function() {
                var layerId = this.state.getInfoBoxLayerId();
                if (!layerId) { return; }

                var self = this,
                    layer = this.tree.findLayer(layerId),
                    service = layer.getService();

                service.fetchLayerDetails(this.tree, layerId)
                    .then(function() {
                        self.rebuildTree();

                        var layer = self.tree.findLayer(layerId),
                            html = self.infoBoxTmpl({
                                layer: layer
                            });
                        self.$infoBoxContainer
                            .html(html)
                            .on('click', '.info-box .close', function() {
                                self.hideLayerInfo();
                            });
                    })
                    .otherwise(function(err) {
                        console.error(err);
                    });
            },

            hideLayerInfo: function() {
                this.$infoBoxContainer.empty();
                this.state = this.state.clearInfoBoxLayerId();
                this.rebuildTree();
            },

            toggleLayer: function(layer) {
                var self = this;
                this.state = this.state.toggleLayer(layer);
                this.rebuildTree();
                layer.getService().fetchMapService().then(function() {
                    self.rebuildTree();
                });
            },

            applyFilter: function(filterText) {
                var self = this;

                this.state = this.state.setFilterText(filterText).collapseAllLayers();
                this.rebuildTree();

                // Expand all layers that passed the filter.
                this.tree.walk(function(layer) {
                    self.state = self.state.expandLayer(layer.id());
                });
                this.rebuildTree();
            },

            clearAll: function() {
                this.state = new State();
                this.rebuildTree();
                this.renderLayerSelector();
            },

            setLayerOpacity: function(layerId, opacity) {
                this.state = this.state.setLayerOpacity(layerId, opacity);
                this.rebuildTree();
            },

            clearActiveStateForLayerTools: function(selector) {
                var completeSelector = '[data-layer-id].active ' + selector + ' i.active',
                    $el = $(this.container).find(completeSelector);

                $el.removeClass('active');
                $el.closest('[data-layer-id]').removeClass('active');
            },

            // Rebuild tree from scratch.
            rebuildTree: function() {
                this.tree = this.config.getTree().update(this.state);
                // Need to maintain a separate filtered tree so that map
                // layers remain visible even after applying a filter.
                this.filteredTree = this.tree
                    .filterByRegion(this.state.getCurrentRegion())
                    .filterByName(this.state.getFilterText());
                this.renderTree();
                this.updateMap();
            }
        });
    }
);
