const fs = require('fs');
const path = require('path');
const axios = require('axios');

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = deg2rad(lat2-lat1);  
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}
function deg2rad(deg) { return deg * (Math.PI/180); }

function projectCoords(lat, lon, minLat, maxLat, minLon, maxLon, width = 1200, height = 800) {
  const x = ((lon - minLon) / (maxLon - minLon)) * width;
  const y = ((maxLat - lat) / (maxLat - minLat)) * height;
  return { x: Math.round(x), y: Math.round(y) };
}

function formatId(name) {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
}

class UnionFind {
  constructor(size) {
    this.parent = Array.from({length: size}, (_, i) => i);
  }
  find(i) {
    if (this.parent[i] === i) return i;
    return this.parent[i] = this.find(this.parent[i]);
  }
  union(i, j) {
    let rootI = this.find(i), rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootI] = rootJ;
      return true;
    }
    return false;
  }
}

async function fetchAfricaCities() {
  console.log("Fetching major African cities by bounding box...");
  // Box: -35, -20 to 38, 52 (Approx Africa) 
  // We limit by population to avoid massive data transfer and noise
  const query = `
    [out:json][timeout:120];
    (
      node["place"="city"](-35,-20,38,52);
    );
    out body;
  `;
  const url = `https://overpass-api.de/api/interpreter`;
  try {
    const response = await axios.post(url, `data=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const nodes = response.data.elements
      .filter(e => e.tags && (e.tags.name || e.tags["name:en"]))
      .map(e => ({
        name: e.tags["name:en"] || e.tags.name,
        lat: e.lat,
        lon: e.lon,
        population: parseInt(e.tags.population || '0', 10)
      }))
      .filter(n => n.name && n.name.length > 0)
      .sort((a, b) => b.population - a.population);
      
    const unique = [];
    const seen = new Set();
    for (const n of nodes) {
      if (!seen.has(n.name)) {
        seen.add(n.name);
        unique.push(n);
      }
    }
    // We want a good spread, so we'll take top 100
    return unique.slice(0, 100);
  } catch (err) {
    console.error("Error fetching Africa nodes:", err.message);
    return [];
  }
}

function buildGraph(name, cities) {
  if (cities.length < 2) return null;

  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;
  
  cities.forEach(c => {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lon < minLon) minLon = c.lon;
    if (c.lon > maxLon) maxLon = c.lon;
  });

  const sortedByLat = [...cities].sort((a, b) => a.lat - b.lat);
  const startCity = sortedByLat[0]; // Southmost
  const goalCity = sortedByLat[sortedByLat.length - 1]; // Northmost

  const nodes = cities.map(c => {
    const { x, y } = projectCoords(c.lat, c.lon, minLat, maxLat, minLon, maxLon);
    return {
      id: formatId(c.name),
      label: c.name,
      x: x + 80, 
      y: y + 80,
      heuristic: Math.round(getDistanceFromLatLonInKm(c.lat, c.lon, goalCity.lat, goalCity.lon))
    };
  });

  const allEdges = [];
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const dist = getDistanceFromLatLonInKm(cities[i].lat, cities[i].lon, cities[j].lat, cities[j].lon);
      allEdges.push({ u: i, v: j, weight: Math.round(dist) });
    }
  }
  allEdges.sort((a, b) => a.weight - b.weight);

  const finalEdges = [];
  const uf = new UnionFind(cities.length);
  for (const edge of allEdges) {
    if (uf.union(edge.u, edge.v)) {
      finalEdges.push(edge);
    }
  }

  const edgesPerNode = new Array(cities.length).fill(0);
  for (const edge of finalEdges) {
    edgesPerNode[edge.u]++;
    edgesPerNode[edge.v]++;
  }

  for (const edge of allEdges) {
    const alreadyConnected = finalEdges.some(e => 
      (e.u === edge.u && e.v === edge.v) || (e.u === edge.v && e.v === edge.u)
    );
    if (alreadyConnected) continue;

    const uDegree = edgesPerNode[edge.u];
    const vDegree = edgesPerNode[edge.v];

    if (uDegree < 4 || vDegree < 4) { // Increased degree for larger map density
      if (edge.weight < 600) {  // Larger distance tolerance for continental maps
        finalEdges.push(edge);
        edgesPerNode[edge.u]++;
        edgesPerNode[edge.v]++;
      }
    }
  }

  const edgesFormatted = finalEdges.map(e => {
    const sId = formatId(cities[e.u].name);
    const tId = formatId(cities[e.v].name);
    return {
      id: `e-${sId}-${tId}`,
      source: sId,
      target: tId,
      weight: e.weight
    };
  });

  return {
    category: "graph",
    name: "Africa OSM Mesh",
    description: "Detailed continental city mesh for Africa sourced from OpenStreetMap.",
    tags: ["osm", "africa", "continent"],
    problem: {
      graph: {
        directed: false,
        nodes,
        edges: edgesFormatted
      },
      startNode: formatId(startCity.name),
      goalNode: formatId(goalCity.name),
      useHeuristic: true
    }
  };
}

async function main() {
  const cities = await fetchAfricaCities();
  if (cities.length < 5) return;
  const graphData = buildGraph("Africa", cities);
  if (graphData) {
    fs.writeFileSync(path.join(__dirname, '../../public/problems/graphs/africa-osm-map.json'), JSON.stringify(graphData, null, 2));
    console.log("Successfully generated and saved africa-osm-map.json");
  }
}

main().catch(console.error);
