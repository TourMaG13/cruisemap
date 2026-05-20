# CruiseMAP — Ship Tracker

Suivi automatique des positions de navires de croisière via [AISstream.io](https://aisstream.io) + GitHub Actions + Firestore.

## Fonctionnement

1. Un **cron GitHub Actions** se lance toutes les 6 heures
2. Le script se connecte au **WebSocket AISstream.io** pendant 2 minutes
3. Il collecte les positions AIS des navires suivis (filtrés par MMSI)
4. Il écrit les positions dans la collection Firestore `ship_positions`
5. La carte CruiseMAP lit ces positions et affiche les navires sur la carte

## Setup

### 1. Secrets GitHub

Dans le repo → Settings → Secrets and variables → Actions, ajouter :

| Secret | Valeur |
|--------|--------|
| `AISSTREAM_API_KEY` | Ta clé API AISstream.io |
| `FIREBASE_PROJECT_ID` | `cruisemap-c1d3a` |
| `FIREBASE_CLIENT_EMAIL` | Email du service account Firebase |
| `FIREBASE_PRIVATE_KEY` | Clé privée du service account (avec les `\n`) |

### 2. Service Account Firebase

Pour que le script puisse écrire dans Firestore depuis GitHub Actions :

1. Va dans la [console Firebase](https://console.firebase.google.com) → Paramètres du projet → Comptes de service
2. Clique "Générer une nouvelle clé privée"
3. Un fichier JSON est téléchargé. Il contient :
   - `client_email` → mettre dans le secret `FIREBASE_CLIENT_EMAIL`
   - `private_key` → mettre dans le secret `FIREBASE_PRIVATE_KEY`
   - `project_id` → mettre dans le secret `FIREBASE_PROJECT_ID`

### 3. Règles Firestore

Ajouter cette règle dans Firestore pour la collection `ship_positions` :

```
match /ship_positions/{docId} {
  allow read: if true;
  allow write: if true;  // Le service account Firebase Admin bypass les règles, mais on les ouvre pour la lecture front
}
```

### 4. Ajouter des navires à suivre

Éditer le fichier `scripts/track-ships.js` et ajouter des entrées dans `TRACKED_SHIPS` :

```javascript
const TRACKED_SHIPS = {
  '311000995': { name: 'Scenic Eclipse', cruiseLineId: '0FumIK6cdo1OslR4r395', imo: '9797371' },
  // Ajouter ici...
};
```

Le MMSI d'un navire se trouve sur [VesselFinder](https://www.vesselfinder.com) ou [MarineTraffic](https://www.marinetraffic.com).

### 5. Lancer manuellement

Dans GitHub → Actions → "Ship Tracker - AISstream" → Run workflow

## Structure Firestore

Collection `ship_positions`, un document par navire (ID = MMSI) :

```json
{
  "mmsi": "311000995",
  "name": "Scenic Eclipse",
  "lat": 48.1234,
  "lng": -4.5678,
  "speed": 12.5,
  "course": 270,
  "heading": 268,
  "navStatus": 0,
  "destination": "BORDEAUX",
  "eta": "5/18 08:30",
  "timestamp": "2026-05-20T12:00:00Z",
  "updatedAt": "2026-05-20T12:02:15Z",
  "cruiseLineId": "0FumIK6cdo1OslR4r395"
}
```

Document `_last_update` : metadata du dernier run.
