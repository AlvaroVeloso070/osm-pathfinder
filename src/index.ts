import "../style.css";
import MapManipulator from "./mapManipulator";
import {RouteInfo} from "./types";

const mapManipulator: MapManipulator = new MapManipulator();
const fileInput = document.getElementById("file") as HTMLInputElement;
const dropzone = document.getElementById("dropzone") as HTMLDivElement;
const mapInfoButton = document.getElementById("map-info-button") as HTMLButtonElement;

// Variáveis para o painel de informações da rota
const routeInfoPanel = document.getElementById("route-info-panel") as HTMLElement;
const closeRouteInfoButton = document.getElementById("close-route-info") as HTMLElement;

fileInput.addEventListener("change", handleFileUpload);

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", handleDragOver);
dropzone.addEventListener("dragleave", handleDragLeave);
dropzone.addEventListener("drop", handleDrop);

document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => e.preventDefault());

document
  .getElementById("toggle-geojson")
  ?.addEventListener("click", toggleGeoJsonLayer);
document
  .getElementById("remove-markers")
  ?.addEventListener("click", removeAllMarkers);
document
  .getElementById("map-info-button")
  ?.addEventListener("click", openMapInfoModal);

// Modal close buttons
document
  .getElementById("close-modal-button")
  ?.addEventListener("click", closeMapInfoModal);
document
  .getElementById("close-modal-btn")
  ?.addEventListener("click", closeMapInfoModal);
document
  .getElementById("modal-overlay")
  ?.addEventListener("click", closeMapInfoModal);

// Speed panel event listeners
document
  .getElementById("speed-panel-toggle")
  ?.addEventListener("click", toggleSpeedPanel);
document
  .getElementById("reset-speeds")
  ?.addEventListener("click", resetSpeedsToDefault);
document
  .getElementById("apply-speeds")
  ?.addEventListener("click", applySpeedSettings);

updateRemoveMarkersButtonState();
updateMarkersList();

mapManipulator.setMarkersChangeCallback(() => {
  updateRemoveMarkersButtonState();
  updateMarkersList();
});

function updateMarkersList(): void {
  const markersList = document.getElementById("markers-list") as HTMLElement;
  const markersCount = document.getElementById("markers-count") as HTMLElement;
  const noMarkersMessage = document.getElementById(
    "no-markers-message"
  ) as HTMLElement;

  if (!markersList || !markersCount) return;

  const waypoints = mapManipulator.getWaypoints();

  // Update the count
  markersCount.textContent = waypoints.length.toString();

  if (waypoints.length === 0) {
    // Show the no markers message
    if (noMarkersMessage) {
      noMarkersMessage.style.display = "block";
    }
    // Hide any existing marker items
    const markerItems = markersList.querySelectorAll(".marker-item");
    markerItems.forEach((item) => item.remove());
  } else {
    // Hide the no markers message
    if (noMarkersMessage) {
      noMarkersMessage.style.display = "none";
    }

    // Clear existing marker items
    const markerItems = markersList.querySelectorAll(".marker-item");
    markerItems.forEach((item) => item.remove());

    // Add marker items
    waypoints.forEach((waypoint, index) => {
      const markerItem = document.createElement("div");
      markerItem.className =
        "marker-item flex items-center justify-between p-2 bg-gray-600 rounded border border-gray-500 hover:bg-gray-500 transition-all duration-200";

      markerItem.innerHTML = `
        <div class="flex items-center space-x-2">
          <div class="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
          <div class="text-white text-xs">
            <div class="font-medium">Marcador ${index + 1}</div>
            <div class="text-gray-300 text-xs">
              ${waypoint.lat.toFixed(4)}, ${waypoint.lng.toFixed(4)}
            </div>
          </div>
        </div>
        <button 
          class="remove-marker-btn text-gray-400 hover:text-red-400 transition-colors duration-200 p-0.5" 
          title="Remover marcador"
          data-index="${index}"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      `;

      // Add event listener to the remove button
      const removeBtn = markerItem.querySelector(
        ".remove-marker-btn"
      ) as HTMLButtonElement;
      if (removeBtn) {
        removeBtn.addEventListener("click", () => removeMarker(index));
      }

      markersList.appendChild(markerItem);
    });
  }

  // Atualizar o painel de informações da rota se houver uma rota ativa
  updateRouteInfoPanel();
}

