import {latLng, Routing} from "leaflet";
import "leaflet-routing-machine";
import {Feature, FeatureCollection, GeoJsonProperties, LineString, Point,} from "geojson";
import {HighwaySpeeds, RouteInfo, Vertices} from "./types";
import PathFinder from "./pathFinder";
import * as turf from "@turf/turf";

export class Router implements Routing.IRouter {
  private highwaySpeeds: HighwaySpeeds;
  private unknowns: Record<string, boolean> = {};
  public pathFinder: PathFinder<LineString>;
  public points: FeatureCollection<Point>;
  public routeInfo !: RouteInfo;

  // Funções de utilidade
  private util = {
    toPoint: function (wp: Routing.Waypoint) {
      let c = wp.latLng;
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [c.lng, c.lat],
        },
        properties: {},
      };
    },

    toLatLng: function (p: Feature<Point> | number[]) {
      if (Array.isArray(p)) {
        return latLng(p[1], p[0]); // Note: lat, lng order
      }
      return latLng(p.geometry.coordinates[1], p.geometry.coordinates[0]);
    },
  };

  constructor(
    private geojson: FeatureCollection<LineString, GeoJsonProperties>
  ) {
    this.highwaySpeeds = {
      motorway: 120, // Rodovias duplicadas
      trunk: 100, // Rodovias simples ou vias expressas
      primary: 80, // Vias arteriais principais
      secondary: 60, // Vias arteriais secundárias
      tertiary: 50, // Vias coletoras
      unclassified: 50, // Vias locais
      road: 50, // Vias locais
      residential: 30, // Áreas residenciais
      service: 20, // Vias de serviço, estacionamentos
      living_street: 10, // Áreas compartilhadas com pedestres
    };

    this.pathFinder = new PathFinder(geojson, {
      tolerance: 1e-9,
      weight: this.weightFn.bind(this),
    });

    // Extrair todos os pontos do GeoJSON para uso na busca do ponto mais próximo
    let vertices: Vertices = this.pathFinder.graph.vertices;
    this.points = turf.featureCollection<Point>(
      Object.keys(vertices)
        .filter((nodeName) => {
          return Object.keys(vertices[nodeName]).length;
        })
        .map((nodeName) => {
          return turf.point(this.pathFinder.graph.sourceCoordinates[nodeName]);
        })
    );

    this.resetRouteInfo();
  }

  private weightFn = (a: any, b: any, props: any) => {
    const d = turf.distance(turf.point(a), turf.point(b)) * 1000;
    let factor = 0.9;
    let type = props.highway || "";
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

      forwardSpeed = backwardSpeed =
        this.highwaySpeeds[type as keyof HighwaySpeeds] * factor;
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
  };

  route(
      waypoints: Routing.Waypoint[],
      callback: (error?: Routing.IError, routes?: Routing.IRoute[]) => void,
      context?: any
  ): Routing.IRouter {
    this.resetRouteInfo();
    const startTime = performance.now();
    try {
      // Função para encontrar múltiplos pontos próximos
      const findNearestPoints = (point: any, maxAttempts: number = 5): any[] => {
        const distances = this.points.features.map((feature, index) => ({
          feature,
          index,
          distance: turf.distance(point, feature)
        }));

        // Ordenar por distância e pegar os N mais próximos
        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, maxAttempts).map(d => d.feature);
      };

      // Função para tentar encontrar waypoints válidos
      const findValidWaypoints = (): any[] => {
        const results = [];

        for (const wp of waypoints) {
          const wpPoint = this.util.toPoint(wp);
          const nearestPoints = findNearestPoints(wpPoint);

          // Para cada waypoint, vamos armazenar os candidatos
          results.push({
            original: wp,
            candidates: nearestPoints,
            selected: null
          });
        }

        return results;
      };

      // Função para testar combinações de waypoints
      const testWaypointCombination = (waypointCandidates: any[], combination: number[]): any[] | null => {
        const selectedWaypoints = combination.map((candidateIndex, wpIndex) =>
            waypointCandidates[wpIndex].candidates[candidateIndex]
        );

        // Testar se todos os caminhos são válidos
        const legs = [];
        for (let i = 1; i < selectedWaypoints.length; i++) {
          const path = this.pathFinder.findPath(
              turf.point(selectedWaypoints[i - 1].geometry.coordinates),
              turf.point(selectedWaypoints[i].geometry.coordinates)
          );

          if (!path || !path.path || path.path.length === 0) {
            return null; // Esta combinação não funciona
          }

          legs.push(path);
        }

        // @ts-ignore
        return { selectedWaypoints, legs };
      };

      // Função para gerar todas as combinações possíveis
      const generateCombinations = (waypointCandidates: any[]): number[][] => {
        const combinations = [];
        const maxCandidates = Math.max(...waypointCandidates.map(wc => wc.candidates.length));
        const totalCombinations = Math.min(50, Math.pow(maxCandidates, waypointCandidates.length)); // Limitar tentativas

        for (let i = 0; i < totalCombinations; i++) {
          const combination = [];
          let temp = i;

          for (let j = 0; j < waypointCandidates.length; j++) {
            const candidateCount = waypointCandidates[j].candidates.length;
            combination.push(temp % candidateCount);
            temp = Math.floor(temp / candidateCount);
          }

          combinations.push(combination);
        }

        return combinations;
      };

      // Obter candidatos para cada waypoint
      const waypointCandidates = findValidWaypoints();

      // Gerar e testar combinações
      const combinations = generateCombinations(waypointCandidates);
      let validResult = null;

      // Testar combinações priorizando as que usam os pontos mais próximos
      for (const combination of combinations) {
        const result = testWaypointCombination(waypointCandidates, combination);
        if (result) {
          validResult = result;
          break;
        }
      }

      // Se não encontrou nenhuma combinação válida
      if (!validResult) {
        const error: Routing.IError = {
          status: 1,
          message: "Can't find route with any nearby points.",
        };
        showToast("Não foi possível encontrar uma rota para os pontos fornecidos, mesmo testando pontos próximos.");
        callback.call(context || this, error);
        return this;
      }

      // @ts-ignore
      const { selectedWaypoints: actualWaypoints, legs } = validResult;

      this.routeInfo.totalTime = legs.reduce(
          (sum: number, l: any) => sum + (l ? l.weight : 0),
          0
      );

      this.routeInfo.totalNodes = legs.reduce(
          (sum: number, l: any) => sum + (l ? l.path.length : 0),
          0
      )

      this.routeInfo.totalDistance = legs.reduce((sum: number, l: any) => {
        if (!l || !l.path) return sum;

        const legDistance = l.path.reduce(
            (d: number, c: any, i: number, cs: any[]) => {
              if (i > 0) {
                return (
                    d + turf.distance(turf.point(cs[i - 1]), turf.point(c)) * 1000
                );
              }
              return d;
            },
            0
        );
        return sum + legDistance;
      }, 0);

      // Criar coordenadas da rota
      const routeCoordinates = legs.flatMap((l: any) =>
          l && l.path ? l.path.map((coord: any) => this.util.toLatLng(coord)) : []
      );

      // Criar waypoints corretos para o LRM
      const routeWaypoints = waypoints.map((wp, index) => ({
        latLng: wp.latLng,
        name: wp.name || `Waypoint ${index + 1}`,
        options: wp.options || {},
      }));

      const route = {
        name: "Rota encontrada",
        waypoints: routeWaypoints.map((wp) => wp.latLng),
        inputWaypoints: routeWaypoints,
        actualWaypoints: actualWaypoints,
        summary: {
          totalDistance: Math.round(this.routeInfo.totalDistance),
          totalTime: Math.round(this.routeInfo.totalTime),
        },
        coordinates: routeCoordinates,
        instructions: [
          {
            type: "Straight",
            text: "Siga até o destino",
            distance: Math.round(this.routeInfo.totalDistance),
            time: Math.round(this.routeInfo.totalTime),
            index: 0,
            direction: "Straight",
          },
        ],
      };
      // Chamar callback com sucesso
      setTimeout(() => {
        // @ts-ignore
        callback.call(context || this, undefined, [route]);
      }, 0);
    } catch (error) {
      const routingError: Routing.IError = {
        status: 500,
        message:
            error instanceof Error ? error.message : "Unknown error occurred",
      };
      callback.call(context || this, routingError);
    }

    this.routeInfo.calculationTime = performance.now() - startTime;

    return this;
  }

  getHighwaySpeeds(): HighwaySpeeds {
    return { ...this.highwaySpeeds };
  }

  setHighwaySpeeds(speeds: HighwaySpeeds): void {
    this.highwaySpeeds = { ...speeds };
  }

  updateHighwaySpeed(type: keyof HighwaySpeeds, speed: number): void {
    this.highwaySpeeds[type] = speed;
  }

  private resetRouteInfo() {
    this.routeInfo = {
      totalTime: 0,
      totalDistance: 0,
      calculationTime: 0,
      totalNodes: 0
    }
  }
}

