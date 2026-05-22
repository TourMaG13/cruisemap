/**
 * CruiseMAP Ship Tracker
 * 
 * Se connecte a AISstream.io via WebSocket, ecoute pendant ~4 minutes,
 * collecte les positions AIS des navires suivis, et ecrit dans Firestore.
 * 
 * Lance par GitHub Actions toutes les 6 heures.
 */

const WebSocket = require('ws');
const admin = require('firebase-admin');

const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY;
const LISTEN_DURATION_MS = 240_000; // 4 minutes

// Navires a suivre : MMSI -> infos
const TRACKED_SHIPS = {
  // === SCENIC LUXURY CRUISES (ocean) ===
  '311000995': { name: 'Scenic Eclipse', company: 'Scenic' },
  '311001061': { name: 'Scenic Eclipse II', company: 'Scenic' },

  // === CROISIEUROPE ===
  '226010880': { name: 'MS Loire Princesse', company: 'CroisiEurope' },

  // === VIKING ===
  '269057408': { name: 'Viking Aegir', company: 'Viking' },

  // === A-ROSA ===
  '211572460': { name: 'A-Rosa Silva', company: 'A-Rosa' },
  '211621310': { name: 'A-Rosa Flora', company: 'A-Rosa' },
  '211160680': { name: 'A-Rosa Donna', company: 'A-Rosa' },
  '211160660': { name: 'A-Rosa Bella', company: 'A-Rosa' },
  '211160710': { name: 'A-Rosa Riva', company: 'A-Rosa' },
  '211519930': { name: 'A-Rosa Brava', company: 'A-Rosa' },
  '211488620': { name: 'A-Rosa Viva', company: 'A-Rosa' },
  '211455520': { name: 'A-Rosa Aqua', company: 'A-Rosa' },

  // === AMADEUS (Luftner Cruises) ===
  '211754910': { name: 'Amadeus Provence', company: 'Amadeus' },
  '211299340': { name: 'Amadeus Imperial', company: 'Amadeus' },
  '218046420': { name: 'Amadeus Nova', company: 'Amadeus' },
  '211115500': { name: 'Amadeus Queen', company: 'Amadeus' },
  '211216820': { name: 'Amadeus Star', company: 'Amadeus' },
  '211229340': { name: 'Amadeus Aurea', company: 'Amadeus' },

  // === AMAWATERWAYS ===
  '269057481': { name: 'AmaSonata', company: 'AmaWaterways' },
  '269057515': { name: 'AmaVenita', company: 'AmaWaterways' },
  '269057394': { name: 'AmaCerto', company: 'AmaWaterways' },
  '269057657': { name: 'AmaMagna', company: 'AmaWaterways' },
};

const MMSI_LIST = Object.keys(TRACKED_SHIPS);

function initFirebase() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
  return admin.firestore();
}

