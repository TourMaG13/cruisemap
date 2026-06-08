const WebSocket = require('ws');
const admin = require('firebase-admin');
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY;
const LISTEN_DURATION_MS = 150000; // 2.5 minutes par vague
const MAX_CONNECTIONS = 3;

// =====================================================================
// FIREBASE INIT
// =====================================================================
function initFirebase() {
  var pk = process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: pk
    })
  });
  return admin.firestore();
}

// =====================================================================
// CHARGER LES NAVIRES DEPUIS FIRESTORE (plus de liste en dur !)
// =====================================================================
async function loadTrackedShipsFromFirestore(db) {
  console.log('Chargement des navires depuis Firestore...');
  const tracked = {};
  const clSnap = await db.collection('cruiseLines').get();
  
  for (const clDoc of clSnap.docs) {
    const cl = clDoc.data();
    const companyName = cl.title || '?';
    
    // Skip draft companies
    if (cl.status === 'draft') continue;
    
    const shipsSnap = await db.collection('cruiseLines').doc(clDoc.id).collection('ships').get();
    
    for (const shipDoc of shipsSnap.docs) {
      const ship = shipDoc.data();
      
      // Skip draft ships
      if (ship.status === 'draft') continue;
      
      // Only track ships that have a MMSI
      const mmsi = (ship.mmsi || '').trim();
      if (!mmsi) continue;
      
      tracked[mmsi] = {
        name: ship.name || '?',
        company: companyName,
        shipId: shipDoc.id,
        companyId: clDoc.id
      };
    }
  }
  
  console.log(Object.keys(tracked).length + ' navires avec MMSI trouves dans Firestore\n');
  
  // Log par compagnie
  const byCompany = {};
  for (const [mmsi, info] of Object.entries(tracked)) {
    if (!byCompany[info.company]) byCompany[info.company] = [];
    byCompany[info.company].push(info.name);
  }
  for (const [company, ships] of Object.entries(byCompany).sort()) {
    console.log('  ' + company + ': ' + ships.length + ' navires (' + ships.slice(0, 5).join(', ') + (ships.length > 5 ? '...' : '') + ')');
  }
  console.log('');
  
  return tracked;
}

// =====================================================================
// AIS STREAM
// =====================================================================
function chunk(arr, size) {
  var c = [];
  for (var i = 0; i < arr.length; i += size) c.push(arr.slice(i, i + size));
  return c;
}

function connectBatch(batchMMSI, batchIndex, positions, TRACKED_SHIPS) {
  return new Promise(function(resolve) {
    var msgs = 0;
    var ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
    
    ws.on('open', function() {
      console.log('[Batch ' + batchIndex + '] Connecte (' + batchMMSI.length + ' MMSI)');
      ws.send(JSON.stringify({
        Apikey: AISSTREAM_API_KEY,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FiltersShipMMSI: batchMMSI,
        FilterMessageTypes: ['PositionReport']
      }));
      var pi = setInterval(function() { if (ws.readyState === WebSocket.OPEN) ws.ping(); }, 30000);
      ws.on('close', function() { clearInterval(pi); });
    });
    
    ws.on('message', function(data) {
      msgs++;
      try {
        var msg = JSON.parse(data.toString()), meta = msg.MetaData;
        var mmsi = meta && meta.MMSI ? meta.MMSI.toString() : null;
        if (!mmsi || !TRACKED_SHIPS[mmsi]) return;
        var pr = msg.Message && msg.Message.PositionReport;
        if (!pr) return;
        var si = TRACKED_SHIPS[mmsi];
        
        // Verification du nom AIS
        var aisName = (meta.ShipName || '').trim().toUpperCase();
        var expectedName = si.name.toUpperCase().replace(/^(MS|MV|RV|M\/S)\s+/, '');
        var expectedWords = expectedName.split(/[\s-]+/).filter(function(w) { return w.length > 2; });
        var nameMatch = expectedWords.some(function(w) { return aisName.indexOf(w) >= 0; });
        if (!nameMatch && aisName.length > 0) {
          console.log('!! SKIP ' + aisName + ' (attendu: ' + si.name + ', MMSI ' + mmsi + ')');
          return;
        }
        
        positions.set(mmsi, {
          mmsi: mmsi,
          name: (meta.ShipName || '').trim() || si.name,
          lat: pr.Latitude,
          lng: pr.Longitude,
          speed: pr.Sog,
          course: pr.Cog,
          heading: pr.TrueHeading,
          navStatus: pr.NavigationalStatus,
          timestamp: meta.time_utc || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          company: si.company
        });
        console.log('>> ' + ((meta.ShipName || '').trim() || si.name) + ' (' + si.company + ') ' + pr.Latitude.toFixed(4) + 'N ' + pr.Longitude.toFixed(4) + 'E ' + pr.Sog + 'kn');
      } catch (e) {}
    });
    
    ws.on('error', function(e) { console.error('[Batch ' + batchIndex + '] Err: ' + e.message); });
    ws.on('close', function(c) { console.log('[Batch ' + batchIndex + '] Ferme, ' + msgs + ' msgs'); });
    
    setTimeout(function() { ws.close(); resolve(); }, LISTEN_DURATION_MS);
  });
}

