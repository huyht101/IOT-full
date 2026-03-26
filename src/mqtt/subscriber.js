const { initMqttClient } = require('../config/mqtt');
const ackService = require('../services/ack.service');
const telemetryService = require('../services/telemetry.service');

let started = false;

function safeParseJson(messageBuffer, topic) {
  try {
    return JSON.parse(messageBuffer.toString('utf8'));
  } catch (error) {
    console.warn(`Ignoring malformed JSON on topic ${topic}: ${error.message}`);
    return null;
  }
}

function subscribeToTopics(client) {
  const topics = [process.env.MQTT_TOPIC_TELEMETRY, process.env.MQTT_TOPIC_ACK];

  client.subscribe(topics, { qos: 0 }, (error) => {
    if (error) {
      console.error('MQTT subscribe failed:', error.message);
      return;
    }

    console.log(`MQTT subscribed: ${topics.join(', ')}`);
  });
}

function startMqttSubscriber() {
  if (started) {
    return initMqttClient();
  }

  started = true;
  const client = initMqttClient();

  client.on('connect', () => {
    subscribeToTopics(client);
  });

  client.on('message', async (topic, messageBuffer) => {
    const payload = safeParseJson(messageBuffer, topic);
    if (!payload) {
      return;
    }

    try {
      if (topic === process.env.MQTT_TOPIC_TELEMETRY) {
        await telemetryService.handleTelemetryPayload(payload);
        return;
      }

      if (topic === process.env.MQTT_TOPIC_ACK) {
        await ackService.handleAckPayload(payload);
      }
    } catch (error) {
      console.error(`MQTT message handling failed for topic ${topic}:`, error);
    }
  });

  return client;
}

module.exports = {
  startMqttSubscriber,
};
