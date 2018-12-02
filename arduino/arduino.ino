#include <ArduinoJson.h>
#include <TimeLib.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <DHT_U.h>

char ssid[] = "Moto G (5) Plus 9182";
char pass[] = "ManuelNucci";

char broker_ip[] = "mqtt.fi.mdp.edu.ar";
int port = 1883;

char id[] = "am2302";

char location[] = "exterior";

char ledTopic[40];
char temperatureTopic[40];

int pause = 1000;

WiFiClient wifiClient;
PubSubClient client;

#define DHTPIN D13 // Pin which is connected to the DHT sensor
#define DHTTYPE DHT22 // DHT 22 (AM2302)

DHT_Unified dht(DHTPIN, DHTTYPE);

void setup() {
    Serial.begin(9600);
    
    dht.begin();   // Initialize device
    Serial.println("Sensor initialized!");

    sprintf(ledTopic, "ingenieria/anexo/%s/led", location);
    Serial.println(ledTopic);
    sprintf(temperatureTopic, "ingenieria/anexo/%s/temperatura", location);
    Serial.println(temperatureTopic);

    client.setClient(wifiClient);
    client.setServer(broker_ip, port);
    client.setCallback(mqtt_logic);

    pinMode(LED_BUILTIN, OUTPUT);

    establish_connections(); // WiFi & MQTT Server
}

void loop()
{
    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("WiFi disconnected!");
      establish_connections();
    }
    client.loop();

    publish_temperature();
}

void mqtt_logic(const char topic[], byte* payload, unsigned int length)
{
    StaticJsonBuffer<JSON_OBJECT_SIZE(2)> jb;
    JsonObject& message = jb.parseObject((char*) payload);

    if (!strcmp(topic, ledTopic))
    {
        bool valor = message["valor"];
        if (valor)
        {
          Serial.print("Prender LED de ");
          Serial.println(location);
          digitalWrite(LED_BUILTIN, LOW);
        }
        else
        {
          Serial.print("Apagar LED de ");
          Serial.println(location);
          digitalWrite(LED_BUILTIN, HIGH);
        }  
    }
}

void establish_connections()
{
    WiFi.begin(ssid, pass);
    while (WiFi.status() != WL_CONNECTED) {
        Serial.println("Trying connecting to WiFi...");
        delay(pause);
    }
    Serial.println("Connected to WiFi!");

    while (!client.connect(id)) {
        Serial.println("Trying connecting to MQTT Server...");
        delay(pause);
    }
    Serial.println("Connected to MQTT Server!");
    
    while (!client.subscribe(ledTopic))
        delay(pause);
    Serial.println("Subscribed to LED topic!");
}

void publish_temperature() 
{
    StaticJsonBuffer<JSON_OBJECT_SIZE(2)> jb;
    JsonObject& payload = jb.createObject();

    sensors_event_t event;  
    dht.temperature().getEvent(&event);

    payload["valor"] = event.temperature;
    payload["timestamp"] = now();

    char JSONmessageBuffer[50];
    payload.printTo(JSONmessageBuffer, sizeof(JSONmessageBuffer));
 
    client.publish(temperatureTopic, JSONmessageBuffer, true);
    
    delay(pause);
}
