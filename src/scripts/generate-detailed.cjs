const fs = require('fs');
const path = require('path');

// Helper to scale lat/lon to display coordinates (approximate equirectangular projection)
// X: Longitude scaled, Y: Latitude mapped inverted
function projectCoords(lat, lon, minLat, maxLat, minLon, maxLon, width = 1200, height = 800) {
  const x = ((lon - minLon) / (maxLon - minLon)) * width;
  // Invert Y because SVG/Canvas is origin top-left, but Latitude increases upwards
  const y = ((maxLat - lat) / (maxLat - minLat)) * height;
  return { x: Math.round(x), y: Math.round(y) };
}

// Haversine distance for realistic weights
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function formatId(name) {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
}

function buildGraph(name, regionData, startName, goalName) {
  const { cities, edges: rawEdges, minLat, maxLat, minLon, maxLon } = regionData;
  
  const nodes = [];
  const startId = formatId(startName);
  const goalId = formatId(goalName);
  
  const goalCity = cities.find(c => c.name === goalName);
  
  for (const c of cities) {
    const { x, y } = projectCoords(c.lat, c.lon, minLat, maxLat, minLon, maxLon);
    
    let heuristic = 0;
    if (goalCity) {
       heuristic = Math.round(getDistanceFromLatLonInKm(c.lat, c.lon, goalCity.lat, goalCity.lon));
    }
    
    nodes.push({
      id: formatId(c.name),
      label: c.name,
      x: x + 50, // Add padding
      y: y + 50,
      heuristic
    });
  }

  const edges = [];
  for (const [srcName, tgtName] of rawEdges) {
    const srcCity = cities.find(c => c.name === srcName);
    const tgtCity = cities.find(c => c.name === tgtName);
    
    if (srcCity && tgtCity) {
      const weight = Math.round(getDistanceFromLatLonInKm(srcCity.lat, srcCity.lon, tgtCity.lat, tgtCity.lon));
      const sId = formatId(srcName);
      const tId = formatId(tgtName);
      edges.push({
        id: `e-${sId}-${tId}`,
        source: sId,
        target: tId,
        weight
      });
    }
  }

  return {
    category: "graph",
    name,
    problem: {
      graph: {
        directed: false,
        nodes,
        edges
      },
      startNode: startId,
      goalNode: goalId,
      useHeuristic: true
    }
  };
}

const outDir = path.join(__dirname, '../../public/problems/graphs');


