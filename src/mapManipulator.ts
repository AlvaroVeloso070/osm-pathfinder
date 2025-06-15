import {
    GeoJSON,
    geoJson,
    latLng,
    LatLngBounds,
    map,
    Map,
    MapOptions,
    rectangle,
    Rectangle,
    tileLayer,
    TileLayer
} from "leaflet";
import {Feature, FeatureCollection, Geometry, LineString} from "geojson";

export default class MapManipulator {

    private readonly defaultTileLayerProvider : string = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    private readonly cartoDarkTileLayerProvider : string = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    private map : Map;
    private tileLayer !: TileLayer;
    private geojsonLayer !: GeoJSON<{}, Geometry>;
    private areaBorder !: Rectangle;

    private turf = require("@turf/turf");
    private extent = require("turf-extent");

    constructor() {
        let mapOptions : MapOptions = {
            center: latLng(-16.67,  -49.25), // Centralizado em Goiânia
            zoom: 12,
            minZoom: 5,
            maxZoom: 18,
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
            const osmData : Document = new DOMParser().parseFromString(reader.result as string, "text/xml");
            const osmtogeojson = require('osmtogeojson');
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
            this.geojsonLayer.removeFrom(this.map);
        }
    }

    public showGeoJsonLayer () : void {
        if (this.geojsonLayer) {
            this.geojsonLayer.addTo(this.map);
        }
    }

    private initializeGeojsonLayer(geojson: FeatureCollection, bounds: LatLngBounds) {
        const clippedGeojson = this.clipLineStringsWithBbox(geojson, bounds);

        if (this.geojsonLayer) this.geojsonLayer.removeFrom(this.map);
        this.geojsonLayer = geoJson(clippedGeojson, {
            filter(geoJsonFeature: Feature<Geometry, any>): boolean {
                return geoJsonFeature.geometry.type === "LineString";
            },
            style: {
                color: '#1457ff',
                weight: 4,
                opacity: 0.75,
            }
        }).addTo(this.map);

        if (this.areaBorder) this.areaBorder.removeFrom(this.map);
        this.areaBorder = rectangle(bounds, {
            color: 'red',
            weight: 2,
            dashArray: '8, 4',
            fill: false,
            interactive: false,
        }).addTo(this.map);

        this.map.fitBounds(bounds);
    }

    private clipLineStringsWithBbox(geojson: FeatureCollection, bounds: LatLngBounds): FeatureCollection {
        const clippedFeatures: Feature[] = [];

        // Criar bbox no formato [minX, minY, maxX, maxY]
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

                    // Usar turf.bboxClip para clipar a linha dentro do bbox
                    const clipped = this.turf.bboxClip(lineFeature, bbox);

                    // Verificar se a linha clippada tem coordenadas válidas
                    if (clipped && clipped.geometry.coordinates.length > 1) {
                        clippedFeatures.push({
                            ...feature,
                            geometry: clipped.geometry
                        });
                    }

                } catch (error) {
                    console.warn('Erro ao processar LineString com bboxClip:', error);
                    // Fallback: verificar se a linha está completamente dentro dos bounds
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
        };
    }

    private isLineWithinBounds(lineFeature: Feature<LineString>, bounds: LatLngBounds): boolean {
        return lineFeature.geometry.coordinates.every(coord => {
            const [lng, lat] = coord;
            return lng >= bounds.getWest() && lng <= bounds.getEast() &&
                lat >= bounds.getSouth() && lat <= bounds.getNorth();
        });
    }

}