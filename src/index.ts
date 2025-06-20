import MapManipulator from "./mapManipulator";

const mapManipulator : MapManipulator = new MapManipulator();
const fileInput = document.getElementById('file') as HTMLInputElement;
fileInput.addEventListener('change', handleFileUpload);

document.getElementById('hide-geojson')?.addEventListener('click', hideGeoJsonLayer);
document.getElementById('show-geojson')?.addEventListener('click', showGeoJsonLayer);
document.getElementById('remove-markers')?.addEventListener('click', removeAllMarkers);

function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;

    if (!files || files.length === 0) {
        console.error('Nenhum arquivo selecionado');
        return;
    }

    const file = files[0];
    mapManipulator.setGeoJsonLayer(file);
}

function hideGeoJsonLayer () : void {
    mapManipulator.hideGeoJsonLayer();
}

function showGeoJsonLayer () : void {
    mapManipulator.showGeoJsonLayer();
}

function removeAllMarkers () : void {
    mapManipulator.clearRoutingWaypoints();
}