#include <Arduino.h>
#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ctype.h>

// ===================== PIN / DEVICE =================
static const uint8_t P_DHT = 18;   // DHT11 OUT
static const uint8_t P_AO  = 34;   // Light sensor AO (ADC1)

struct Device {
  const char* code;   // external code for MQTT / telemetry
  uint8_t pin;
  bool state;         // actual output state: 0 off, 1 on
};

static Device devs[] = {
  {"LED1", 21, false},
  {"LED2", 22, false},
  {"LED3", 23, false},
};

static const size_t N_DEV = sizeof(devs) / sizeof(devs[0]);

// ===================== CFG ==========================
#define DHT_TYPE DHT11
static const uint32_t TEL_MS = 2000;

// neu che cam bien ma AO tang -> dat = 1 de dao (ADC_MAX - raw)
#define AO_INV 1

// 1 = LED co dien tro (OUTPUT HIGH), 0 = khong dien tro (INPUT_PULLUP bat mo)
#define LED_RES 1

static const uint8_t  ADC_BITS = 12;
static const int      ADC_MAX  = (1 << ADC_BITS) - 1;

static const uint32_t WIFI_RETRY_MS = 5000;
static const uint32_t MQTT_RETRY_MS = 3000;
static const uint16_t MQTT_BUF = 512;

// ===================== WIFI / MQTT ==================
static const char* WIFI_SSID = "101";
static const char* WIFI_PASS = "12345687";

static const char* MQTT_HOST = "10.127.57.20";   // IP LAN cua laptop: ifconfig => Wireless LAN adapter Wi-Fi:  IPv4 Address
static const uint16_t MQTT_PORT = 1884;

static const char* MQTT_ID  = "esp32_demo_01";
static const char* TOP_TEL  = "iot/demo/esp32_01/telemetry";
static const char* TOP_CMD  = "iot/demo/esp32_01/cmd";
static const char* TOP_ACK  = "iot/demo/esp32_01/ack";

// ===================== GLOBAL =======================
DHT dht(P_DHT, DHT_TYPE);
WiFiClient net;
PubSubClient mqtt(net);

static uint32_t telAt = 0;
static uint32_t wifiTryAt = 0;
static uint32_t mqttTryAt = 0;
static bool wifiUp = false;
static bool mqttUp = false;

// ===================== UTIL =========================
static bool ieq(const char* a, const char* b) {
  if (!a || !b) return false;
  while (*a && *b) {
    if (tolower((unsigned char)*a) != tolower((unsigned char)*b)) return false;
    ++a;
    ++b;
  }
  return *a == '\0' && *b == '\0';
}

// ===================== DEVICE =======================
static inline void pinOff(uint8_t pin) {
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
}

static inline void pinOn(uint8_t pin) {
#if LED_RES
  pinMode(pin, OUTPUT);
  digitalWrite(pin, HIGH);
#else
  pinMode(pin, INPUT_PULLUP);
#endif
}

static void setDev(size_t idx, bool on) {
  devs[idx].state = on;
  if (on) pinOn(devs[idx].pin);
  else    pinOff(devs[idx].pin);
}

static int devIdx(const char* code) {
  for (size_t i = 0; i < N_DEV; ++i) {
    if (ieq(code, devs[i].code)) return (int)i;
  }
  return -1;
}

// ===================== SENSOR =======================
static int readLight() {
  int v = analogRead(P_AO);   // 0..ADC_MAX
#if AO_INV
  v = ADC_MAX - v;
#endif
  return v;
}

// ===================== MQTT HELPERS =================
static void sendAck(uint32_t actId, bool ok) {
  if (!mqtt.connected()) {
    Serial.println(F("[MQTT] skip ack: not connected"));
    return;
  }

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  DynamicJsonDocument doc(128);
#endif

  doc["action_id"] = actId;
  doc["success"] = ok;

  char out[96];
  size_t n = serializeJson(doc, out, sizeof(out));

  if (!mqtt.publish(TOP_ACK, (const uint8_t*)out, n)) {
    Serial.println(F("[MQTT] ack publish fail"));
  } else {
    Serial.print(F("[MQTT] ack: "));
    Serial.println(out);
  }
}

static void sendTel() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  int light = readLight();

  if (isnan(t)) Serial.println(F("[DHT] read temp fail -> send null"));
  if (isnan(h)) Serial.println(F("[DHT] read hum fail -> send null"));

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  DynamicJsonDocument doc(MQTT_BUF);
#endif

  doc["ts_ms"] = millis();
  if (isnan(t)) doc["temp"] = nullptr;
  else          doc["temp"] = t;

  if (isnan(h)) doc["hum"] = nullptr;
  else          doc["hum"] = h;
  doc["light"] = light;

  JsonArray arr = doc["devices"].to<JsonArray>();
  for (size_t i = 0; i < N_DEV; ++i) {
    JsonObject o = arr.add<JsonObject>();
    o["code"] = devs[i].code;
    o["state"] = devs[i].state ? 1 : 0;
  }

  size_t need = measureJson(doc);
  if (need >= MQTT_BUF) {
    Serial.print(F("[MQTT] telemetry too large, need="));
    Serial.println((unsigned long)need);
    return;
  }

  char out[MQTT_BUF];
  size_t n = serializeJson(doc, out, sizeof(out));

  Serial.println(out);

  if (mqtt.connected()) {
    if (!mqtt.publish(TOP_TEL, (const uint8_t*)out, n)) {
      Serial.println(F("[MQTT] telemetry publish fail"));
    }
  } else {
    Serial.println(F("[MQTT] skip telemetry: not connected"));
  }
}

