import {latLng, Routing} from 'leaflet';
import 'leaflet-routing-machine';
import {Feature, FeatureCollection, GeoJsonProperties, LineString, Point} from "geojson";
import {HighwaySpeeds, Vertices} from "./types";
import PathFinder from "./pathFinder";
import * as turf from "@turf/turf"

export class Router implements Routing.IRouter  {

    private readonly highwaySpeeds : HighwaySpeeds;
    private pathFinder : PathFinder<LineString>;
    private unknowns: Record<string, boolean> = {};
    private points: FeatureCollection<Point>;

    // Funções de utilidade
    private util = {
        toPoint: function (wp : Routing.Waypoint) {
            let c = wp.latLng;
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [c.lng, c.lat]
                }
            };
        },

        toLatLng: function (p : Feature<Point>) {
            if (Array.isArray(p)) {
                return latLng(p[0],p[1]);
            }
            return latLng(p.geometry.coordinates[1], p.geometry.coordinates[0]);
        }
    };

    constructor(private geojson : FeatureCollection<LineString, GeoJsonProperties>) {
        this.highwaySpeeds = {
            motorway: 120,         // Rodovias duplicadas
            trunk: 100,            // Rodovias simples ou vias expressas
            primary: 80,           // Vias arteriais principais
            secondary: 60,         // Vias arteriais secundárias
            tertiary: 50,          // Vias coletoras
            unclassified: 50,      // Vias locais
            road: 50,              // Vias locais
            residential: 30,       // Áreas residenciais
            service: 20,           // Vias de serviço, estacionamentos
            living_street: 10,     // Áreas compartilhadas com pedestres
        };

        this.pathFinder = new PathFinder(geojson, {
            tolerance: 1e-9,
            weight: this.weightFn.bind(this)
        });

        // Extrair todos os pontos do GeoJSON para uso na busca do ponto mais próximo
        let vertices : Vertices = this.pathFinder.graph.vertices;
        this.points = turf.featureCollection<Point>(
            Object.keys(vertices).filter((nodeName)=> {
                return Object.keys(vertices[nodeName]).length
            }).map((nodeName) => {
                return turf.point(this.pathFinder.graph.sourceCoordinates[nodeName]);
            })
        );
    }

    private weightFn = (a: any, b: any, props: any) => {
        const d = turf.distance(turf.point(a), turf.point(b)) * 1000;
        let factor = 0.9;
        let type = props.highway || '';
        let forwardSpeed: number | null;
        let backwardSpeed: number | null;

        if (props.maxspeed) {
            forwardSpeed = backwardSpeed = Number(props.maxspeed);
        } else {
            const linkIndex = type.indexOf("_link");
            if (linkIndex >= 0) {
                type = type.substring(0, linkIndex);
                factor *= 0.7;
            }

            forwardSpeed = backwardSpeed = this.highwaySpeeds[type as keyof HighwaySpeeds] * factor;
            if (!forwardSpeed) {
                this.unknowns[type] = true;
            }
        }

        if (
            (props.oneway && props.oneway !== "no") ||
            (props.junction && props.junction === "roundabout")
        ) {
            backwardSpeed = 0;
        }

        return {
            forward: forwardSpeed && d / (forwardSpeed / 3.6),
            backward: backwardSpeed && d / (backwardSpeed / 3.6),
        };
    }

    route(
        waypoints: Routing.Waypoint[],
        callback: (error?: Routing.IError, routes?: Routing.IRoute[]) => any,
        context?: any
    ): void {
        const actualWaypoints  = waypoints.map(
            // @ts-ignore
            (wp) => turf.nearestPoint(this.util.toPoint(wp), this.points)
        );

        const legs = actualWaypoints
            .map((wp, i, wps) => {
                if (i > 0) {
                    return this.pathFinder.findPath(
                        turf.point(wps[i - 1].geometry.coordinates), turf.point(wp.geometry.coordinates)
                    );
                }
                return [];
            })
            .slice(1);

        if (legs.some(l => !l)) {
            return callback.call(context || this, {
                status: 1,
                message: "Can't find route.",
            });
        }

        const totalTime = legs.reduce((sum : number, l : any) => sum + l.weight, 0);

        const totalDistance = legs.reduce((sum : number, l : any) => {
            const legDistance = l.path.reduce((d : any, c : any, i : any, cs : any) => {
                if (i > 0) {
                    return d + turf.distance(
                        turf.point(cs[i - 1]),
                        turf.point(c)
                    ) * 1000;
                }
                return d;
            }, 0);
            return sum + legDistance;
        }, 0);

        console.log(legs.flatMap((l: any) => l.path.map((coord : any) => this.util.toLatLng(coord))));
        // @ts-ignore
        callback.call(context, null, [
            {
                name: "Rota encontrada",
                waypoints: actualWaypoints.map((p : any) => ({
                    latLng: this.util.toLatLng(p)
                })),
                inputWaypoints: waypoints,
                summary: {
                    totalDistance: totalDistance,
                    totalTime: totalTime,
                },
                coordinates: legs.flatMap((l: any) => l.path.map((coord : any) => this.util.toLatLng(coord))),
                instructions: [
                    {
                        type: 'Straight',
                        text: 'Siga até o destino',
                        distance: totalDistance,
                        time: totalTime,
                        index: 0
                    }
                ]
            },
        ]);
    }

}