// ==========================================
// 1. UK Extremely Detailed
// ==========================================
const ukData = {
  minLat: 50.1, maxLat: 59.5, minLon: -8.5, maxLon: 1.8,
  cities: [
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Birmingham', lat: 52.4862, lon: -1.8904 },
    { name: 'Manchester', lat: 53.4808, lon: -2.2426 },
    { name: 'Liverpool', lat: 53.4084, lon: -2.9916 },
    { name: 'Leeds', lat: 53.8008, lon: -1.5491 },
    { name: 'Sheffield', lat: 53.3811, lon: -1.4701 },
    { name: 'Bristol', lat: 51.4545, lon: -2.5879 },
    { name: 'Nottingham', lat: 52.9548, lon: -1.1581 },
    { name: 'Leicester', lat: 52.6369, lon: -1.1398 },
    { name: 'Coventry', lat: 52.4068, lon: -1.5197 },
    { name: 'Cardiff', lat: 51.4816, lon: -3.1791 },
    { name: 'Swansea', lat: 51.6214, lon: -3.9436 },
    { name: 'Newport', lat: 51.5877, lon: -2.9984 },
    { name: 'Edinburgh', lat: 55.9533, lon: -3.1883 },
    { name: 'Glasgow', lat: 55.8642, lon: -4.2518 },
    { name: 'Aberdeen', lat: 57.1497, lon: -2.0943 },
    { name: 'Dundee', lat: 56.4620, lon: -2.9707 },
    { name: 'Newcastle', lat: 54.9783, lon: -1.6178 },
    { name: 'Sunderland', lat: 54.9069, lon: -1.3838 },
    { name: 'Middlesbrough', lat: 54.5742, lon: -1.2325 },
    { name: 'York', lat: 53.9590, lon: -1.0815 },
    { name: 'Hull', lat: 53.7676, lon: -0.3274 },
    { name: 'Norwich', lat: 52.6309, lon: 1.2974 },
    { name: 'Cambridge', lat: 52.2053, lon: 0.1218 },
    { name: 'Oxford', lat: 51.7520, lon: -1.2577 },
    { name: 'Southampton', lat: 50.9097, lon: -1.4044 },
    { name: 'Portsmouth', lat: 50.8198, lon: -1.0880 },
    { name: 'Brighton', lat: 50.8225, lon: -0.1372 },
    { name: 'Bournemouth', lat: 50.7192, lon: -1.8808 },
    { name: 'Plymouth', lat: 50.3755, lon: -4.1427 },
    { name: 'Exeter', lat: 50.7260, lon: -3.5309 },
    { name: 'Belfast', lat: 54.5973, lon: -5.9301 },
    { name: 'Derry', lat: 54.9966, lon: -7.3086 },
    { name: 'Inverness', lat: 57.4778, lon: -4.2247 },
    { name: 'Carlisle', lat: 54.8925, lon: -2.9329 }
  ],
  edges: [
    ['London', 'Brighton'], ['London', 'Portsmouth'], ['London', 'Southampton'],
    ['London', 'Oxford'], ['London', 'Cambridge'], ['London', 'Norwich'],
    ['London', 'Coventry'], ['London', 'Bristol'],
    ['Brighton', 'Portsmouth'], ['Portsmouth', 'Southampton'], ['Southampton', 'Bournemouth'],
    ['Bournemouth', 'Exeter'], ['Exeter', 'Plymouth'], ['Exeter', 'Bristol'],
    ['Bristol', 'Cardiff'], ['Cardiff', 'Newport'], ['Newport', 'Swansea'],
    ['Bristol', 'Birmingham'], ['Oxford', 'Birmingham'],
    ['Coventry', 'Birmingham'], ['Coventry', 'Leicester'],
    ['Leicester', 'Nottingham'], ['Nottingham', 'Sheffield'],
    ['Birmingham', 'Manchester'], ['Birmingham', 'Liverpool'],
    ['Liverpool', 'Manchester'], ['Manchester', 'Leeds'], ['Manchester', 'Sheffield'],
    ['Sheffield', 'Leeds'], ['Leeds', 'York'], ['York', 'Hull'],
    ['Leeds', 'Middlesbrough'], ['Middlesbrough', 'Sunderland'],
    ['Sunderland', 'Newcastle'], ['Newcastle', 'Carlisle'],
    ['Liverpool', 'Carlisle'], ['Carlisle', 'Glasgow'],
    ['Newcastle', 'Edinburgh'], ['Glasgow', 'Edinburgh'],
    ['Edinburgh', 'Dundee'], ['Dundee', 'Aberdeen'], ['Aberdeen', 'Inverness'],
    ['Glasgow', 'Belfast'], ['Belfast', 'Derry'], ['Liverpool', 'Belfast'],
    ['Cambridge', 'Norwich'], ['Norwich', 'Hull']
  ]
};

fs.writeFileSync(path.join(outDir, 'uk-map.json'), JSON.stringify(buildGraph('UK Extremely Detailed', ukData, 'London', 'Inverness'), null, 2));


