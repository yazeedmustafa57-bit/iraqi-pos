# FIB Webhook Backend Server

## WICHTIG
Dieser Server wird benötigt um Zahlungsbestätigungen von FIB zu empfangen.
Die lokale POS-App kann keine externen Webhooks empfangen.

## Architektur

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  FIB Server  │────▶│  Backend Server   │────▶│  POS App    │
│  (Payment    │     │  (Public URL)     │     │  (Local)    │
│  confirmed)  │     │  /fib-webhook     │     │             │
└──────────────┘     └──────────────────┘     └─────────────┘
```

## Anforderungen
- Öffentliche URL (z.B. https://api.deine-app.de)
- HTTPS-Zertifikat
- Node.js 18+ oder jede andere Server-Sprache
- Datenbank für Payment-Status

## Endpunkte

### POST /fib-webhook
Empfängt Zahlungsbestätigungen von FIB.

**Request (von FIB):**
```json
{
  "payment_id": "abc123",
  "order_id": "ORDER-456",
  "status": "paid",
  "amount": 15000,
  "currency": "IQD",
  "transaction_ref": "TX-789",
  "timestamp": "2026-07-23T15:30:00Z"
}
```

**Response:**
```json
{ "status": "ok" }
```

### GET /payment-status/:paymentId
Polling-Endpoint für die POS-App.

**Response:**
```json
{
  "payment_id": "abc123",
  "status": "paid",
  "amount": 15000,
  "paid_at": "2026-07-23T15:30:05Z"
}
```

## Sicherheit
- Webhook-Signatur von FIB verifizieren
- Nur gültige FIB-IPs akzeptieren
- Rate Limiting implementieren
- HTTPS erzwingen

## Implementierung
Wenn die offizielle FIB-Dokumentation vorliegt:
1. Exaktes Webhook-Format aus Dokumentation übernehmen
2. Signatur-Verifizierung implementieren
3. FIB-spezifische Authentifizierung einbauen
4. In Produktionsumgebung deployen
