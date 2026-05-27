const WebSocket = require('ws');
const admin = require('firebase-admin');
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY;
const LISTEN_DURATION_MS = 150000; // 2.5 minutes par vague pour tenir dans le timeout
const MAX_CONNECTIONS = 3;

const TRACKED_SHIPS = {
  // === SCENIC ===
  '311000995': { name: 'Scenic Eclipse', company: 'Scenic' },
  '311001061': { name: 'Scenic Eclipse II', company: 'Scenic' },
  // === CROISIEUROPE (confirmes) ===
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
  // === VIKING (12 confirmes) ===
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
  '269057695': { name: 'Viking Sigyn', company: 'Viking' },
  '269057766': { name: 'Viking Egdir', company: 'Viking' },
  // === VIKING (estimes - prefixe suisse 269057xxx) ===
  '269057391': { name: 'Viking Odin', company: 'Viking' },
  '269057392': { name: 'Viking Sigrun', company: 'Viking' },
  '269057393': { name: 'Viking Heimdal', company: 'Viking' },
  '269057395': { name: 'Viking Forseti', company: 'Viking' },
  '269057396': { name: 'Viking Vidar', company: 'Viking' },
  '269057397': { name: 'Viking Jarl', company: 'Viking' },
  '269057398': { name: 'Viking Hermod', company: 'Viking' },
  '269057399': { name: 'Viking Beyla', company: 'Viking' },
  '269057400': { name: 'Viking Hnoss', company: 'Viking' },
  '269057401': { name: 'Viking Kvasir', company: 'Viking' },
  '269057402': { name: 'Viking Mani', company: 'Viking' },
  '269057403': { name: 'Viking Hild', company: 'Viking' },
  '269057404': { name: 'Viking Radgrid', company: 'Viking' },
  '269057405': { name: 'Viking Dagur', company: 'Viking' },
  '269057406': { name: 'Viking Vilhjalm', company: 'Viking' },
  '269057409': { name: 'Viking Fulla', company: 'Viking' },
  '269057410': { name: 'Viking Alsvin', company: 'Viking' },
  '269057411': { name: 'Viking Skaga', company: 'Viking' },
  '269057412': { name: 'Viking Honir', company: 'Viking' },
  '269057413': { name: 'Viking Lif', company: 'Viking' },
  '269057414': { name: 'Viking Sol', company: 'Viking' },
  '269057415': { name: 'Viking Ra', company: 'Viking' },
  '269057416': { name: 'Viking Thoth', company: 'Viking' },
  '269057418': { name: 'Viking Sobek', company: 'Viking' },
  '269057419': { name: 'Viking Saigon', company: 'Viking' },
  '269057420': { name: 'MS Antares', company: 'Viking' },
  '269057421': { name: 'Viking Eldir', company: 'Viking' },
  '269057422': { name: 'Viking Eir', company: 'Viking' },
  '269057423': { name: 'Viking Osfrid', company: 'Viking' },
  '269057424': { name: 'Viking Annar', company: 'Viking' },
  '269057425': { name: 'Viking Ganges', company: 'Viking' },
  '269057426': { name: 'Viking Sekhmet', company: 'Viking' },
  '269057427': { name: 'Viking Torgil', company: 'Viking' },
  '269057428': { name: 'Viking Ve', company: 'Viking' },
  '269057429': { name: 'Viking Kara', company: 'Viking' },
  '269057430': { name: 'Viking Astrild', company: 'Viking' },
  '269057431': { name: 'Viking Brahmaputra', company: 'Viking' },
  '269057432': { name: 'Viking Atla', company: 'Viking' },
  '269057433': { name: 'Viking Hemming', company: 'Viking' },
  '269057434': { name: 'Viking Tonle', company: 'Viking' },
  '269057435': { name: 'Viking Ptah', company: 'Viking' },
  '269057436': { name: 'Viking Nerthus', company: 'Viking' },
  '269057437': { name: 'Viking Aton', company: 'Viking' },
  '269057438': { name: 'Viking Fjorgyn', company: 'Viking' },
  '269057439': { name: 'Viking Laga', company: 'Viking' },
  '269057440': { name: 'Viking Hervor', company: 'Viking' },
  '269057441': { name: 'Viking Helgrim', company: 'Viking' },
  '269057442': { name: 'Viking Gyda', company: 'Viking' },
  '269057443': { name: 'Viking Gefjon', company: 'Viking' },
  '269057444': { name: 'Viking Gersemi', company: 'Viking' },
  '269057445': { name: 'Viking Anubis', company: 'Viking' },
  '269057446': { name: 'Viking Rolf', company: 'Viking' },
  '269057447': { name: 'Viking Rinda', company: 'Viking' },
  '269057449': { name: 'Viking Magni', company: 'Viking' },
  '269057450': { name: 'Viking Gymir', company: 'Viking' },
  '269057451': { name: 'Viking Buri', company: 'Viking' },
  '269057452': { name: 'Viking Haki', company: 'Viking' },
  '269057453': { name: 'Viking Delling', company: 'Viking' },
  '269057454': { name: 'Viking Skadi', company: 'Viking' },
  '269057455': { name: 'Viking Rota', company: 'Viking' },
  '269057456': { name: 'Viking Kadlin', company: 'Viking' },
  '269057457': { name: 'Viking Gullveig', company: 'Viking' },
  '269057458': { name: 'Viking Bragi', company: 'Viking' },
  '269057459': { name: 'Viking Vili', company: 'Viking' },
  '269057460': { name: 'Viking Lofn', company: 'Viking' },
  '269057461': { name: 'Viking Osiris', company: 'Viking' },
  '269057462': { name: 'Viking Halogi', company: 'Viking' },
  '269057463': { name: 'Viking Ullur', company: 'Viking' },
  '269057464': { name: 'Viking Eistla', company: 'Viking' },
  '269057466': { name: 'Viking Fjolvar', company: 'Viking' },
  '269057467': { name: 'Viking Vali', company: 'Viking' },
  '269057468': { name: 'Viking Hathor', company: 'Viking' },
  '269057470': { name: 'Viking Herja', company: 'Viking' },
  '269057471': { name: 'Viking Geb', company: 'Viking' },
  '269057472': { name: 'Viking Egil', company: 'Viking' },
  '269057473': { name: 'Viking Mississippi', company: 'Viking' },
  '269057474': { name: 'Viking Alruna', company: 'Viking' },
  '269057475': { name: 'Viking Amun', company: 'Viking' },
  '269057476': { name: 'Viking Tir', company: 'Viking' },
  '269057477': { name: 'Viking Ran', company: 'Viking' },
  '269057479': { name: 'Viking Kari', company: 'Viking' },
  '269057480': { name: 'Viking Idun', company: 'Viking' },
  '269057482': { name: 'Viking Einar', company: 'Viking' },
  '269057483': { name: 'Viking Sjofn', company: 'Viking' },
  '269057484': { name: 'Viking Bestla', company: 'Viking' },
  '269057485': { name: 'Viking Mimir', company: 'Viking' },
  '269057486': { name: 'Viking Tor', company: 'Viking' },
  // === EMERALD (Star confirme) ===
  '229818000': { name: 'Emerald Star', company: 'Emerald' },
  // === NICKO (confirme) ===
  '269057649': { name: 'nickoVISION', company: 'nicko cruises' },
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
        var aisName = (meta.ShipName||'').trim().toUpperCase();
        var expectedName = si.name.toUpperCase().replace(/^MS\s+/,'').replace(/^SS\s+/,'');
        // Verification: si le nom AIS ne contient aucun mot du nom attendu, c'est un faux positif
        var expectedWords = expectedName.split(/[\s-]+/).filter(function(w){return w.length>2;});
        var nameMatch = expectedWords.some(function(w){return aisName.indexOf(w)>=0;});
        if(!nameMatch && aisName.length > 0) {
          console.log('!! SKIP '+aisName+' (attendu: '+si.name+', MMSI '+mmsi+')');
          return;
        }
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
  if (batchSize > 50) batchSize = 50; // AISstream max 50 par connexion
  var batches = chunk(MMSI_LIST, batchSize);
  console.log(MMSI_LIST.length + ' navires en ' + batches.length + ' connexions (max '+batchSize+' par batch)\n');
  // Si plus de 3 batches, lancer par vagues de 3
  for (var wave = 0; wave < batches.length; wave += MAX_CONNECTIONS) {
    var waveBatches = batches.slice(wave, wave + MAX_CONNECTIONS);
    console.log('Vague ' + (Math.floor(wave/MAX_CONNECTIONS)+1) + ': ' + waveBatches.length + ' connexions');
    await Promise.all(waveBatches.map(function(b, i) { return connectBatch(b, wave + i + 1, positions); }));
  }
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