function removeMarker(index: number): void {
  mapManipulator.removeWaypointAt(index);
  // Atualizar o painel de informações da rota após remover um marcador
  updateRouteInfoPanel();
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (!files || files.length === 0) {
    console.error("Nenhum arquivo selecionado");
    return;
  }

  const file = files[0];

  showLoadingState();

  mapManipulator.setGeoJsonLayer(file, () => {
    resetDropzoneState();
    updateToggleButtonText();
    loadCurrentSpeedsIntoPanel();
  });
}

function toggleGeoJsonLayer(): void {
  if (mapManipulator.isGeoJsonLayerVisible()) {
    mapManipulator.hideGeoJsonLayer();
  } else {
    mapManipulator.showGeoJsonLayer();
  }

  updateToggleButtonText();
}

function removeAllMarkers(): void {
  mapManipulator.clearRoutingWaypoints();
  updateRemoveMarkersButtonState();
  // Esconder o painel de informações da rota quando todos os marcadores são removidos
  hideRouteInfoPanel();
}

function updateRemoveMarkersButtonState(): void {
  const removeButton = document.getElementById(
    "remove-markers"
  ) as HTMLButtonElement;

  if (removeButton) {
    const hasMarkers = mapManipulator.hasMarkers();

    if (hasMarkers) {
      removeButton.disabled = false;
      removeButton.classList.remove("opacity-50", "cursor-not-allowed");
      removeButton.classList.add("hover:bg-gray-500", "hover:border-gray-400");
    } else {
      removeButton.disabled = true;
      removeButton.classList.add("opacity-50", "cursor-not-allowed");
      removeButton.classList.remove(
        "hover:bg-gray-500",
        "hover:border-gray-400"
      );
    }
  }
}

function updateToggleButtonText(): void {
  const toggleButton = document.getElementById(
    "toggle-geojson-text"
  ) as HTMLSpanElement;

  if (toggleButton) {
    if (mapManipulator.isGeoJsonLayerVisible()) {
      toggleButton.textContent = "Esconder GeoJSON";
    } else {
      toggleButton.textContent = "Mostrar GeoJSON";
    }
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dropzone.classList.add("border-blue-400", "bg-gray-600/80");
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dropzone.classList.remove("border-blue-400", "bg-gray-600/80");
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dropzone.classList.remove("border-blue-400", "bg-gray-600/80");

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    console.error("Nenhum arquivo solto");
    return;
  }

  const file = files[0];

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;

  showLoadingState();

  mapManipulator.setGeoJsonLayer(file, () => {
    resetDropzoneState();
    updateToggleButtonText();
    loadCurrentSpeedsIntoPanel();
  });
}

function showLoadingState() {
  const dropzoneContent = dropzone.querySelector(".text-center") as HTMLElement;
  if (dropzoneContent) {
    dropzoneContent.innerHTML = `
      <div class="mb-3">
        <svg class="mx-auto h-12 w-12 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <div class="text-blue-400 text-sm font-medium mb-2">
        Carregando arquivo...
      </div>
      <div class="text-gray-400 text-xs">Processando dados do mapa</div>
    `;
  }
}

function resetDropzoneState() {
  showSuccessState();
  enableMapInfoButton();
  updateMapInfoModal();
}

function showSuccessState() {
  const dropzoneContent = dropzone.querySelector(".text-center") as HTMLElement;
  if (dropzoneContent) {
    dropzoneContent.innerHTML = `
      <div class="mb-3">
        <svg class="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="text-green-400 text-sm font-medium mb-2">
        Arquivo carregado com sucesso!
      </div>
      <div class="text-gray-400 text-xs">Dados do mapa processados</div>
    `;
  }
}

