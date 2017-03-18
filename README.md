# regional-planning

The `regional-planning` plugin is an updated version of the [map-tree](https://github.com/CoastalResilienceNetwork/map-tree/) plugin (formerly known as `layer-selector`). It has many of the same features, but with an updated UI, simplified configuration, and an integrated version of the [draw-and-report](https://github.com/CoastalResilienceNetwork/draw-and-report) plugin.

### Getting started

The easiest way to see how to configure the plugin is to take a look at [sample_layers.json](https://github.com/CoastalResilienceNetwork/regional-planning/blob/master/sample_layers.json). This configuration file exercises all of the of plugin's functionality. It initially started as updated version of the map-tree configuration for the [New Jersey region](https://github.com/CoastalResilienceNetwork/newjersey-region/blob/master/plugins/layer_selector/layers.json), but grew to test out more functionality.

The biggest difference between the configuration of the `map-tree` plugin and the `regional-planning` plugin is that **layers are identified by name and not id**. This was done so that layers could be reordered in the map service without having to update the layer configuration. However, if the name of the layer is updated in the map service, you must also update the configuration for any region using that layer. If there are layers with duplicate names within the same map service, you can use layer ids to disambiguate layers.

##### Top-level layer object

Top-level layers are the first thing you will specify in the configuration. They function as folders that contain layer groups and layers.

- **displayName** - The name that will be displayed in the plugin UI.
- **server** - Map service configuration information.

##### Server object

- **type** - The map service type. The only valid options are `ags` or `wms`.
- **layerType** - The type of layers that the service provides. Valid options are `dynamic` and `tiled`.
- **url** - For `ags` services, the URL to the services folder. For `wms` services, the URL to the root WMS service (it should end in `wms`).
- **name** - Only for `ags` services. The name of the service to use.

##### Layer object

The layer object is the core configuration object used in the config.

- **name** - The name of the layer. This must match the name of the layer in the map service. **For the top-level layers that function as folders, no value is required for `name`**
- **id** - The id of the layer. **This property is only required to disambiguate layers when there are multiple layers in a service with the same name**
- **displayName** - The name that will be displayed in the plugin UI.
- **description** - A custom description for the layer that will be shown in the plugin UI. If this is not specified, the description stored with the layer in the map service will be used.
- **downloadUrl** - URL to download the layer. This can be any URL, but should be a URL to a zip file, shapefile, or some other file related to the layer.
- **availableInRegions** - An array of subregions that the layer is available in. If this is not specified, the layer is available in all regions.
- **opacity** - A decimal value between 0 and 1 that indicates the opacity level for a layer. **Note**, for this to work for AGS layers, you must turn on "Allow per request modification of layer order and symbology" in the AGS manager for the relevant map service. This option is available under the "Dynamic Workspaces" header in the "Capabilities" tab.
- **includeAllLayers** - If this is set to `true` and the layer is a layer group, all of the sub-layers of the layer will be added to the UI.
- **includeLayers** - A list of layer objects that will be rendered as sub-layers in the UI for this layer.
- **excludeLayers** - If the layer is a layer group, specify a list of layer names to exclude from being displayed as sublayers in the UI. All other sublayers will be added.
- **combine** - If this is set to `true`, this layer and all of it's configured sublayers will be displayed as one layer in the plugin UI.
- **server** - If the layer is located on a different service than the parent layer, specify a server object with the server information for this layer.

##### Draw and report configuration

A sample report configuration is available in [sample_layers.json](https://github.com/CoastalResilienceNetwork/regional-planning/blob/master/sample_layers.json#L154-L188).

The following two configuration settings must be added to the `server` configuration object of the parent layer.

- **reportGpUrl** - The URL to the geoprocessing service used to generate reports.
- **reportDbPath** - The path to the report database for the configured layers.

To make a layer available in the `draw-and-report` plugin, the following configuration settings must be added to the layer configuration.

- **reportDbName** - The name of the corresponding layer in the report DB.
- **reports** - A list of report objects.

Report object

- **display** - The name to use in the plugin UI for the report.
- **units** - "sq. km.", "acres", etc.
- **field** - The field in the `reportDbName` layer that should be used to generate the report. If this is left blank, the "area" field will be used.

##### Structure

The nesting structure of the layers in the configuration file mimic the structure of the layers in the plugin UI. For example, consider this snippet of simplified configuration:

```json
{
   "displayName": "Top-level layer 1",
   "includeLayers": [
     {
       "name": "Layer A",
       "includeLayers": [
         {
           "name": "Layer B"
         }
       ]
      }
   ]
}
```

The layers in this configuration will be rendered like so in the UI:

```
> Top-level Layer 1
  > Layer A
    * ## Layer B
```

### Overriding the plugin UI

Components of the UI can be overridden by creating a `overrides.json` file. There is a sample available [here](https://github.com/CoastalResilienceNetwork/regional-planning/blob/master/overrides.json). The override configuration settings are detailed below.

- **name** - The name that is displayed in the plugin title bar. The default is "Regional Planning"
- **description** - The text that is displayed when users hover on the plugin button. The default is "Configure and control layers to be overlayed on the base map".
- **size** - The size of the plugin: `'small'`, `'large'`, or `'custom'`. The default is `'small'`. If `'custom'` is selected the plugin's width will be set from the `'width'` property.
- **width** - The width of the plugin in pixels. Required if `size` is set to `'custom'`; ignored otherwise.
- **hasCustomPrint** - Determines whether or not the plugin has a custom print layout. The default is `true`.
- **infoGraphic** - An image or HTML snippet to use as the infographic for the plugin introduction. The default is that there is no infographic.
