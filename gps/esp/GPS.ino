#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// --- Configuration ---
const char* ssid = "ahqaf 5g";
const char* password = "tars1234";

// If testing locally, use your Mac's local IP address (e.g., http://192.168.1.5:3000/api/gps)
// If hosted, use your domain (e.g., https://your-app.onrender.com/api/gps)
const char* serverUrl = "http://10.53.198.194:3000/api/gps";

const String vehicleID = "bus_01"; 
const int updateInterval = 10000; // Send location every 10 seconds

// --- Hardware Pins ---
// Neo-6M TX goes to ESP32 GPIO16
// Neo-6M RX goes to ESP32 GPIO17
#define RXD2 16
#define TXD2 17

HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
unsigned long lastLogTime = 0;

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, RXD2, TXD2);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while(WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to Network!");
}

void loop() {
  // Continuously feed data from the Neo-6M into the TinyGPS++ parser
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Push data when the interval has passed
  if (millis() - lastLogTime > updateInterval) {
    
    // Only send data if the GPS has a valid satellite lock
    if (gps.location.isValid()) {
      if(WiFi.status() == WL_CONNECTED){
        HTTPClient http;
        http.begin(serverUrl);
        http.addHeader("Content-Type", "application/json");

        // Construct the JSON payload
        JsonDocument doc; 
        doc["vehicle_id"] = vehicleID; 
        doc["latitude"] = gps.location.lat();
        doc["longitude"] = gps.location.lng();
        doc["speed_kmh"] = gps.speed.kmph();
        doc["satellites"] = gps.satellites.value();
        
        String requestBody;
        serializeJson(doc, requestBody);

        // Send the POST request
        int httpResponseCode = http.POST(requestBody);
        
        Serial.print("Location Pushed. Server responded with: ");
        Serial.println(httpResponseCode);
        
        http.end();
      } else {
        Serial.println("WiFi disconnected. Unable to push data.");
      }
    } else {
      Serial.println("Acquiring satellite lock... (Make sure the GPS is near a window)");
    }
    lastLogTime = millis();
  }
}