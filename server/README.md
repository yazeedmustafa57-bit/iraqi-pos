# FIB Webhook Backend Server

## WICHTIG
Dieser Server wird benötigt um:
1. Zahlungsbestätigungen von FIB zu empfangen (Webhooks)
2. API Keys sicher zu speichern (nicht in der App)
3. FIB-API-Aufrufe durchzuführen (Schlüssel bleiben serverseitig)

Die lokale POS-App kann keine externen Webhooks empfangen.

## Architektur

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  FIB Server  │────▶│  Backend Server   │────▶│  POS App    │
│  (Payment    │     │  (Public URL)     │     │  (Local)    │
│  confirmed)  │     │  /fib-webhook     │     │             │
└──────────────┘     └──────────────────┘     └─────────────┘
                            │
                     ┌──────┴──────┐
                     │  Datenbank  │
                     │  (Shop +    │
                     │  Credentials│
                     │  + Status)  │
                     └─────────────┘
```

## Endpunkte

### POST /api/fib/register
Registriert einen Shop mit seinen FIB-Zugangsdaten.

**Request:**
```json
{
  "shop_id": "SHOP-ABC123",
  "merchant_id": "MERCHANT-12345",
  "api_key": "...",
  "secret_key": "...",
  "base_url": "https://api.fib.iq",
  "sandbox_mode": true
}
```

**Response:**
```json
{
  "success": true,
  "token": "backend-jwt-token...",
  "expiresAt": "2026-08-23T00:00:00Z"
}
```

### POST /api/fib/test-connection
Testet die FIB-Verbindung für einen Shop.

**Request:** (mit Backend-Token)
**Response:**
```json
{
  "success": true,
  "merchant_name": "Mein Laden",
  "account_status": "active"
}
```

### POST /api/fib/create-payment
Erstellt eine Zahlungsanfrage über FIB.

**Request:**
```json
{
  "amount": 15000,
  "currency": "IQD",
  "order_id": "SHOP-ABC123-1690000000-abc",
  "description": "Bestellung #123",
  "webhook_url": "https://dein-backend.de/fib-webhook/shop/SHOP-ABC123"
}
```

**Response:**
```json
{
  "payment_id": "FIB-PAY-789",
  "status": "pending"
}
```

### GET /api/fib/payment-status/:paymentId
Prüft den Zahlungsstatus für ein Shop.

**Response:**
```json
{
  "payment_id": "FIB-PAY-789",
  "status": "paid",
  "amount": 15000,
  "paid_at": "2026-07-23T15:30:05Z"
}
```

### POST /fib-webhook/shop/:shopId
Empfängt Zahlungsbestätigungen von FIB.

**URL:** /fib-webhook/shop/{shopId}
**Shop-ID wird aus URL gelesen!**

**Request (von FIB):**
```json
{
  "payment_id": "FIB-PAY-789",
  "order_id": "SHOP-ABC123-1690000000-abc",
  "status": "paid",
  "amount": 15000,
  "currency": "IQD",
  "transaction_ref": "FIB-TX-456",
  "signature": "hmac-sha256-of-payload"
}
```

**Response:**
```json
{ "status": "ok" }
```

## Sicherheit
- API Keys werden serverseitig verschlüsselt gespeichert
- Webhook-Signatur von FIB wird verifiziert
- Nur gültige FIB-IPs akzeptieren (whitelist)
- Rate Limiting implementieren
- HTTPS erzwingen
- JWT-Tokens für App-Backend-Kommunikation

## Order-ID Format
Jede Bestellung hat eine eindeutige ID:
`{shopId}-{timestamp}-{random}`
Beispiel: `SHOP-ABC123-1690000000-abc`

So kann der Backend-Server:
- Shop-ID aus der URL lesen
- Order-ID aus dem Payload lesen
- Zahlung dem richtigen Shop + Bestellung zuordnen

## Implementierung
Wenn die offizielle FIB-Dokumentation vorliegt:
1. Exaktes Webhook-Format aus Dokumentation übernehmen
2. Signatur-Verifizierung implementieren
3. FIB-spezifische Authentifizierung einbauen
4. Backend in Produktionsumgebung deployen
5. Shop-Registration implementieren
6. POS-App mit Backend verbinden
