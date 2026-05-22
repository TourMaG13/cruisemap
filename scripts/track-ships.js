/**
 * CruiseMAP Ship Tracker
 * 
 * Se connecte à AISstream.io via WebSocket, écoute pendant ~2 minutes,
 * collecte les positions AIS des navires suivis, et écrit dans Firestore.
 * 
 * Lancé par GitHub Actions toutes les 6 heures.
 */

const WebSocket = require('ws');
const admin = require('firebase-admin');

// =====================================================================
// CONFIG
// =====================================================================

const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY;
const LISTEN_DURATION_MS = 120_000; // 2 minutes d'écoute

// Navires à suivre : MMSI → infos pour référence
const TRACKED_SHIPS = {
  '311000995': { name: 'Scenic Eclipse',    cruiseLineId: '0FumIK6cdo1OslR4r395', imo: '9797371' },
  '311001061': { name: 'Scenic Eclipse II', cruiseLineId: '0FumIK6cdo1OslR4r395', imo: '9850460' },
  '226010880': { name: 'MS Loire Princesse', cruiseLineId: 'CROISIEUROPE_ID',      imo: '' },
  '269057408': { name: 'Viking Aegir',      cruiseLineId: 'hknR8Zx0edLc0Go0jGqq', imo: '' },
};

const MMSI_LIST = Object.keys(TRACKED_SHIPS);

// =====================================================================
// FIREBASE INIT
// =====================================================================

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

// =====================================================================
// AISSTREAM WEBSOCKET
// =====================================================================

function connectAISstream() {
  return new Promise((resolve, reject) => {
    const positions = new Map(); // MMSI → latest position data
    let messagesReceived = 0;
    let relevantMessages = 0;

    console.log(`🔌 Connexion à AISstream.io...`);
    console.log(`📡 Suivi de ${MMSI_LIST.length} navires : ${MMSI_LIST.join(', ')}`);
    console.log(`⏱️  Écoute pendant ${LISTEN_DURATION_MS / 1000} secondes...\n`);

    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

    ws.on('open', () => {
      console.log('✅ Connecté au WebSocket AISstream');
      console.log(`   readyState: ${ws.readyState}`);
      
      // Format exact de la doc aisstream.io
      const subscriptionMessage = {
        Apikey: AISSTREAM_API_KEY,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FiltersShipMMSI: MMSI_LIST,
        FilterMessageTypes: ['PositionReport']
      };
      
      console.log('📨 Envoi souscription:', JSON.stringify(subscriptionMessage).substring(0, 200) + '...');
      ws.send(JSON.stringify(subscriptionMessage));
      console.log('📨 Souscription envoyée\n');

      // Keepalive ping toutes les 30s
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      // Status log toutes les 30s
      const statusInterval = setInterval(() => {
        console.log(`⏳ ${Math.round((Date.now() - startTime) / 1000)}s — ${messagesReceived} msgs reçus, ${positions.size} positions, ws=${ws.readyState === WebSocket.OPEN ? 'OPEN' : 'CLOSED'}`);
      }, 30000);

      // Cleanup intervals on close
      ws.on('close', () => {
        clearInterval(pingInterval);
        clearInterval(statusInterval);
      });
    });

    const startTime = Date.now();

    ws.on('message', (data) => {
      messagesReceived++;
      
      // Log premier message brut pour debug
      if (messagesReceived <= 3) {
        const raw = data.toString().substring(0, 300);
        console.log(`📩 Message #${messagesReceived} (brut): ${raw}...`);
      }
      
      try {
        const msg = JSON.parse(data.toString());
        const msgType = msg.MessageType;
        const meta = msg.MetaData;
        const mmsi = meta?.MMSI?.toString();
        
        if (!mmsi || !TRACKED_SHIPS[mmsi]) return;
        
        relevantMessages++;
        const shipInfo = TRACKED_SHIPS[mmsi];
        
        if (msgType === 'PositionReport' || msgType === 'StandardClassBPositionReport') {
          const posReport = msg.Message?.PositionReport || msg.Message?.StandardClassBPositionReport;
          if (!posReport) return;
          
          const posData = {
            mmsi: mmsi,
            name: meta.ShipName?.trim() || shipInfo.name,
            lat: posReport.Latitude,
            lng: posReport.Longitude,
            speed: posReport.Sog, // Speed over ground (knots)
            course: posReport.Cog, // Course over ground (degrees)
            heading: posReport.TrueHeading,
            navStatus: posReport.NavigationalStatus,
            timestamp: meta.time_utc || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            cruiseLineId: shipInfo.cruiseLineId,
          };
          
          positions.set(mmsi, posData);
          console.log(`🚢 ${posData.name} — ${posData.lat.toFixed(4)}°N, ${posData.lng.toFixed(4)}°E — ${posData.speed} kn`);
        }
        
        if (msgType === 'ShipStaticData') {
          const staticData = msg.Message?.ShipStaticData;
          if (!staticData) return;
          
          // Enrichir avec les données statiques si on a déjà une position
          const existing = positions.get(mmsi);
          if (existing) {
            existing.destination = staticData.Destination?.trim() || '';
            existing.eta = staticData.Eta ? `${staticData.Eta.Month}/${staticData.Eta.Day} ${staticData.Eta.Hour}:${staticData.Eta.Minute}` : '';
            existing.shipType = staticData.Type;
            positions.set(mmsi, existing);
            console.log(`📋 ${shipInfo.name} — destination: ${existing.destination || '(non renseignée)'}`);
          }
        }
        
      } catch (err) {
        // Ignore parse errors silently
      }
    });

    ws.on('error', (err) => {
      console.error('❌ Erreur WebSocket:', err.message);
      console.error('   Stack:', err.stack?.substring(0, 200));
    });

    ws.on('pong', () => {
      // Connection is alive - silent
    });

    ws.on('unexpected-response', (req, res) => {
      console.error(`❌ Réponse inattendue du serveur: HTTP ${res.statusCode}`);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => console.error('   Body:', body.substring(0, 200)));
    });

    ws.on('close', (code, reason) => {
      console.log(`\n🔌 WebSocket fermé (code ${code}, raison: ${reason || 'aucune'})`);
    });

    // Fermer après LISTEN_DURATION_MS
    setTimeout(() => {
      console.log(`\n⏱️  Fin de l'écoute (${LISTEN_DURATION_MS / 1000}s)`);
      console.log(`📊 Messages reçus: ${messagesReceived} total, ${relevantMessages} pertinents`);
      console.log(`🚢 Positions collectées: ${positions.size}/${MMSI_LIST.length} navires\n`);
      
      ws.close();
      resolve(positions);
    }, LISTEN_DURATION_MS);
  });
}