function showDefaultState() {
  const dropzoneContent = dropzone.querySelector(".text-center") as HTMLElement;
  if (dropzoneContent) {
    dropzoneContent.innerHTML = `
      <div class="mb-3">
        <svg class="mx-auto h-12 w-12 text-gray-300" stroke="currentColor" fill="none" viewBox="0 0 48 48">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="text-gray-300 text-sm font-medium mb-2">
        <span class="text-blue-400">Clique para carregar</span> ou arraste um arquivo
      </div>
      <div class="text-gray-400 text-xs">OSM, GeoJSON, GPX</div>
    `;
  }
}

// Speed panel functions
let isSpeedPanelCollapsed = true; // Start collapsed for tidier interface

function toggleSpeedPanel(): void {
  const panel = document.getElementById("speed-panel-content") as HTMLElement;
  const icon = document.getElementById("speed-panel-icon") as HTMLElement;

  if (!panel || !icon) return;

  isSpeedPanelCollapsed = !isSpeedPanelCollapsed;

  if (isSpeedPanelCollapsed) {
    panel.style.display = "none";
    icon.style.transform = "rotate(-90deg)";
  } else {
    panel.style.display = "block";
    icon.style.transform = "rotate(0deg)";
  }
}

function resetSpeedsToDefault(): void {
  const defaultSpeeds = {
    motorway: 120,
    trunk: 100,
    primary: 80,
    secondary: 60,
    tertiary: 50,
    unclassified: 50,
    road: 50,
    residential: 30,
    service: 20,
    living_street: 10,
  };

  // Update the input fields
  Object.entries(defaultSpeeds).forEach(([type, speed]) => {
    const input = document.getElementById(`speed-${type}`) as HTMLInputElement;
    if (input) {
      input.value = speed.toString();
    }
  });
}

function applySpeedSettings(): void {
  const speeds: any = {};

  const speedTypes = [
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "unclassified",
    "road",
    "residential",
    "service",
    "living_street",
  ];

  speedTypes.forEach((type) => {
    const input = document.getElementById(`speed-${type}`) as HTMLInputElement;
    if (input) {
      const value = parseInt(input.value);
      if (!isNaN(value) && value > 0) {
        speeds[type] = value;
      }
    }
  });

  mapManipulator.setHighwaySpeeds(speeds);

  // Visual feedback
  const applyButton = document.getElementById(
    "apply-speeds"
  ) as HTMLButtonElement;
  if (applyButton) {
    const originalText = applyButton.textContent;
    applyButton.textContent = "Aplicado!";
    applyButton.classList.add("bg-green-600", "border-green-500");
    applyButton.classList.remove("bg-blue-600", "border-blue-500");

    setTimeout(() => {
      applyButton.textContent = originalText;
      applyButton.classList.remove("bg-green-600", "border-green-500");
      applyButton.classList.add("bg-blue-600", "border-blue-500");
    }, 1500);
  }
}

function loadCurrentSpeedsIntoPanel(): void {
  const currentSpeeds = mapManipulator.getHighwaySpeeds();
  if (currentSpeeds) {
    Object.entries(currentSpeeds).forEach(([type, speed]) => {
      const input = document.getElementById(
        `speed-${type}`
      ) as HTMLInputElement;
      if (input) {
        input.value = speed.toString();
      }
    });
  }
}

// Map info modal functions
function openMapInfoModal(): void {
  const modal = document.getElementById("map-info-modal") as HTMLElement;
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    // Adiciona as animações para entrada do modal
    setTimeout(() => {
      const overlay = document.getElementById("modal-overlay");
      const content = document.getElementById("modal-content");

      if (overlay) overlay.classList.add("opacity-100");
      if (content) {
        content.classList.remove("opacity-0", "translate-y-8");
        content.classList.add("opacity-100", "translate-y-0");
      }
    }, 10);
  }
}

function closeMapInfoModal(): void {
  const modal = document.getElementById("map-info-modal") as HTMLElement;
  const overlay = document.getElementById("modal-overlay");
  const content = document.getElementById("modal-content");

  if (overlay) overlay.classList.remove("opacity-100");
  if (content) {
    content.classList.remove("opacity-100", "translate-y-0");
    content.classList.add("opacity-0", "translate-y-8");
  }

  // Aguarda a animação terminar antes de esconder o modal
  setTimeout(() => {
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  }, 300);
}

