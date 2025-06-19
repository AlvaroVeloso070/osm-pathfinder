import {
    GeoJSON,
    geoJson,
    latLng,
    LatLngBounds,
    LayerGroup,
    map,
    Map,
    MapOptions,
    PathOptions,
    rectangle,
    Rectangle,
    Routing,
    StyleFunction,
    tileLayer,
    TileLayer
} from "leaflet";
import "leaflet-routing-machine";
import {Feature, FeatureCollection, GeoJsonProperties, Geometry, LineString} from "geojson";
import {GeoJSONInfo} from "./types";
import * as turf from "@turf/turf";
import osmtogeojson from "osmtogeojson";
import {Router} from "./router";

export default class MapManipulator {

    private readonly defaultTileLayerProvider : string = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    private readonly cartoDarkTileLayerProvider : string = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    private readonly map : Map;
    private layerGroup : LayerGroup;
    private tileLayer !: TileLayer;
    private clippedGeojson !: FeatureCollection<LineString, GeoJsonProperties>;
    private geojsonLayer !: GeoJSON<{}, Geometry>;
    private geojsonInfo !: GeoJSONInfo;
    private areaBorder !: Rectangle;
    private isGeoJSONLayerVisible : boolean = false;
    private router !: Router;

    constructor() {
        let mapOptions : MapOptions = {
            center: latLng(-16.67,  -49.25), // Centralizado em Goiânia
            zoom: 12,
            minZoom: 5,
            maxZoom: 18,
        }
        this.map = map('map', mapOptions)
        this.setTileLayer();
        this.layerGroup = new LayerGroup();
        this.layerGroup.addTo(this.map)
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
            const osmData : Document = new DOMParser().parseFromString(reader.result as string, "text/xml");
            let geojson : FeatureCollection = osmtogeojson(osmData);

            let osmBounds : LatLngBounds = this.getOsmBounds(osmData)
            this.initializeGeojsonLayer(geojson, osmBounds);
        }

        reader.onerror = (e) => {
            console.error('Erro ao ler o arquivo:', e);
        };

        reader.readAsText(file);
    }

    private getOsmBounds(osmData: Document) : LatLngBounds {
        try{
            const boundsElement = osmData.querySelector("bounds");

            if (boundsElement) {
                const minlat = parseFloat(<string>boundsElement.getAttribute("minlat"));
                const minlon = parseFloat(<string>boundsElement.getAttribute("minlon"));
                const maxlat = parseFloat(<string>boundsElement.getAttribute("maxlat"));
                const maxlon = parseFloat(<string>boundsElement.getAttribute("maxlon"));

                return new LatLngBounds([minlat, minlon], [maxlat, maxlon]);
            } else {
                throw new Error("Bounds element not found in OSM file");
            }
        }catch(e){
            alert("Erro ao carregar a área do arquivo OSM");
            throw e;
        }
    }

    public hideGeoJsonLayer() : void {
        if (this.geojsonLayer) {
            this.isGeoJSONLayerVisible = false;
            this.geojsonLayer.setStyle(this.getGeojsonStyle());
        }
    }

    public showGeoJsonLayer () : void {
        if (this.geojsonLayer) {
            this.isGeoJSONLayerVisible = true;
            this.geojsonLayer.setStyle(this.getGeojsonStyle());
        }
    }

    private initializeGeojsonLayer(geojson: FeatureCollection, bounds: LatLngBounds) {
        this.clippedGeojson = this.clipLineStringsWithBbox(geojson, bounds);

        if (this.geojsonLayer) this.geojsonLayer.removeFrom(this.map);
        this.geojsonLayer = geoJson(this.clippedGeojson, {
            style: this.getGeojsonStyle()
        });
        this.layerGroup.addLayer(this.geojsonLayer);

        if (this.areaBorder) this.areaBorder.removeFrom(this.map);
        this.areaBorder = rectangle(bounds, {
            color: 'red',
            weight: 2,
            dashArray: '8, 4',
            fill: false,
            interactive: false,
        });
        this.layerGroup.addLayer(this.areaBorder);
        this.areaBorder.bringToFront();
        this.addRouting();
        this.map.fitBounds(bounds);
    }

    private getGeojsonStyle() :  PathOptions | StyleFunction{
        return {
            color: '#1457ff',
            weight: 3,
            opacity: this.isGeoJSONLayerVisible ? 1 : 0
        }
    }

    private clipLineStringsWithBbox(geojson: FeatureCollection, bounds: LatLngBounds): FeatureCollection<LineString, GeoJsonProperties> {
        const clippedFeatures: Feature[] = [];

        const bbox: [number, number, number, number] = [
            bounds.getWest(),  // minX (longitude oeste)
            bounds.getSouth(), // minY (latitude sul)
            bounds.getEast(),  // maxX (longitude leste)
            bounds.getNorth()  // maxY (latitude norte)
        ];

        const processFeature = (feature: Feature) => {
            if (feature.geometry.type === "LineString") {
                try {
                    const lineFeature = feature as Feature<LineString>;

                    const clipped = turf.bboxClip(lineFeature, bbox);

                    if (clipped && clipped.geometry.coordinates.length > 1) {
                        clippedFeatures.push({
                            ...feature,
                            geometry: clipped.geometry
                        });
                    }

                } catch (error) {
                    console.warn('Erro ao processar LineString com bboxClip:', error);
                    const lineFeature = feature as Feature<LineString>;
                    if (this.isLineWithinBounds(lineFeature, bounds)) {
                        clippedFeatures.push(feature);
                    }
                }
            }
        };

        geojson.features.forEach(processFeature);

        return {
            type: 'FeatureCollection',
            features: clippedFeatures
        } as FeatureCollection<LineString, GeoJsonProperties>;
    }

    private isLineWithinBounds(lineFeature: Feature<LineString>, bounds: LatLngBounds): boolean {
        return lineFeature.geometry.coordinates.every(coord => {
            const [lng, lat] = coord;
            return lng >= bounds.getWest() && lng <= bounds.getEast() &&
                lat >= bounds.getSouth() && lat <= bounds.getNorth();
        });
    }

    private addRouting(){
        this.router = new Router(this.clippedGeojson)
        Routing.control({
            waypoints: [
                latLng(-16.678792, -49.249805),
                latLng(-16.688735, -49.259037)
            ],
            router: this.router,
            autoRoute: true,
            routeDragInterval: 100,
        }).addTo(this.map);
    }

}