// =====================================================================
// FIRESTORE WRITE
// =====================================================================

async function writePositionsToFirestore(db, positions) {
  if (positions.size === 0) {
    console.log('⚠️  Aucune position collectée — rien à écrire');
    return;
  }

  const batch = db.batch();
  const collectionRef = db.collection('ship_positions');

  for (const [mmsi, pos] of positions) {
    // On utilise le MMSI comme ID de document pour écraser la position précédente
    const docRef = collectionRef.doc(mmsi);
    batch.set(docRef, {
      ...pos,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`💾 ${pos.name} → Firestore (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`);
  }

  // Écrire aussi un document de metadata avec le timestamp du dernier run
  const metaRef = collectionRef.doc('_last_update');
  batch.set(metaRef, {
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    shipsTracked: positions.size,
    totalShipsMonitored: MMSI_LIST.length,
    source: 'aisstream.io',
    runner: 'github-actions',
  });

  await batch.commit();
  console.log(`\n✅ ${positions.size} position(s) écrite(s) dans Firestore (collection: ship_positions)`);
}

// =====================================================================
// MAIN
// =====================================================================

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🗺️  CruiseMAP Ship Tracker — AISstream.io');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`📅 ${new Date().toISOString()}\n`);

  // Vérifier les variables d'environnement
  if (!AISSTREAM_API_KEY) {
    console.error('❌ AISSTREAM_API_KEY manquante');
    process.exit(1);
  }
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('❌ Variables Firebase manquantes (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
    process.exit(1);
  }

  // Init Firebase
  const db = initFirebase();
  console.log('🔥 Firebase initialisé\n');

  // Écouter AISstream
  const positions = await connectAISstream();

  // Écrire dans Firestore
  await writePositionsToFirestore(db, positions);

  console.log('\n🏁 Terminé !');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
