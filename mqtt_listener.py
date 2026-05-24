import paho.mqtt.client as mqtt
import json

# Konfigurasi Broker (Harus sama dengan backend)
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
TOPIC = "vending/+/cmd"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Berhasil terkoneksi ke {MQTT_BROKER}")
        print(f"📡 Menunggu perintah dari backend di topik: {TOPIC}...\n")
        client.subscribe(TOPIC)
    else:
        print(f"❌ Gagal terkoneksi, return code: {rc}")

def on_message(client, userdata, msg):
    print("=" * 40)
    print(f"📥 PESAN MASUK DARI TOPIC: {msg.topic}")
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        print("📦 ISI PESAN (Payload):")
        print(json.dumps(payload, indent=2))
        print("=" * 40 + "\n")
    except json.JSONDecodeError:
        print("📦 ISI PESAN (Raw Text):")
        print(msg.payload.decode('utf-8'))
        print("=" * 40 + "\n")

# Inisiasi Client
client = mqtt.Client(client_id="venmachine_test_listener", clean_session=True)
client.on_connect = on_connect
client.on_message = on_message

print("Memulai MQTT Listener...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)

# Looping selamanya untuk mendengarkan pesan
try:
    client.loop_forever()
except KeyboardInterrupt:
    print("\nMenghentikan listener...")
    client.disconnect()
