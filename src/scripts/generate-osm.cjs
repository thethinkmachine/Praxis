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

async function fetchCities(countryName, limit = 55) {
  let retries = 3;
  let delay = 3000;

  while (retries > 0) {
    console.log(`Fetching OSM city nodes for ${countryName}... (Attempts left: ${retries})`);
    const query = `
      [out:json][timeout:60];
      area["name:en"="${countryName}"]->.a;
      (
        node["place"="city"](area.a);
        node["place"="town"](area.a);
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
        // Filter out names that might cause issues and prefer names with latin characters
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
      return unique.slice(0, limit);
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn(`Rate limited for ${countryName}. Waiting ${delay/1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; // Exponential backoff
        retries--;
      } else {
        console.error(`Error fetching ${countryName}:`, err.message);
        return [];
      }
    }
  }
  return [];
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

  // Pick endpoints by geographic extremes
  const sortedByLat = [...cities].sort((a, b) => a.lat - b.lat);
  const sortedByLon = [...cities].sort((a, b) => a.lon - b.lon);
  
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
  
  // 1. MST
  for (const edge of allEdges) {
    if (uf.union(edge.u, edge.v)) {
      finalEdges.push(edge);
    }
  }

  // 2. Add extra edges to create a mesh
  const edgesPerNode = new Array(cities.length).fill(0);
  for (const edge of finalEdges) {
    edgesPerNode[edge.u]++;
    edgesPerNode[edge.v]++;
  }

  // Add more edges based on proximity until most nodes have at least degree 3
  for (const edge of allEdges) {
    const alreadyConnected = finalEdges.some(e => 
      (e.u === edge.u && e.v === edge.v) || (e.u === edge.v && e.v === edge.u)
    );
    if (alreadyConnected) continue;

    const uDegree = edgesPerNode[edge.u];
    const vDegree = edgesPerNode[edge.v];

    if (uDegree < 3 || vDegree < 3) {
      // Connect if nearby
      if (edge.weight < 250) { 
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
    name: `${name.split(' Mapping')[0]} OSM Mesh`,
    description: `High-fidelity city mesh for ${name.split(' Mapping')[0]} generated from OpenStreetMap data. Guaranteed connectivity with realistic localized redundancy.`,
    tags: ["osm", "real-world", "detailed"],
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
  const countries = [
    { name: 'United States', limit: 80 },
    { name: 'Russia', limit: 80 },
    { name: 'Africa', limit: 100 },
    { name: 'India', limit: 80 },
    { name: 'Australia', limit: 60 },
    { name: 'Germany', limit: 50 },
    { name: 'France', limit: 50 },
    { name: 'Japan', limit: 50 },
    { name: 'Italy', limit: 50 },
    { name: 'Spain', limit: 50 },
    { name: 'Canada', limit: 50 },
    { name: 'Brazil', limit: 50 }
  ];

  const outDir = path.join(__dirname, '../../public/problems/graphs');

  for (const country of countries) {
    const cities = await fetchCities(country.name, country.limit);
    if (cities.length < 5) {
      console.log(`Skipping ${country.name} - not enough data.`);
      continue;
    }
    const graphData = buildGraph(`${country.name} OSM Mapping`, cities);
    if (graphData) {
      const fileName = `${country.name.toLowerCase().replace(/\s+/g, '-')}-osm-map.json`;
      fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(graphData, null, 2));
      console.log(`Successfully generated and saved ${fileName}`);
    }
    
    // Respecting API limits
    console.log("Respecting API limits, waiting 10 seconds before next request...");
    await new Promise(r => setTimeout(r, 10000));
  }
}

main().catch(console.error);