function connectAISstream() {
  return new Promise((resolve, reject) => {
    const positions = new Map();
    let messagesReceived = 0;
    let relevantMessages = 0;

    console.log('Connexion a AISstream.io...');
    console.log('Suivi de ' + MMSI_LIST.length + ' navires');
    console.log('Ecoute pendant ' + (LISTEN_DURATION_MS / 1000) + ' secondes...\n');

    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

    ws.on('open', function() {
      console.log('Connecte au WebSocket AISstream');

      var subscriptionMessage = {
        Apikey: AISSTREAM_API_KEY,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FiltersShipMMSI: MMSI_LIST,
        FilterMessageTypes: ['PositionReport']
      };

      ws.send(JSON.stringify(subscriptionMessage));
      console.log('Souscription envoyee (' + MMSI_LIST.length + ' MMSI)\n');

      var pingInterval = setInterval(function() {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, 30000);

      var statusInterval = setInterval(function() {
        console.log('Status: ' + messagesReceived + ' msgs, ' + positions.size + ' positions, ws=' + (ws.readyState === WebSocket.OPEN ? 'OPEN' : 'CLOSED'));
      }, 30000);

      ws.on('close', function() {
        clearInterval(pingInterval);
        clearInterval(statusInterval);
      });
    });

    ws.on('message', function(data) {
      messagesReceived++;

      if (messagesReceived <= 3) {
        console.log('Message #' + messagesReceived + ': ' + data.toString().substring(0, 200) + '...');
      }

      try {
        var msg = JSON.parse(data.toString());
        var meta = msg.MetaData;
        var mmsi = meta && meta.MMSI ? meta.MMSI.toString() : null;

        if (!mmsi || !TRACKED_SHIPS[mmsi]) return;

        relevantMessages++;
        var shipInfo = TRACKED_SHIPS[mmsi];
        var posReport = msg.Message && msg.Message.PositionReport;
        if (!posReport) return;

        var posData = {
          mmsi: mmsi,
          name: (meta.ShipName || '').trim() || shipInfo.name,
          lat: posReport.Latitude,
          lng: posReport.Longitude,
          speed: posReport.Sog,
          course: posReport.Cog,
          heading: posReport.TrueHeading,
          navStatus: posReport.NavigationalStatus,
          timestamp: meta.time_utc || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          company: shipInfo.company,
        };

        positions.set(mmsi, posData);
        console.log('>> ' + posData.name + ' (' + shipInfo.company + ') - ' + posData.lat.toFixed(4) + 'N, ' + posData.lng.toFixed(4) + 'E - ' + posData.speed + ' kn');

      } catch (err) {}
    });

    ws.on('error', function(err) {
      console.error('Erreur WebSocket: ' + err.message);
    });

    ws.on('pong', function() {});

    ws.on('close', function(code) {
      console.log('\nWebSocket ferme (code ' + code + ')');
    });

    setTimeout(function() {
      console.log('\nFin de l ecoute (' + (LISTEN_DURATION_MS / 1000) + 's)');
      console.log('Messages recus: ' + messagesReceived + ' total, ' + relevantMessages + ' pertinents');
      console.log('Positions collectees: ' + positions.size + '/' + MMSI_LIST.length + ' navires\n');
      ws.close();
      resolve(positions);
    }, LISTEN_DURATION_MS);
  });
}

async function writePositionsToFirestore(db, positions) {
  if (positions.size === 0) {
    console.log('Aucune position collectee');
    return;
  }

  var batch = db.batch();
  var collectionRef = db.collection('ship_positions');

  for (var [mmsi, pos] of positions) {
    var docRef = collectionRef.doc(mmsi);
    batch.set(docRef, Object.assign({}, pos, {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }));
    console.log('Save: ' + pos.name + ' -> Firestore (' + pos.lat.toFixed(4) + ', ' + pos.lng.toFixed(4) + ')');
  }

  var metaRef = collectionRef.doc('_last_update');
  batch.set(metaRef, {
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    shipsTracked: positions.size,
    totalShipsMonitored: MMSI_LIST.length,
    source: 'aisstream.io',
    runner: 'github-actions',
  });

  await batch.commit();
  console.log('\n' + positions.size + ' position(s) ecrite(s) dans Firestore');
}

async function main() {
  console.log('========================================');
  console.log('  CruiseMAP Ship Tracker - AISstream.io');
  console.log('========================================\n');
  console.log('Date: ' + new Date().toISOString() + '\n');

  if (!AISSTREAM_API_KEY) { console.error('AISSTREAM_API_KEY manquante'); process.exit(1); }
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('Variables Firebase manquantes'); process.exit(1);
  }

  var db = initFirebase();
  console.log('Firebase initialise\n');

  var positions = await connectAISstream();
  await writePositionsToFirestore(db, positions);

  console.log('\nTermine !');
  process.exit(0);
}

main().catch(function(err) {
  console.error('Erreur fatale: ' + err);
  process.exit(1);
});
