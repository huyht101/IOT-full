const mqtt = require('mqtt');

let client;

function initMqttClient() {
  if (client) {
    return client;
  }

  client = mqtt.connect(process.env.MQTT_URL, {
    reconnectPeriod: 2000,
    connectTimeout: 5000,
  });

  client.on('connect', () => {
    console.log(`MQTT connected: ${process.env.MQTT_URL}`);
  });

  client.on('reconnect', () => {
    console.log('MQTT reconnecting...');
  });

  client.on('offline', () => {
    console.warn('MQTT client is offline');
  });

  client.on('error', (error) => {
    console.error('MQTT error:', error.message);
  });

  return client;
}

function getMqttClient() {
  if (!client) {
    throw new Error('MQTT client has not been initialized');
  }

  return client;
}

function publishJson(topic, payload) {
  return new Promise((resolve, reject) => {
    const mqttClient = getMqttClient();

    if (!mqttClient.connected) {
      reject(new Error('MQTT client is not connected'));
      return;
    }

    mqttClient.publish(topic, JSON.stringify(payload), { qos: 0 }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  initMqttClient,
  getMqttClient,
  publishJson,
};
