import {
  divIcon,
  GeoJSON,
  geoJson,
  LatLng,
  latLng,
  LatLngBounds,
  LayerGroup,
  map,
  Map,
  MapOptions,
  marker,
  PathOptions,
  rectangle,
  Rectangle,
  Routing,
  StyleFunction,
  tileLayer,
  TileLayer,
} from "leaflet";
import "leaflet-routing-machine";
import {Feature, FeatureCollection, GeoJsonProperties, Geometry, LineString,} from "geojson";
import {GeoJSONInfo, Vertices} from "./types";
import * as turf from "@turf/turf";
import osmtogeojson from "osmtogeojson";
import {Router} from "./router";

export default class MapManipulator {
  private readonly defaultTileLayerProvider: string =
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  private readonly cartoDarkTileLayerProvider: string =
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  private readonly cartoLightTileLayerProvider: string =
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  private readonly map: Map;
  private layerGroup: LayerGroup;
  private tileLayer!: TileLayer;
  private clippedGeojson!: FeatureCollection<LineString, GeoJsonProperties>;
  private geojsonLayer!: GeoJSON<{}, Geometry>;
  private geojsonInfo!: GeoJSONInfo;
  private areaBorder!: Rectangle;
  private isGeoJSONLayerVisible: boolean = false;
  private router!: Router;
  private routingControl!: Routing.Control;
  private routeWaypoints: LatLng[] = [];
  private markersChangeCallback?: () => void;

  constructor() {
    let mapOptions: MapOptions = {
      center: latLng(-16.67, -49.25), // Centralizado em Goiânia
      zoom: 12,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: false, // Remove zoom buttons for cleaner look
      attributionControl: false, // Remove attribution text
    };
    this.map = map("map", mapOptions);
    this.setTileLayer();
    this.layerGroup = new LayerGroup();
    this.layerGroup.addTo(this.map);
  }

  private setTileLayer(
    tileLayerProvider: string = this.defaultTileLayerProvider
  ) {
    this.tileLayer = tileLayer(tileLayerProvider).addTo(this.map);
  }

  public setGeoJsonLayer(file: File, onComplete?: () => void): void {
    if (!file.name.endsWith(".osm")) {
      alert("Formato de arquivo não suportado.");
      onComplete?.();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const osmData: Document = new DOMParser().parseFromString(
          reader.result as string,
          "text/xml"
        );
        let geojson: FeatureCollection = osmtogeojson(osmData);

        let osmBounds: LatLngBounds = this.getOsmBounds(osmData);
        this.initializeGeojsonLayer(geojson, osmBounds);
        onComplete?.();
      } catch (error) {
        console.error("Erro ao processar o arquivo:", error);
        onComplete?.();
      }
    };

    reader.onerror = (e) => {
      console.error("Erro ao ler o arquivo:", e);
      onComplete?.();
    };