async function connectAISstream(TRACKED_SHIPS) {
  var MMSI_LIST = Object.keys(TRACKED_SHIPS);
  var positions = new Map();
  
  if (MMSI_LIST.length === 0) {
    console.log('Aucun navire avec MMSI a tracker');
    return positions;
  }
  
  var batchSize = Math.ceil(MMSI_LIST.length / MAX_CONNECTIONS);
  if (batchSize > 50) batchSize = 50;
  var batches = chunk(MMSI_LIST, batchSize);
  
  console.log(MMSI_LIST.length + ' navires en ' + batches.length + ' connexions (max ' + batchSize + ' par batch)\n');
  
  for (var wave = 0; wave < batches.length; wave += MAX_CONNECTIONS) {
    var waveBatches = batches.slice(wave, wave + MAX_CONNECTIONS);
    console.log('Vague ' + (Math.floor(wave / MAX_CONNECTIONS) + 1) + ': ' + waveBatches.length + ' connexions');
    await Promise.all(waveBatches.map(function(b, i) {
      return connectBatch(b, wave + i + 1, positions, TRACKED_SHIPS);
    }));
  }
  
  console.log('\nPositions: ' + positions.size + '/' + MMSI_LIST.length + '\n');
  return positions;
}

// =====================================================================
// ECRITURE FIRESTORE
// =====================================================================
async function writePositionsToFirestore(db, positions, TRACKED_SHIPS) {
  if (positions.size === 0) { console.log('Aucune position'); return; }
  
  var batch = db.batch();
  var ref = db.collection('ship_positions');
  
  for (var [mmsi, pos] of positions) {
    batch.set(ref.doc(mmsi), Object.assign({}, pos, {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }));
    console.log('Save: ' + pos.name + ' (' + pos.lat.toFixed(4) + ',' + pos.lng.toFixed(4) + ')');
  }
  
  batch.set(ref.doc('_last_update'), {
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    shipsTracked: positions.size,
    totalShipsMonitored: Object.keys(TRACKED_SHIPS).length,
    source: 'aisstream.io',
    runner: 'github-actions'
  });
  
  await batch.commit();
  console.log(positions.size + ' position(s) sauvegardee(s)');
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  console.log('CruiseMAP Ship Tracker - ' + new Date().toISOString());
  console.log('Mode: lecture MMSI depuis Firestore (plus de liste en dur)\n');
  
  if (!AISSTREAM_API_KEY) { console.error('API key manquante'); process.exit(1); }
  if (!process.env.FIREBASE_PROJECT_ID) { console.error('Firebase vars manquantes'); process.exit(1); }
  
  var db = initFirebase();
  console.log('Firebase OK\n');
  
  // Charger les navires depuis Firestore au lieu de la liste en dur
  var TRACKED_SHIPS = await loadTrackedShipsFromFirestore(db);
  
  var positions = await connectAISstream(TRACKED_SHIPS);
  await writePositionsToFirestore(db, positions, TRACKED_SHIPS);
  
  console.log('\nTermine!');
  process.exit(0);
}

main().catch(function(e) { console.error('Fatal: ' + e); process.exit(1); });