// ==========================================
// 2. USA Extremely Detailed 
// ==========================================
const usaData = {
  minLat: 24.5, maxLat: 49.0, minLon: -125.0, maxLon: -66.9,
  cities: [
    { name: 'New York', lat: 40.7128, lon: -74.0060 },
    { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
    { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
    { name: 'Houston', lat: 29.7604, lon: -95.3698 },
    { name: 'Phoenix', lat: 33.4484, lon: -112.0740 },
    { name: 'Philadelphia', lat: 39.9526, lon: -75.1652 },
    { name: 'San Antonio', lat: 29.4241, lon: -98.4936 },
    { name: 'San Diego', lat: 32.7157, lon: -117.1611 },
    { name: 'Dallas', lat: 32.7767, lon: -96.7970 },
    { name: 'San Jose', lat: 37.3382, lon: -121.8863 },
    { name: 'Austin', lat: 30.2672, lon: -97.7431 },
    { name: 'Jacksonville', lat: 30.3322, lon: -81.6557 },
    { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
    { name: 'Indianapolis', lat: 39.7684, lon: -86.1581 },
    { name: 'Columbus', lat: 39.9612, lon: -83.0007 },
    { name: 'Fort Worth', lat: 32.7555, lon: -97.3308 },
    { name: 'Charlotte', lat: 35.2271, lon: -80.8431 },
    { name: 'Seattle', lat: 47.6062, lon: -122.3321 },
    { name: 'Denver', lat: 39.7392, lon: -104.9903 },
    { name: 'Washington DC', lat: 38.9072, lon: -77.0369 },
    { name: 'Boston', lat: 42.3601, lon: -71.0589 },
    { name: 'El Paso', lat: 31.7619, lon: -106.4850 },
    { name: 'Nashville', lat: 36.1627, lon: -86.7816 },
    { name: 'Detroit', lat: 42.3314, lon: -83.0458 },
    { name: 'Portland', lat: 45.5051, lon: -122.6750 },
    { name: 'Memphis', lat: 35.1495, lon: -90.0490 },
    { name: 'Atlanta', lat: 33.7490, lon: -84.3880 },
    { name: 'Miami', lat: 25.7617, lon: -80.1918 },
    { name: 'Tampa', lat: 27.9506, lon: -82.4572 },
    { name: 'Orlando', lat: 28.5383, lon: -81.3792 },
    { name: 'New Orleans', lat: 29.9511, lon: -90.0715 },
    { name: 'Minneapolis', lat: 44.9778, lon: -93.2650 },
    { name: 'Omaha', lat: 41.2565, lon: -95.9345 },
    { name: 'Kansas City', lat: 39.0997, lon: -94.5786 },
    { name: 'St. Louis', lat: 38.6270, lon: -90.1994 },
    { name: 'Oklahoma City', lat: 35.4676, lon: -97.5164 },
    { name: 'Las Vegas', lat: 36.1699, lon: -115.1398 },
    { name: 'Salt Lake City', lat: 40.7608, lon: -111.8910 },
    { name: 'Albuquerque', lat: 35.0844, lon: -106.6504 },
    { name: 'Raleigh', lat: 35.7796, lon: -78.6382 },
    { name: 'Richmond', lat: 37.5407, lon: -77.4360 },
    { name: 'Baltimore', lat: 39.2904, lon: -76.6122 },
    { name: 'Pittsburgh', lat: 40.4406, lon: -79.9959 },
    { name: 'Cleveland', lat: 41.4993, lon: -81.6944 },
    { name: 'Milwaukee', lat: 43.0389, lon: -87.9065 },
    { name: 'Boise', lat: 43.6150, lon: -116.2023 }
  ],
  edges: [
    ['Seattle', 'Portland'], ['Portland', 'San Francisco'], ['San Francisco', 'San Jose'],
    ['San Jose', 'Los Angeles'], ['Los Angeles', 'San Diego'], ['Los Angeles', 'Las Vegas'],
    ['Las Vegas', 'Salt Lake City'], ['Salt Lake City', 'Boise'], ['Boise', 'Portland'],
    ['Salt Lake City', 'Denver'], ['Las Vegas', 'Phoenix'], ['San Diego', 'Phoenix'],
    ['Phoenix', 'Albuquerque'], ['Albuquerque', 'Denver'], ['Albuquerque', 'El Paso'],
    ['El Paso', 'San Antonio'], ['San Antonio', 'Austin'], ['Austin', 'Dallas'],
    ['Austin', 'Houston'], ['Houston', 'New Orleans'], ['New Orleans', 'Jacksonville'],
    ['Jacksonville', 'Orlando'], ['Orlando', 'Miami'], ['Orlando', 'Tampa'],
    ['Tampa', 'Miami'], ['Jacksonville', 'Atlanta'], ['Atlanta', 'Charlotte'],
    ['Charlotte', 'Raleigh'], ['Raleigh', 'Richmond'], ['Richmond', 'Washington DC'],
    ['Washington DC', 'Baltimore'], ['Baltimore', 'Philadelphia'], ['Philadelphia', 'New York'],
    ['New York', 'Boston'], ['New York', 'Pittsburgh'], ['Pittsburgh', 'Cleveland'],
    ['Cleveland', 'Columbus'], ['Columbus', 'Indianapolis'], ['Indianapolis', 'Chicago'],
    ['Chicago', 'Milwaukee'], ['Milwaukee', 'Minneapolis'], ['Minneapolis', 'Omaha'],
    ['Omaha', 'Kansas City'], ['Kansas City', 'St. Louis'], ['St. Louis', 'Indianapolis'],
    ['St. Louis', 'Memphis'], ['Memphis', 'Nashville'], ['Nashville', 'Atlanta'],
    ['Memphis', 'New Orleans'], ['Dallas', 'Fort Worth'], ['Fort Worth', 'Oklahoma City'],
    ['Oklahoma City', 'Kansas City'], ['Oklahoma City', 'Albuquerque'], ['Denver', 'Omaha'],
    ['Denver', 'Kansas City'], ['Dallas', 'Memphis'], ['Atlanta', 'Washington DC'],
    ['Chicago', 'Detroit'], ['Detroit', 'Cleveland'], ['Chicago', 'St. Louis']
  ]
};

fs.writeFileSync(path.join(outDir, 'usa-detailed-map.json'), JSON.stringify(buildGraph('USA Extremely Detailed', usaData, 'Seattle', 'Miami'), null, 2));


// ==========================================
// 3. Russia Extremely Detailed
// ==========================================
const ruData = {
  minLat: 41.0, maxLat: 78.0, minLon: 19.0, maxLon: 180.0,
  cities: [
    { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
    { name: 'St. Petersburg', lat: 59.9311, lon: 30.3609 },
    { name: 'Novosibirsk', lat: 55.0084, lon: 82.9357 },
    { name: 'Yekaterinburg', lat: 56.8389, lon: 60.6057 },
    { name: 'Kazan', lat: 55.7963, lon: 49.1088 },
    { name: 'Nizhny Novgorod', lat: 56.3269, lon: 44.0059 },
    { name: 'Chelyabinsk', lat: 55.1644, lon: 61.4368 },
    { name: 'Samara', lat: 53.2415, lon: 50.2212 },
    { name: 'Omsk', lat: 54.9885, lon: 73.3242 },
    { name: 'Rostov-on-Don', lat: 47.2313, lon: 39.7233 },
    { name: 'Ufa', lat: 54.7388, lon: 55.9721 },
    { name: 'Krasnoyarsk', lat: 56.0153, lon: 92.8932 },
    { name: 'Voronezh', lat: 51.6608, lon: 39.2003 },
    { name: 'Perm', lat: 58.0105, lon: 56.2502 },
    { name: 'Volgograd', lat: 48.7080, lon: 44.5133 },
    { name: 'Krasnodar', lat: 45.0393, lon: 38.9872 },
    { name: 'Saratov', lat: 51.5331, lon: 46.0342 },
    { name: 'Tyumen', lat: 57.1522, lon: 65.5272 },
    { name: 'Tolyatti', lat: 53.5086, lon: 49.4198 },
    { name: 'Izhevsk', lat: 56.8498, lon: 53.2045 },
    { name: 'Barnaul', lat: 53.3498, lon: 83.7836 },
    { name: 'Ulyanovsk', lat: 54.3141, lon: 48.4031 },
    { name: 'Irkutsk', lat: 52.2870, lon: 104.3050 },
    { name: 'Khabarovsk', lat: 48.4814, lon: 135.0760 },
    { name: 'Yaroslavl', lat: 57.6261, lon: 39.8845 },
    { name: 'Vladivostok', lat: 43.1198, lon: 131.8869 },
    { name: 'Makhachkala', lat: 42.9831, lon: 47.5046 },
    { name: 'Tomsk', lat: 56.4977, lon: 84.9744 },
    { name: 'Kemerovo', lat: 55.3333, lon: 86.0833 },
    { name: 'Novokuznetsk', lat: 53.7596, lon: 87.1216 },
    { name: 'Ryazan', lat: 54.6289, lon: 39.7364 },
    { name: 'Astrakhan', lat: 46.3497, lon: 48.0408 },
    { name: 'Penza', lat: 53.2007, lon: 45.0046 },
    { name: 'Lipetsk', lat: 52.6102, lon: 39.5951 },
    { name: 'Kaliningrad', lat: 54.7104, lon: 20.4522 },
    { name: 'Sochi', lat: 43.5853, lon: 39.7203 },
    { name: 'Yakutsk', lat: 62.0355, lon: 129.6755 },
    { name: 'Chita', lat: 52.0333, lon: 113.5500 },
    { name: 'Magadan', lat: 59.5667, lon: 150.8000 },
    { name: 'Petropavlovsk-Kamchatsky', lat: 53.0500, lon: 158.6500 }
  ],
  edges: [
    ['St. Petersburg', 'Moscow'], ['St. Petersburg', 'Yaroslavl'], ['Moscow', 'Yaroslavl'],
    ['Moscow', 'Ryazan'], ['Moscow', 'Nizhny Novgorod'], ['Moscow', 'Voronezh'],
    ['Voronezh', 'Lipetsk'], ['Voronezh', 'Rostov-on-Don'], ['Rostov-on-Don', 'Krasnodar'],
    ['Krasnodar', 'Sochi'], ['Rostov-on-Don', 'Volgograd'], ['Volgograd', 'Astrakhan'],
    ['Astrakhan', 'Makhachkala'], ['Volgograd', 'Saratov'], ['Saratov', 'Penza'],
    ['Penza', 'Ulyanovsk'], ['Ulyanovsk', 'Samara'], ['Samara', 'Tolyatti'],
    ['Tolyatti', 'Kazan'], ['Nizhny Novgorod', 'Kazan'], ['Kazan', 'Izhevsk'],
    ['Izhevsk', 'Perm'], ['Kazan', 'Ufa'], ['Ufa', 'Chelyabinsk'],
    ['Chelyabinsk', 'Yekaterinburg'], ['Perm', 'Yekaterinburg'], ['Yekaterinburg', 'Tyumen'],
    ['Tyumen', 'Omsk'], ['Omsk', 'Novosibirsk'], ['Novosibirsk', 'Tomsk'],
    ['Novosibirsk', 'Kemerovo'], ['Kemerovo', 'Novokuznetsk'], ['Novosibirsk', 'Barnaul'],
    ['Barnaul', 'Novokuznetsk'], ['Novosibirsk', 'Krasnoyarsk'], ['Krasnoyarsk', 'Irkutsk'],
    ['Irkutsk', 'Chita'], ['Chita', 'Yakutsk'], ['Yakutsk', 'Magadan'],
    ['Magadan', 'Petropavlovsk-Kamchatsky'], ['Chita', 'Khabarovsk'], ['Khabarovsk', 'Vladivostok'],
    ['Moscow', 'Kaliningrad'],  // Simulated flight path/connection
    ['Yakutsk', 'Khabarovsk']
  ]
};

fs.writeFileSync(path.join(outDir, 'russia-detailed-map.json'), JSON.stringify(buildGraph('Russia Extremely Detailed', ruData, 'Kaliningrad', 'Vladivostok'), null, 2));


// ==========================================
// 4. Africa Extremely Detailed
// ==========================================
const afData = {
  minLat: -35.0, maxLat: 38.0, minLon: -18.0, maxLon: 52.0,
  cities: [
    { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
    { name: 'Alexandria', lat: 31.2001, lon: 29.9187 },
    { name: 'Johannesburg', lat: -26.2041, lon: 28.0473 },
    { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
    { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
    { name: 'Kinshasa', lat: -4.4419, lon: 15.2663 },
    { name: 'Nairobi', lat: -1.2921, lon: 36.8219 },
    { name: 'Algiers', lat: 36.7538, lon: 3.0588 },
    { name: 'Khartoum', lat: 15.5007, lon: 32.5599 },
    { name: 'Dar es Salaam', lat: -6.7924, lon: 39.2083 },
    { name: 'Abidjan', lat: 5.3599, lon: -4.0083 },
    { name: 'Dakar', lat: 14.7167, lon: -17.4677 },
    { name: 'Casablanca', lat: 33.5731, lon: -7.5898 },
    { name: 'Accra', lat: 5.6037, lon: -0.1870 },
    { name: 'Addis Ababa', lat: 9.0054, lon: 38.7636 },
    { name: 'Luanda', lat: -8.8147, lon: 13.2302 },
    { name: 'Tunis', lat: 36.8065, lon: 10.1815 },
    { name: 'Bamako', lat: 12.6392, lon: -8.0029 },
    { name: 'Kampala', lat: 0.3476, lon: 32.5825 },
    { name: 'Lusaka', lat: -15.3875, lon: 28.3228 },
    { name: 'Harare', lat: -17.8216, lon: 31.0492 },
    { name: 'Pretoria', lat: -25.7479, lon: 28.2293 },
    { name: 'Durban', lat: -29.8587, lon: 31.0218 },
    { name: 'Maputo', lat: -25.9692, lon: 32.5732 },
    { name: 'Antananarivo', lat: -18.8792, lon: 47.5079 },
    { name: 'Kigali', lat: -1.9441, lon: 30.0619 },
    { name: 'Bujumbura', lat: -3.3822, lon: 29.3644 },
    { name: 'Brazzaville', lat: -4.2634, lon: 15.2429 },
    { name: 'Luanda', lat: -8.8390, lon: 13.2894 }, // duplicate handled naturally in Map, ignored
    { name: 'Douala', lat: 4.0511, lon: 9.7679 },
    { name: 'Yaounde', lat: 3.8480, lon: 11.5021 },
    { name: 'Abuja', lat: 9.0765, lon: 7.3986 },
    { name: 'Kano', lat: 12.0022, lon: 8.5920 },
    { name: 'Lome', lat: 6.1375, lon: 1.2125 },
    { name: 'Cotonou', lat: 6.3654, lon: 2.4183 },
    { name: 'Ouagadougou', lat: 12.3714, lon: -1.5197 },
    { name: 'Niamey', lat: 13.5116, lon: 2.1254 },
    { name: 'Freetown', lat: 8.4657, lon: -13.2317 },
    { name: 'Monrovia', lat: 6.3156, lon: -10.8074 },
    { name: 'Conakry', lat: 9.5100, lon: -13.7100 },
    { name: 'Luanda', lat: -8.8390, lon: 13.2894 }
  ],
  edges: [
    ['Cairo', 'Alexandria'], ['Cairo', 'Khartoum'], ['Khartoum', 'Addis Ababa'],
    ['Addis Ababa', 'Nairobi'], ['Nairobi', 'Kampala'], ['Kampala', 'Kigali'],
    ['Kigali', 'Bujumbura'], ['Bujumbura', 'Dar es Salaam'], ['Nairobi', 'Dar es Salaam'],
    ['Dar es Salaam', 'Maputo'], ['Maputo', 'Durban'], ['Durban', 'Johannesburg'],
    ['Johannesburg', 'Pretoria'], ['Pretoria', 'Harare'], ['Harare', 'Lusaka'],
    ['Lusaka', 'Dar es Salaam'], ['Johannesburg', 'Cape Town'], ['Cape Town', 'Luanda'],
    ['Luanda', 'Kinshasa'], ['Kinshasa', 'Brazzaville'], ['Brazzaville', 'Douala'],
    ['Douala', 'Yaounde'], ['Douala', 'Lagos'], ['Lagos', 'Cotonou'],
    ['Cotonou', 'Lome'], ['Lome', 'Accra'], ['Accra', 'Abidjan'],
    ['Abidjan', 'Monrovia'], ['Monrovia', 'Freetown'], ['Freetown', 'Conakry'],
    ['Conakry', 'Dakar'], ['Dakar', 'Casablanca'], ['Casablanca', 'Algiers'],
    ['Algiers', 'Tunis'], ['Tunis', 'Cairo'], ['Dakar', 'Bamako'],
    ['Bamako', 'Ouagadougou'], ['Ouagadougou', 'Niamey'], ['Niamey', 'Kano'],
    ['Kano', 'Abuja'], ['Abuja', 'Lagos'], ['Dar es Salaam', 'Antananarivo'],
    ['Maputo', 'Antananarivo']
  ]
};

fs.writeFileSync(path.join(outDir, 'africa-detailed-map.json'), JSON.stringify(buildGraph('Africa Extremely Detailed', afData, 'Casablanca', 'Antananarivo'), null, 2));


// ==========================================
// 5. Australia Extremely Detailed
// ==========================================
const auData = {
  minLat: -43.5, maxLat: -10.5, minLon: 113.0, maxLon: 154.0,
  cities: [
    { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
    { name: 'Melbourne', lat: -37.8136, lon: 144.9631 },
    { name: 'Brisbane', lat: -27.4698, lon: 153.0251 },
    { name: 'Perth', lat: -31.9505, lon: 115.8605 },
    { name: 'Adelaide', lat: -34.9285, lon: 138.6007 },
    { name: 'Gold Coast', lat: -28.0167, lon: 153.4000 },
    { name: 'Newcastle', lat: -32.9283, lon: 151.7817 },
    { name: 'Canberra', lat: -35.2809, lon: 149.1300 },
    { name: 'Sunshine Coast', lat: -26.6500, lon: 153.0667 },
    { name: 'Wollongong', lat: -34.4278, lon: 150.8931 },
    { name: 'Hobart', lat: -42.8821, lon: 147.3272 },
    { name: 'Geelong', lat: -38.1499, lon: 144.3617 },
    { name: 'Townsville', lat: -19.2590, lon: 146.8169 },
    { name: 'Cairns', lat: -16.9186, lon: 145.7781 },
    { name: 'Darwin', lat: -12.4634, lon: 130.8456 },
    { name: 'Toowoomba', lat: -27.5598, lon: 151.9507 },
    { name: 'Ballarat', lat: -37.5622, lon: 143.8503 },
    { name: 'Bendigo', lat: -36.7570, lon: 144.2794 },
    { name: 'Albury', lat: -36.0737, lon: 146.9135 },
    { name: 'Launceston', lat: -41.4332, lon: 147.1441 },
    { name: 'Mackay', lat: -21.1411, lon: 149.1861 },
    { name: 'Rockhampton', lat: -23.3750, lon: 150.5117 },
    { name: 'Bunbury', lat: -33.3256, lon: 115.6396 },
    { name: 'Bundaberg', lat: -24.8662, lon: 152.3479 },
    { name: 'Wagga Wagga', lat: -35.1147, lon: 147.3696 },
    { name: 'Alice Springs', lat: -23.6980, lon: 133.8807 },
    { name: 'Kalgoorlie', lat: -30.7490, lon: 121.4660 },
    { name: 'Broome', lat: -17.9644, lon: 122.2304 },
    { name: 'Karratha', lat: -20.7377, lon: 116.8456 },
    { name: 'Port Hedland', lat: -20.3107, lon: 118.5778 },
    { name: 'Geraldton', lat: -28.7750, lon: 114.6139 },
    { name: 'Mount Gambier', lat: -37.8284, lon: 140.7804 },
    { name: 'Port Lincoln', lat: -34.7333, lon: 135.8667 },
    { name: 'Gladstone', lat: -23.8485, lon: 151.2618 },
    { name: 'Mount Isa', lat: -20.7256, lon: 139.4927 }
  ],
  edges: [
    ['Sydney', 'Wollongong'], ['Wollongong', 'Canberra'], ['Canberra', 'Albury'],
    ['Albury', 'Wagga Wagga'], ['Albury', 'Melbourne'], ['Melbourne', 'Geelong'],
    ['Melbourne', 'Ballarat'], ['Ballarat', 'Bendigo'], ['Melbourne', 'Hobart'],
    ['Hobart', 'Launceston'], ['Melbourne', 'Mount Gambier'], ['Mount Gambier', 'Adelaide'],
    ['Adelaide', 'Port Lincoln'], ['Adelaide', 'Alice Springs'], ['Alice Springs', 'Darwin'],
    ['Alice Springs', 'Mount Isa'], ['Mount Isa', 'Townsville'], ['Townsville', 'Cairns'],
    ['Townsville', 'Mackay'], ['Mackay', 'Rockhampton'], ['Rockhampton', 'Gladstone'],
    ['Gladstone', 'Bundaberg'], ['Bundaberg', 'Sunshine Coast'], ['Sunshine Coast', 'Brisbane'],
    ['Brisbane', 'Gold Coast'], ['Brisbane', 'Toowoomba'], ['Gold Coast', 'Newcastle'],
    ['Newcastle', 'Sydney'], ['Adelaide', 'Perth'], ['Perth', 'Bunbury'],
    ['Perth', 'Geraldton'], ['Geraldton', 'Karratha'], ['Karratha', 'Port Hedland'],
    ['Port Hedland', 'Broome'], ['Broome', 'Darwin'], ['Perth', 'Kalgoorlie'],
    ['Kalgoorlie', 'Adelaide']
  ]
};

fs.writeFileSync(path.join(outDir, 'australia-detailed-map.json'), JSON.stringify(buildGraph('Australia Extremely Detailed', auData, 'Perth', 'Cairns'), null, 2));


console.log("Extremely detailed map scripts completed!");
