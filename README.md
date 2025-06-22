# OSM Pathfinder

Biblioteca TypeScript para cálculo de rotas em dados geoespaciais do OpenStreetMap (OSM) com integração ao Leaflet.

## Recursos Principais

- **Importação Flexível**: suporte a GeoJSON, OSM XML e formatos TXT.
- **Compactação de Grafo**: remove nós de grau-2 para otimizar a busca.
- **Pesquisa de Caminho**: algoritmo de Dijkstra para encontrar o menor caminho.
- **Integração Leaflet**: adaptador `Router` para uso com `leaflet-routing-machine`.
- **Configuração Dinâmica**: ajuste de velocidades e tolerância em tempo de execução.
- **Estatísticas Detalhadas**: fornecimento de tempo de cálculo, distância total e número de vértices explorados.

## Instalação

```bash
# Usando npm
npm install osm-pathfinder geojson @turf/turf leaflet leaflet-routing-machine tinyqueue osmtogeojson

# Usando yarn
yarn add osm-pathfinder geojson @turf/turf leaflet leaflet-routing-machine tinyqueue osmtogeojson
```

## Exemplo de Uso

```ts
import L from 'leaflet';
import 'leaflet-routing-machine';
import PathFinder, { HighwaySpeeds } from 'osm-pathfinder';

// Definir velocidades por tipo de via
const speeds: HighwaySpeeds = {
  motorway: 100,
  trunk: 80,
  primary: 60,
  secondary: 50,
  tertiary: 40,
  unclassified: 30,
  residential: 30,
  service: 20,
  living_street: 10,
};

// Converter OSM XML para GeoJSON (opcional)
import osmtogeojson from 'osmtogeojson';
const geojson = osmtogeojson(osmXmlDocument);

// Instanciar PathFinder
const pf = new PathFinder(geojson, { speeds, tolerance: 1e-5, compact: true });

// Configurar mapa Leaflet
const map = L.map('map').setView([LAT, LNG], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Adicionar controle de rota
import { Router } from 'osm-pathfinder';
const router = new Router(speeds, geojson);
L.Routing.control({ router }).addTo(map);
```

## Documentação

A documentação completa está disponível em [docs/OSM_Pathfinder_Documentation.md](./docs/OSM_Pathfinder_Documentation.md).

## Contribuição

1. Fork este repositório.
2. Crie uma branch (`git checkout -b feature/nova-feature`).
3. Faça suas alterações e commit (`git commit -m 'Adiciona nova feature'`).
4. Envie para o branch (`git push origin feature/nova-feature`).
5. Abra um Pull Request.

## Autores

- Álvaro Velloso Lisboa – Lógica e processamento de rotas  
- Thiago Augusto Telho Abreu – Interface gráfica e experiência do usuário  
- Claudio Cristiano Louza Filho – Documentação geral e revisão técnica  

## Licença

Este projeto está licenciado sob a MIT License. Veja o arquivo [LICENSE](./docs/LICENSE.md) para detalhes.