    reader.readAsText(file);
  }

  private getOsmBounds(osmData: Document): LatLngBounds {
    try {
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
    } catch (e) {
      alert("Erro ao carregar a área do arquivo OSM");
      throw e;
    }
  }

  public hideGeoJsonLayer(): void {
    if (this.geojsonLayer) {
      this.isGeoJSONLayerVisible = false;
      this.geojsonLayer.setStyle(this.getGeojsonStyle());
    }
  }

  public showGeoJsonLayer(): void {
    if (this.geojsonLayer) {
      this.isGeoJSONLayerVisible = true;
      this.geojsonLayer.setStyle(this.getGeojsonStyle());
    }
  }

  public isGeoJsonLayerVisible(): boolean {
    return this.isGeoJSONLayerVisible;
  }

  private initializeGeojsonLayer(
    geojson: FeatureCollection,
    bounds: LatLngBounds
  ) {
    this.clippedGeojson = this.clipLineStringsWithBbox(geojson, bounds);

    this.isGeoJSONLayerVisible = true;

    if (this.geojsonLayer) this.geojsonLayer.removeFrom(this.map);
    this.geojsonLayer = geoJson(this.clippedGeojson, {
      style: this.getGeojsonStyle(),
    });
    this.layerGroup.addLayer(this.geojsonLayer);

    if (this.areaBorder) this.areaBorder.removeFrom(this.map);
    this.areaBorder = rectangle(bounds, {
      color: "red",
      weight: 2,
      dashArray: "8, 4",
      fill: false,
      interactive: false,
    });
    this.layerGroup.addLayer(this.areaBorder);
    this.areaBorder.bringToFront();
    this.addRouting();
    this.setupMapClickHandler(bounds);
    this.map.fitBounds(bounds);

    let totalDistance : number = this.clippedGeojson.features.reduce((total : number, feature : Feature<LineString>) => {
      return total + turf.length(feature, {units: "kilometers"});
    }, 0);

    let vertices : Vertices = this.router.pathFinder.graph.compactedVertices;
    let nodeNames = Object.keys(vertices);
    let totalNodes : number = nodeNames.length;
    let totalEdges : number = nodeNames.reduce((total : number, nodeName : string)=> {
      return total + Object.keys(vertices[nodeName]).length;
    }, 0);
    let coordinates : number = this.router.points.features.length;

    this.geojsonInfo = {
      totalDistance: totalDistance,
      totalNodes: totalNodes,
      totalEdges: totalEdges,
      coordinates: coordinates
    }
  }

  private setupMapClickHandler(bounds: LatLngBounds) {
    this.map.on("click", (e) => {
      const clickedPoint = e.latlng;

      if (bounds.contains(clickedPoint)) {
        this.addRoutingWaypoint(clickedPoint);
      }
    });
  }

  private getGeojsonStyle(): PathOptions | StyleFunction {
    return {
      color: "#3B82F6", // Subtle blue (tailwind blue-500)
      weight: 1,
      opacity: this.isGeoJSONLayerVisible ? 0.9 : 0,
    };
  }

  private clipLineStringsWithBbox(
    geojson: FeatureCollection,
    bounds: LatLngBounds
  ): FeatureCollection<LineString, GeoJsonProperties> {
    const clippedFeatures: Feature[] = [];

    const bbox: [number, number, number, number] = [
      bounds.getWest(), // minX (longitude oeste)
      bounds.getSouth(), // minY (latitude sul)
      bounds.getEast(), // maxX (longitude leste)
      bounds.getNorth(), // maxY (latitude norte)
    ];

    const processFeature = (feature: Feature) => {
      if (feature.geometry.type === "LineString") {
        try {
          const lineFeature = feature as Feature<LineString>;

          const clipped = turf.bboxClip(lineFeature, bbox);

          if (clipped && clipped.geometry.coordinates.length > 1) {
            clippedFeatures.push({
              ...feature,
              geometry: clipped.geometry,
            });
          }
        } catch (error) {
          console.warn("Erro ao processar LineString com bboxClip:", error);
          const lineFeature = feature as Feature<LineString>;
          if (this.isLineWithinBounds(lineFeature, bounds)) {
            clippedFeatures.push(feature);
          }
        }
      }
    };

    geojson.features.forEach(processFeature);

    return {
      type: "FeatureCollection",
      features: clippedFeatures,
    } as FeatureCollection<LineString, GeoJsonProperties>;
  }

  private isLineWithinBounds(
    lineFeature: Feature<LineString>,
    bounds: LatLngBounds
  ): boolean {
    return lineFeature.geometry.coordinates.every((coord) => {
      const [lng, lat] = coord;
      return (
        lng >= bounds.getWest() &&
        lng <= bounds.getEast() &&
        lat >= bounds.getSouth() &&
        lat <= bounds.getNorth()
      );
    });
  }

  private addRouting() {
    this.router = new Router(this.clippedGeojson);
    this.routingControl = Routing.control({
      router: this.router,
      autoRoute: true,
      routeDragInterval: 100,
      addWaypoints: true, // Disable default waypoint adding behavior for cleaner interface
      routeWhileDragging: false, // Reduce visual noise during dragging
      showAlternatives: false, // Hide alternative routes for cleaner look
      fitSelectedRoutes: false, // Don't auto-fit bounds for more control
      // @ts-ignore
      createMarker: (i: number, waypoint: Routing.Waypoint, n: number) => {
        let markerClass = "waypoint-marker";
        if (i === 0) markerClass += " start-marker";
        else if (i === n - 1) markerClass += " end-marker";
        else markerClass += " intermediate-marker";

        const newMarker = marker(waypoint.latLng, {
          draggable: true,
          icon: divIcon({
            className: markerClass,
            html: `<span class="marker-text" data-number="${i + 1}"></span>`,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          }),
        });

        // Adiciona evento de clique para remover o marcador
        newMarker.on("click", (e) => {
          if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
            // Remove apenas se Ctrl/Cmd estiver pressionado para evitar remoção acidental
            const waypoints = this.routingControl.getWaypoints();
            waypoints.splice(i, 1);
            this.routeWaypoints = waypoints
              .map((wp) => wp.latLng)
              .filter(Boolean);
            this.routingControl.setWaypoints(this.routeWaypoints);
            this.markersChangeCallback?.();
          }
        });

        // Adiciona evento de drag para atualizar posições quando marcador é movido
        newMarker.on("dragend", () => {
          // Atualiza o array interno com as posições atuais dos marcadores
          const currentWaypoints = this.routingControl.getWaypoints();
          this.routeWaypoints = currentWaypoints
            .map((wp) => wp.latLng)
            .filter(Boolean);
          this.markersChangeCallback?.();
        });

        return newMarker;
      },
    }).addTo(this.map);
  }

  private addRoutingWaypoint(waypoint: LatLng) {
    if (this.routingControl) {
      const currentWaypoints = this.routingControl.getWaypoints();
      const currentPositions = currentWaypoints
        .map((wp) => wp.latLng)
        .filter(Boolean);

      currentPositions.push(waypoint);
      this.routeWaypoints = currentPositions;

      this.routingControl.setWaypoints(this.routeWaypoints);
      this.markersChangeCallback?.();
    }
  }

  clearRoutingWaypoints() {
    if (this.routingControl) {
      this.routeWaypoints = [];
      this.routingControl.setWaypoints(this.routeWaypoints);
      this.markersChangeCallback?.();
    }
  }

  hasMarkers(): boolean {
    return this.routeWaypoints.length > 0;
  }

  getWaypoints(): LatLng[] {
    if (this.routingControl) {
      const currentWaypoints = this.routingControl.getWaypoints();
      return currentWaypoints.map((wp) => wp.latLng).filter(Boolean);
    }
    return [...this.routeWaypoints];
  }

  addWaypoint(waypoint: LatLng): void {
    if (this.routingControl) {
      this.routeWaypoints.push(waypoint);
    }
  }

  removeWaypointAt(index: number): void {
    if (
      this.routingControl &&
      index >= 0 &&
      index < this.routeWaypoints.length
    ) {
      const currentWaypoints = this.routingControl.getWaypoints();
      const currentPositions = currentWaypoints
        .map((wp) => wp.latLng)
        .filter(Boolean);

      currentPositions.splice(index, 1);
      this.routeWaypoints = currentPositions;

      this.routingControl.setWaypoints(this.routeWaypoints);
      this.markersChangeCallback?.();
    }
  }

  setMarkersChangeCallback(callback: () => void): void {
    this.markersChangeCallback = callback;
  }

  getHighwaySpeeds() {
    if (this.router) {
      return this.router.getHighwaySpeeds();
    }
    return null;
  }

  setHighwaySpeeds(speeds: any): void {
    if (this.router) {
      this.router.setHighwaySpeeds(speeds);
    }
  }

  updateHighwaySpeed(type: string, speed: number): void {
    if (this.router) {
      this.router.updateHighwaySpeed(type as any, speed);
    }
  }
}
