# Data Safety Form - Google Play Store

## Does your app collect or share any user data? 
**No** - Our app does NOT collect, store, or share any user data with third parties.

## Data types collected:

### Account Info
- **What:** Shop name, owner name, phone number, PIN
- **Purpose:** App functionality (login/registration)
- **How:** Stored locally on device only
- **Sharing:** Not shared with anyone
- **Encryption:** In transit - No, At rest - Yes (PIN encrypted)

### Device Identifiers
- **What:** Device type, Android version
- **Purpose:** App functionality
- **How:** Used for Bluetooth printer connection
- **Sharing:** Not shared
- **Encryption:** No

### App Activity
- **What:** Sales transactions, product data
- **Purpose:** App functionality
- **How:** Stored locally in SQLite database
- **Sharing:** Not shared
- **Encryption:** No

### Photos/Media
- **What:** Camera access
- **Purpose:** Barcode scanning
- **How:** Processed on device only
- **Sharing:** Not shared
- **Encryption:** No

## Data safety practices:

✅ Data is encrypted in transit  
✅ Data can be deleted by user (uninstall app)  
✅ Data is not shared with third parties  
✅ Data is collected anonymously  
✅ No data collection for advertising  

## Security practices:

✅ Data is encrypted  
✅ User can request data deletion  
✅ Independent security review: Not required (no data collection)  

## Data types NOT collected:

❌ Financial info (beyond app functionality)  
❌ Health info  
❌ Location  
❌ Contacts  
❌ Messages  
❌ Call logs  
❌ Photos (beyond barcode scanning)  
❌ Microphone  
❌ Calendar  
❌ Files  
❌ Fitness  
❌ App info  
❌ Browser history  
❌ Contacts  
❌ Device IDs  
❌ Diagnostics  

---

**Summary for Play Store:**

Our app (Kashir POS) is a offline-first point of sale system. All data including shop information, product catalog, and sales transactions are stored locally on the user's device using SQLite database. No data is transmitted to external servers. The only network activity is for electronic payment synchronization (ZainCash, FastPay, etc.) which is handled through their respective APIs and not through our servers.

The app requires camera permission for barcode scanning and Bluetooth permission for thermal receipt printer connection. These permissions are used solely for the app's core functionality and no data from these sensors is stored or shared.
