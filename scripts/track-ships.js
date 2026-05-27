const WebSocket = require('ws');
const admin = require('firebase-admin');
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY;
const LISTEN_DURATION_MS = 240000;
const MAX_CONNECTIONS = 3; // AISstream limite a 3 connexions simultanées

const TRACKED_SHIPS = {
  // === SCENIC ===
  '311000995': { name: 'Scenic Eclipse', company: 'Scenic' },
  '311001061': { name: 'Scenic Eclipse II', company: 'Scenic' },
  // === CROISIEUROPE ===
  '226010880': { name: 'MS Loire Princesse', company: 'CroisiEurope' },
  '253242505': { name: 'MS France', company: 'CroisiEurope' },
  '253242509': { name: 'MS Monet', company: 'CroisiEurope' },
  '227720480': { name: 'MS Beethoven', company: 'CroisiEurope' },
  '244022108': { name: 'MS Botticelli', company: 'CroisiEurope' },
  '226001420': { name: 'MS Mistral', company: 'CroisiEurope' },
  '226001350': { name: 'MS Van Gogh', company: 'CroisiEurope' },
  '226001370': { name: 'MS Camargue', company: 'CroisiEurope' },
  '226001300': { name: 'MS Renoir', company: 'CroisiEurope' },
  '226001310': { name: 'MS Europe', company: 'CroisiEurope' },
  '226001320': { name: 'MS Symphonie', company: 'CroisiEurope' },
  '226001340': { name: 'MS Leonard de Vinci', company: 'CroisiEurope' },
  '226001360': { name: 'MS Lafayette', company: 'CroisiEurope' },
  '226001380': { name: 'MS Modigliani', company: 'CroisiEurope' },
  '226010870': { name: 'MS Elbe Princesse', company: 'CroisiEurope' },
  '226010890': { name: 'MS Elbe Princesse II', company: 'CroisiEurope' },
  '226001400': { name: 'MS Seine Princess', company: 'CroisiEurope' },
  '255806426': { name: 'MS La Belle de l Adriatique', company: 'CroisiEurope' },
  '253242507': { name: 'MS Infante Don Henrique', company: 'CroisiEurope' },
  '253242508': { name: 'MS Gil Eanes', company: 'CroisiEurope' },
  '253242506': { name: 'MS Miguel Torga', company: 'CroisiEurope' },
  '253242510': { name: 'MS Fernand de Magellan', company: 'CroisiEurope' },
  '226001330': { name: 'MS Jeanine', company: 'CroisiEurope' },
  '226001390': { name: 'MS Danube', company: 'CroisiEurope' },
  '226001410': { name: 'MS Camille', company: 'CroisiEurope' },
  '226001430': { name: 'MS Symphonie II', company: 'CroisiEurope' },
  '253242511': { name: 'MS Douro Serenity', company: 'CroisiEurope' },
  '253242512': { name: 'MS Douro Cruiser', company: 'CroisiEurope' },
  '226001440': { name: 'MS Rhein Symphonie', company: 'CroisiEurope' },
  '226001450': { name: 'MS Heidelberg', company: 'CroisiEurope' },
  '253242513': { name: 'MS Douro Prince', company: 'CroisiEurope' },
  '226001460': { name: 'MS Bolero', company: 'CroisiEurope' },
  '253242514': { name: 'MS Douro Splendour', company: 'CroisiEurope' },
  '253242515': { name: 'MS Douro Elegance', company: 'CroisiEurope' },
  '253242516': { name: 'MS Andorinha', company: 'CroisiEurope' },
  '226001470': { name: 'MS Guadalquivir', company: 'CroisiEurope' },
  // === VIKING (MMSI confirmes via MarineTraffic/VesselFinder) ===
  '269057390': { name: 'Viking Freya', company: 'Viking' },
  '269057407': { name: 'Viking Embla', company: 'Viking' },
  '269057408': { name: 'Viking Aegir', company: 'Viking' },
  '269057417': { name: 'Viking Var', company: 'Viking' },
  '269057448': { name: 'Viking Baldur', company: 'Viking' },
  '269057465': { name: 'Viking Ingvi', company: 'Viking' },
  '269057469': { name: 'Viking Idi', company: 'Viking' },
  '269057478': { name: 'Viking Hlin', company: 'Viking' },
  '269057498': { name: 'Viking Skirnir', company: 'Viking' },
  '269057499': { name: 'Viking Modi', company: 'Viking' },
  '269057549': { name: 'Viking Tialfi', company: 'Viking' },
  '269057649': { name: 'nickoVISION', company: 'nicko cruises' },
  '269057695': { name: 'Viking Sigyn', company: 'Viking' },
  '269057766': { name: 'Viking Egdir', company: 'Viking' },
  // === EMERALD (MMSI confirme: Star 229818000) ===
  '229818000': { name: 'Emerald Star', company: 'Emerald' },
  // === A-ROSA (confirmes) ===
  '211572460': { name: 'A-Rosa Silva', company: 'A-Rosa' },
  '211621310': { name: 'A-Rosa Flora', company: 'A-Rosa' },
  '211160680': { name: 'A-Rosa Donna', company: 'A-Rosa' },
  '211160660': { name: 'A-Rosa Bella', company: 'A-Rosa' },
  '211160710': { name: 'A-Rosa Riva', company: 'A-Rosa' },
  '211519930': { name: 'A-Rosa Brava', company: 'A-Rosa' },
  '211488620': { name: 'A-Rosa Viva', company: 'A-Rosa' },
  '211455520': { name: 'A-Rosa Aqua', company: 'A-Rosa' },
  // === AMADEUS (confirmes) ===
  '211754910': { name: 'Amadeus Provence', company: 'Amadeus' },
  '211299340': { name: 'Amadeus Imperial', company: 'Amadeus' },
  '218046420': { name: 'Amadeus Nova', company: 'Amadeus' },
  '211115500': { name: 'Amadeus Queen', company: 'Amadeus' },
  '211216820': { name: 'Amadeus Star', company: 'Amadeus' },
  '211229340': { name: 'Amadeus Aurea', company: 'Amadeus' },
  // === AMAWATERWAYS (confirmes) ===
  '269057481': { name: 'AmaSonata', company: 'AmaWaterways' },
  '269057515': { name: 'AmaVenita', company: 'AmaWaterways' },
  '269057657': { name: 'AmaMagna', company: 'AmaWaterways' },
};

