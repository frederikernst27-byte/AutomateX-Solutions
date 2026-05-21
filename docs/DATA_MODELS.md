# Automate X Datenmodelle

Stand: 2026-04-27

## Termin / Stop

```json
{
  "id": "stop_123",
  "customerId": "customer_123",
  "name": "Kunde Stahlbau Rhein",
  "address": "Essen",
  "lat": 51.4556,
  "lng": 7.0116,
  "windowStart": "09:00",
  "windowEnd": "11:30",
  "serviceMinutes": 25,
  "priority": 3,
  "status": "active",
  "source": "manual",
  "createdAt": "2026-04-27T08:00:00.000Z",
  "updatedAt": "2026-04-27T08:00:00.000Z"
}
```

Statuswerte:
- `active`: offen und planbar
- `done`: erledigt
- `cancelled`: abgesagt
- `delayed`: verspätet, aber weiterhin geplant
- `rescheduled`: verschoben und durch neuen Termin ersetzt
- `return`: Rückfahrt zum Depot

Priorität:
- `1`: niedrig
- `2`: normal
- `3`: hoch

## Kunde

```json
{
  "id": "customer_123",
  "name": "Stahlbau Rhein GmbH",
  "contacts": [
    {
      "type": "email",
      "value": "service@stahlbau-rhein.example"
    },
    {
      "type": "phone",
      "value": "+49..."
    }
  ],
  "defaultAddress": "Essen",
  "notes": "Tor 3 benutzen",
  "privacyLevel": "personal-data"
}
```

## Fahrer

```json
{
  "id": "driver_123",
  "name": "Max Fahrer",
  "depotId": "depot_duisburg",
  "shiftStart": "08:00",
  "shiftEnd": "17:00",
  "skills": ["wartung", "installation"],
  "vehicle": {
    "type": "van",
    "profile": "driving"
  },
  "status": "available"
}
```

## Route

```json
{
  "id": "route_2026_04_27_driver_123",
  "date": "2026-04-27",
  "driverId": "driver_123",
  "depot": {
    "address": "Automate X HQ, Duisburg",
    "lat": 51.4344,
    "lng": 6.7623
  },
  "stops": ["stop_1", "stop_2"],
  "metrics": {
    "distanceKm": 120.4,
    "driveMinutes": 183,
    "waitingMinutes": 12,
    "lateStops": 1,
    "replans": 3
  },
  "status": "in_progress"
}
```

## Kommunikationsevent

```json
{
  "id": "event_123",
  "source": "gmail",
  "direction": "inbound",
  "receivedAt": "2026-04-27T10:15:00.000Z",
  "subject": "Terminabsage heute",
  "from": "kunde@example.com",
  "matchedStopId": "stop_123",
  "classification": "cancellation",
  "confidence": 0.82,
  "rawSnippet": "Leider müssen wir den Termin absagen...",
  "actionApplied": "cancel_stop"
}
```

## KI-Aktionsschema

```json
{
  "summary": "Absage erkannt und Route neu geplant.",
  "actions": [
    {
      "type": "cancel_stop",
      "target": "stop_123",
      "reason": "Gmail enthält Terminabsage"
    },
    {
      "type": "replan"
    }
  ]
}
```

Erlaubte Actions:
- `add_stop`
- `cancel_stop`
- `restore_stop`
- `set_priority`
- `set_parameter`
- `start_drive`
- `pause_drive`
- `reset_drive`
- `replan`

## CSV-Importformat

```csv
name,address,windowStart,windowEnd,service,priority
Kunde Stahlbau Rhein,Essen,09:00,11:30,25,3
Wartung Praxis Nord,Oberhausen,10:00,13:00,20,2
Installation Lager West,Krefeld,12:00,16:00,35,2
```