function enableMapInfoButton(): void {
  if (mapInfoButton) {
    mapInfoButton.disabled = false;
    mapInfoButton.classList.remove("opacity-50", "cursor-not-allowed");
    mapInfoButton.classList.add("hover:bg-gray-500", "hover:border-gray-400");
  }
}

function updateMapInfoModal(): void {
  try {
    // Obtém os elementos do modal onde as informações serão exibidas
    const totalDistanceElement = document.getElementById("total-distance");
    const totalVerticesElement = document.getElementById("total-vertices");
    const totalEdgesElement = document.getElementById("total-edges");
    const totalCoordinatesElement = document.getElementById("total-coordinates");

    // Acessa as informações do geojson diretamente do mapManipulator
    const geojsonInfo = mapManipulator.geojsonInfo;

    if (geojsonInfo && totalDistanceElement && totalVerticesElement && totalEdgesElement && totalCoordinatesElement) {
      // Formata a distância com duas casas decimais
      totalDistanceElement.textContent = `${geojsonInfo.totalDistance.toFixed(2)} km`;
      totalVerticesElement.textContent = geojsonInfo.totalNodes.toLocaleString();
      totalEdgesElement.textContent = geojsonInfo.totalEdges.toLocaleString();
      totalCoordinatesElement.textContent = geojsonInfo.coordinates.toLocaleString();
    }
  } catch (error) {
    console.error("Erro ao atualizar informações do mapa:", error);
  }
}

// Funções para o painel de informações da rota
function updateRouteInfoPanel(): void {
  const waypoints = mapManipulator.getWaypoints();

  if (waypoints.length >= 2) {
    // Mostrar o painel de informações da rota apenas quando há pelo menos 2 waypoints (origem e destino)
    showRouteInfoPanel();

    // Obter as informações da rota do objeto de rota ativo
    const routeInfo : RouteInfo = mapManipulator.router.routeInfo;

    if (routeInfo) {
      // Atualizar os elementos com as informações da rota
      updateRouteInfo(routeInfo);
    }
  } else {
    // Esconder o painel se não houver rota ativa
    hideRouteInfoPanel();
  }
}

function showRouteInfoPanel(): void {
  if (routeInfoPanel) {
    routeInfoPanel.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
    routeInfoPanel.classList.add("opacity-100", "translate-y-0");
  }
}

function hideRouteInfoPanel(): void {
  if (routeInfoPanel) {
    routeInfoPanel.classList.remove("opacity-100", "translate-y-0");
    routeInfoPanel.classList.add("opacity-0", "translate-y-4", "pointer-events-none");
  }
}

function updateRouteInfo(routeInfo: RouteInfo): void {
  const distanceElement = document.getElementById("route-distance");
  const timeElement = document.getElementById("route-time");
  const calcTimeElement = document.getElementById("route-calc-time");
  const nodesElement = document.getElementById("route-nodes");

  if (distanceElement && timeElement && calcTimeElement && nodesElement && routeInfo) {
    // Distância em km com 2 casas decimais
    const distanceKm = (routeInfo.totalDistance / 1000).toFixed(2);
    distanceElement.textContent = `${distanceKm} km`;

    // Tempo formatado como hh:mm:ss
    const totalSeconds = Math.round(routeInfo.totalTime);
    timeElement.textContent = formatTime(totalSeconds);

    // Tempo de cálculo em milissegundos
    calcTimeElement.textContent = `${Math.round(routeInfo.calculationTime)} ms`;

    // Número de nós percorridos
    nodesElement.textContent = routeInfo.totalNodes.toLocaleString();
  }
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    remainingSeconds.toString().padStart(2, '0')
  ].join(':');
}

// Evento para fechar o painel de informações da rota
if (closeRouteInfoButton) {
  closeRouteInfoButton.addEventListener("click", hideRouteInfoPanel);
}
