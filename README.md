# OSM Pathfinder

Biblioteca TypeScript para cálculo de rotas em dados geoespaciais do OpenStreetMap (OSM) com integração ao Leaflet.

### Demonstração online: [OSM PathFinder](https://alvaroveloso070.github.io/osm-pathfinder/) 

## Recursos Principais

- **Importação de arquivos**: suporte a arquivos OSM XML (OpenStreetMap).
- **Compactação de Grafo**: remove nós de grau-2 para otimizar a busca.
- **Pesquisa de Caminho**: algoritmo de Dijkstra para encontrar o menor caminho.
- **Integração Leaflet**: adaptador `Router` para uso com `leaflet-routing-machine`.
- **Configuração Dinâmica**: ajuste de velocidades e tolerância em tempo de execução.
- **Estatísticas Detalhadas**: fornecimento de tempo de cálculo, distância total e número de vértices explorados.

## Instalação


```bash
# Usando npm
npm install

npm run prod

# Abrir arquivo index.html no navegador.
```

## Documentação

A documentação completa está disponível em [Documentação](./docs/documentation.md).

## Contribuição

1. Fork este repositório.
2. Crie uma branch (`git checkout -b feature/nova-feature`).
3. Faça suas alterações e commit (`git commit -m 'Adiciona nova feature'`).
4. Envie para o branch (`git push origin feature/nova-feature`).
5. Abra um Pull Request.

## Autores

- Álvaro Veloso Lisboa – Lógica e processamento de rotas  
- Thiago Augusto Telho Abreu – Interface gráfica e experiência do usuário  
- Claudio Cristiano Louza Filho – Documentação geral e revisão técnica  

## Licença

Este projeto está licenciado sob a MIT License. Veja o arquivo [LICENSE](docs/license.md) para detalhes.