static bool applyCmd(const char* code, const char* act) {
  int idx = devIdx(code);
  if (idx < 0) return false;

  if (ieq(act, "on"))  { setDev((size_t)idx, true);  return true; }
  if (ieq(act, "off")) { setDev((size_t)idx, false); return true; }

  return false;
}

static void mqttMsg(char* topic, byte* payload, unsigned int len) {
  if (strcmp(topic, TOP_CMD) != 0) return;

  Serial.print(F("[MQTT] cmd raw: "));
  for (unsigned int i = 0; i < len; ++i) Serial.write((char)payload[i]);
  Serial.println();

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  DynamicJsonDocument doc(256);
#endif

  DeserializationError err = deserializeJson(doc, payload, len);
  if (err) {
    Serial.print(F("[MQTT] bad json: "));
    Serial.println(err.c_str());
    return;
  }

  uint32_t actId = doc["action_id"] | 0;
  const char* code = doc["device_code"] | "";
  const char* act  = doc["action"] | "";

  if (!actId || !code[0] || !act[0]) {
    Serial.println(F("[MQTT] missing action_id/device_code/action"));
    if (actId) sendAck(actId, false);
    return;
  }

  // Firmware khong nhan ALL nua; backend se fan-out thanh nhieu lenh per-device
  if (ieq(code, "ALL")) {
    Serial.println(F("[MQTT] ALL is not supported in firmware"));
    sendAck(actId, false);
    return;
  }

  if (!applyCmd(code, act)) {
    Serial.println(F("[MQTT] invalid command"));
    sendAck(actId, false);
    return;
  }

  sendAck(actId, true);
}

// ===================== NET ==========================
static void wifiStart() {
  Serial.print(F("[WIFI] connect to "));
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

static void wifiTick(uint32_t now) {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiUp) {
      wifiUp = true;
      Serial.print(F("[WIFI] connected, ip="));
      Serial.println(WiFi.localIP());
    }
    return;
  }

  if (wifiUp) {
    wifiUp = false;
    wifiTryAt = 0;
    mqttTryAt = 0;
    Serial.println(F("[WIFI] disconnected"));
  }

  if (wifiTryAt && now - wifiTryAt < WIFI_RETRY_MS) return;
  wifiTryAt = now;
  wifiStart();
}

static void mqttTick(uint32_t now) {
  if (WiFi.status() != WL_CONNECTED) {
    if (mqttUp) {
      mqttUp = false;
      mqttTryAt = 0;
      Serial.println(F("[MQTT] down (wifi lost)"));
    }
    return;
  }

  if (mqtt.connected()) {
    if (!mqttUp) {
      mqttUp = true;
      Serial.println(F("[MQTT] connected"));
    }
    mqtt.loop();
    return;
  }

  if (mqttUp) {
    mqttUp = false;
    mqttTryAt = 0;
    Serial.println(F("[MQTT] disconnected"));
  }

  if (mqttTryAt && now - mqttTryAt < MQTT_RETRY_MS) return;
  mqttTryAt = now;

  Serial.print(F("[MQTT] connect "));
  Serial.print(MQTT_HOST);
  Serial.print(F(":"));
  Serial.println(MQTT_PORT);

  if (mqtt.connect(MQTT_ID)) {
    Serial.println(F("[MQTT] connect ok"));
    if (mqtt.subscribe(TOP_CMD)) {
      Serial.print(F("[MQTT] sub ok: "));
      Serial.println(TOP_CMD);
    } else {
      Serial.println(F("[MQTT] sub fail"));
    }
  } else {
    Serial.print(F("[MQTT] connect fail, rc="));
    Serial.println(mqtt.state());
  }
}

// ===================== SETUP / LOOP =================
void setup() {
  Serial.begin(115200);

  for (size_t i = 0; i < N_DEV; ++i) {
    setDev(i, false);
  }

  analogReadResolution(ADC_BITS);
  analogSetAttenuation(ADC_11db);

  dht.begin();

  WiFi.mode(WIFI_STA);
  wifiStart();
  wifiTryAt = millis();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttMsg);
  mqtt.setBufferSize(MQTT_BUF);

  Serial.println(F("ESP32 ready."));
}

void loop() {
  uint32_t now = millis();

  wifiTick(now);
  mqttTick(now);

  if (now - telAt >= TEL_MS) {
    telAt = now;
    sendTel();
  }
}