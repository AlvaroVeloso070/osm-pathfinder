import explode from "@turf/explode";
import roundCoord from "./round-coord";
import {Edge, PathFinderOptions, Topology} from "./types";
import {Feature, FeatureCollection, GeoJsonProperties, Geometry, LineString, Position} from "geojson";
import {AllGeoJSON, featureCollection} from "@turf/turf";

export default function createTopology<TEdgeData, TProperties extends GeoJsonProperties>(
  network: FeatureCollection<LineString, TProperties>,
  options: PathFinderOptions<TEdgeData, TProperties> = {}
): Topology<TProperties> {
  const { key = defaultKey } = options;
  const { tolerance = 1e-5 } = options;
  const lineStrings = featureCollection(
    network.features.filter((f) => f.geometry.type === "LineString")
  ) as FeatureCollection<LineString, TProperties>;
  const points = explode(lineStrings as AllGeoJSON);
  const vertices = points.features.reduce(function buildTopologyVertices(
    coordinates,
    feature,
    index,
    features
  ) {
    var rc = roundCoord(feature.geometry.coordinates, tolerance);
    coordinates[key(rc)] = feature.geometry.coordinates;

    if (index % 1000 === 0 && options.progress) {
      options.progress("topo:vertices", index, features.length);
    }

    return coordinates;
  },
  {} as Record<string, Position>);
  const edges = geoJsonReduce(
    lineStrings,
    buildTopologyEdges,
    [] as Edge<TProperties>[]
  );

  return {
    vertices: vertices,
    edges: edges,
  };

  function buildTopologyEdges(
    edges: Edge<TProperties>[],
    f: Feature<LineString, TProperties>
  ) {
    f.geometry.coordinates.forEach(function buildLineStringEdges(c, i, cs) {
      if (i > 0) {
        var k1 = key(roundCoord(cs[i - 1], tolerance)),
          k2 = key(roundCoord(c, tolerance));
        edges.push([k1, k2, f.properties]);
      }
    });

    return edges;
  }
}

function geoJsonReduce<T, G extends Geometry, P extends GeoJsonProperties>(
  geojson: FeatureCollection<G, P> | Feature<G, P>,
  fn: (accumulator: T, feature: Feature<G, P>) => T,
  seed: T
): T {
  if (geojson.type === "FeatureCollection") {
    return geojson.features.reduce(function reduceFeatures(a, f) {
      return geoJsonReduce(f, fn, a);
    }, seed);
  } else {
    return fn(seed, geojson);
  }
}

export function defaultKey(c: Position) {
  return c.join(",");
}
