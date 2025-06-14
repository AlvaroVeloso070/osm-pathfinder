import {map, tileLayer, MapOptions, Map, TileLayer, latLng, GeoJSON, geoJson} from "leaflet";
import {Feature, GeoJsonObject, Geometry} from "geojson";

export default class MapManipulator {

    private readonly defaultTileLayerProvider : string = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    private readonly cartoDarkTileLayerProvider : string = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    private map : Map;
    private tileLayer !: TileLayer;
    private geojsonLayer !: GeoJSON<{}, Geometry>;

    constructor() {
        let mapOptions : MapOptions = {
            center: latLng(-16.67,  -49.25), // Centralizado em Goiânia
            zoom: 12,
            minZoom: 5,
            maxZoom: 20,
        }
        this.map = map('map', mapOptions)
        this.setTileLayer();
    }

    private setTileLayer(tileLayerProvider : string = this.defaultTileLayerProvider) {
        this.tileLayer = tileLayer(tileLayerProvider).addTo(this.map);
    }

    public setGeoJsonLayer(file : File) : void {
        if (!file.name.endsWith('.osm')) {
            alert("Formato de arquivo não suportado.")
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const osmData = new DOMParser().parseFromString(reader.result as string, "text/xml");
            const osmtogeojson = require('osmtogeojson');
            let geojson : GeoJsonObject = osmtogeojson(osmData);

            this.geojsonLayer = geoJson(geojson, {
                filter(geoJsonFeature: Feature<Geometry, any>): boolean {
                    return geoJsonFeature.geometry.type === "LineString";
                },
                style: {
                    color: '#1457ff',
                    weight: 3,
                    opacity: 0.9
                }
            }).addTo(this.map);
            this.map.fitBounds(this.geojsonLayer.getBounds());
        }

        reader.onerror = (e) => {
            console.error('Erro ao ler o arquivo:', e);
        };

        reader.readAsText(file);
    }

    public hideGeoJsonLayer() : void {
        if (this.geojsonLayer) {
            this.geojsonLayer.removeFrom(this.map);
        }
    }

    public showGeoJsonLayer () : void {
        if (this.geojsonLayer) {
            this.geojsonLayer.addTo(this.map);
        }
    }
}