const MMSI_LIST = Object.keys(TRACKED_SHIPS);

function initFirebase() {
  var pk = process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';
  admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }) });
  return admin.firestore();
}

function chunk(arr, size) { var c=[]; for(var i=0;i<arr.length;i+=size)c.push(arr.slice(i,i+size)); return c; }

function connectBatch(batchMMSI, batchIndex, positions) {
  return new Promise(function(resolve) {
    var msgs = 0;
    var ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
    ws.on('open', function() {
      console.log('[Batch ' + batchIndex + '] Connecte (' + batchMMSI.length + ' MMSI)');
      ws.send(JSON.stringify({ Apikey: AISSTREAM_API_KEY, BoundingBoxes: [[[-90,-180],[90,180]]], FiltersShipMMSI: batchMMSI, FilterMessageTypes: ['PositionReport'] }));
      var pi = setInterval(function() { if(ws.readyState===WebSocket.OPEN)ws.ping(); }, 30000);
      ws.on('close', function() { clearInterval(pi); });
    });
    ws.on('message', function(data) {
      msgs++;
      try {
        var msg = JSON.parse(data.toString()), meta = msg.MetaData;
        var mmsi = meta&&meta.MMSI?meta.MMSI.toString():null;
        if(!mmsi||!TRACKED_SHIPS[mmsi])return;
        var pr = msg.Message&&msg.Message.PositionReport; if(!pr)return;
        var si = TRACKED_SHIPS[mmsi];
        positions.set(mmsi, { mmsi:mmsi, name:(meta.ShipName||'').trim()||si.name, lat:pr.Latitude, lng:pr.Longitude, speed:pr.Sog, course:pr.Cog, heading:pr.TrueHeading, navStatus:pr.NavigationalStatus, timestamp:meta.time_utc||new Date().toISOString(), updatedAt:new Date().toISOString(), company:si.company });
        console.log('>> '+((meta.ShipName||'').trim()||si.name)+' ('+si.company+') '+pr.Latitude.toFixed(4)+'N '+pr.Longitude.toFixed(4)+'E '+pr.Sog+'kn');
      } catch(e){}
    });
    ws.on('error', function(e) { console.error('[Batch '+batchIndex+'] Err: '+e.message); });
    ws.on('close', function(c) { console.log('[Batch '+batchIndex+'] Ferme, '+msgs+' msgs'); });
    setTimeout(function() { ws.close(); resolve(); }, LISTEN_DURATION_MS);
  });
}

async function connectAISstream() {
  var positions = new Map();
  var batchSize = Math.ceil(MMSI_LIST.length / MAX_CONNECTIONS);
  var batches = chunk(MMSI_LIST, batchSize);
  console.log(MMSI_LIST.length + ' navires en ' + batches.length + ' connexions (max '+batchSize+' par batch)\n');
  await Promise.all(batches.map(function(b,i){return connectBatch(b,i+1,positions);}));
  console.log('\nPositions: ' + positions.size + '/' + MMSI_LIST.length + '\n');
  return positions;
}

async function writePositionsToFirestore(db, positions) {
  if(positions.size===0){console.log('Aucune position');return;}
  var batch=db.batch(),ref=db.collection('ship_positions');
  for(var[mmsi,pos]of positions){batch.set(ref.doc(mmsi),Object.assign({},pos,{updatedAt:admin.firestore.FieldValue.serverTimestamp()}));console.log('Save: '+pos.name+' ('+pos.lat.toFixed(4)+','+pos.lng.toFixed(4)+')');}
  batch.set(ref.doc('_last_update'),{timestamp:admin.firestore.FieldValue.serverTimestamp(),shipsTracked:positions.size,totalShipsMonitored:MMSI_LIST.length,source:'aisstream.io',runner:'github-actions'});
  await batch.commit();
  console.log(positions.size+' position(s) sauvegardee(s)');
}

async function main() {
  console.log('CruiseMAP Ship Tracker - '+new Date().toISOString()+'\n');
  if(!AISSTREAM_API_KEY){console.error('API key manquante');process.exit(1);}
  if(!process.env.FIREBASE_PROJECT_ID){console.error('Firebase vars manquantes');process.exit(1);}
  var db=initFirebase();console.log('Firebase OK\n');
  var positions=await connectAISstream();
  await writePositionsToFirestore(db,positions);
  console.log('\nTermine!');process.exit(0);
}
main().catch(function(e){console.error('Fatal: '+e);process.exit(1);});