// Função para mostrar o toast de notificação
function showToast(
    message: string = "Não foi possível encontrar uma rota",
    duration: number = 5000
): void {
  const toast = document.getElementById("toast-notification");
  const toastMessage = document.getElementById("toast-message");
  const toastClose = document.getElementById("toast-close");

  if (!toast || !toastMessage) return;

  // Define a mensagem
  if (toastMessage) {
    toastMessage.textContent = message;
  }

  // Mostra o toast com animação
  setTimeout(() => {
    toast.classList.add("opacity-100");
    toast.classList.remove("opacity-0", "translate-y-2", "pointer-events-none");
  }, 10);

  // Configura o botão de fechar
  if (toastClose) {
    toastClose.onclick = () => hideToast();
  }

  // Esconde automaticamente após o tempo definido
  const timeoutId = setTimeout(() => hideToast(), duration);

  // Armazena o ID do timeout no elemento para poder cancelá-lo se necessário
  (toast as any)._timeoutId = timeoutId;
}

// Função para esconder o toast
function hideToast(): void {
  const toast = document.getElementById("toast-notification");
  if (!toast) return;

  // Cancela o timeout existente se houver
  if ((toast as any)._timeoutId) {
    clearTimeout((toast as any)._timeoutId);
  }

  // Esconde o toast com animação
  toast.classList.remove("opacity-100");
  toast.classList.add("opacity-0", "translate-y-2", "pointer-events-none");
}
