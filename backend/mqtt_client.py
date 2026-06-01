import json
import logging
import asyncio
import paho.mqtt.client as mqtt
from database import DatabasePool

# Konfigurasi MQTT
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_KEEPALIVE = 60

logger = logging.getLogger(__name__)

# Simpan referensi ke main event loop dari FastAPI
main_loop = None

import uuid

# Initialize MQTT Client dengan ID unik agar tidak bentrok antara localhost dan server Render
client_id = f"venmachine_backend_{uuid.uuid4().hex[:8]}"
client = mqtt.Client(client_id=client_id, clean_session=True)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("✅ Berhasil terkoneksi ke MQTT Broker")
        client.subscribe("vending/+/restock")
# Initialize MQTT Client

        client.subscribe("vending/request_config")
    else:
        logger.error(f"❌ Gagal terkoneksi ke MQTT Broker, return code {rc}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        logger.warning("⚠️ Terputus dari MQTT Broker secara tidak terduga.")

client.on_connect = on_connect
client.on_disconnect = on_disconnect

async def _log_dispense(machine_id, item_id):
    """Fungsi internal untuk memotong stok saat menerima message dari ESP32"""
    pool = DatabasePool.get_pool()
    if not pool:
        logger.error("DB Pool belum inisiasi, gagal mencatat hardware dispense.")
        return
        
    async with pool.acquire() as connection:
        try:
            # Mencatat ke log dispense_logs
            await connection.execute(
                "INSERT INTO dispense_logs (item_id, requested_qty, source, status) VALUES ($1, $2, $3, $4)",
                item_id, 1, 'ESP32', 'SUCCESS'
            )
            # Opsional: Jika pengurangan stok belum dilakukan di payment, bisa dilakukan di sini.
            # Namun sesuai logika saat ini, saat payment = SUCCESS, web sudah memotong stok.
            # Jadi ESP32 message ini hanya sebagai alat crosscheck bahwa barang B-E-N-A-R keluar fisik.
            logger.info(f"✅ Hardware dispense tercatat untuk machine {machine_id}, item {item_id}")
        except Exception as e:
            logger.error(f"❌ Gagal mencatat hardware dispense: {e}")

async def _fetch_and_publish_config():
    """Mengambil index/lokasi aktif dari DB dan mempublishnya ke ESP32 secara global"""
    pool = DatabasePool.get_pool()
    if not pool:
        logger.error("DB Pool belum inisiasi, gagal fetch config.")
        return
        
    async with pool.acquire() as connection:
        try:
            # Ambil semua id barang (yang bertindak sebagai index fisik bagi ESP32) secara berurutan
            # Ambil semua location_id rak (yang bertindak sebagai index fisik bagi ESP32) secara berurutan
            rows = await connection.fetch("SELECT DISTINCT location_id FROM items WHERE (machine_stock > 0 OR warehouse_stock > 0) AND location_id IS NOT NULL ORDER BY location_id ASC")
            
            # Buat list active_indexes murni dari lokasi rak
            active_indexes = [row['location_id'] for row in rows]
            
            topic = "vending/config"
            payload = {
                "active_indexes": active_indexes
            }
            
            client.publish(topic, json.dumps(payload), qos=1)
            logger.info(f"📤 MQTT Config terkirim ke {topic}: {payload}")
        except Exception as e:
            logger.error(f"❌ Gagal mengambil/mengirim MQTT config: {e}")

async def publish_active_config_async():
    """Fungsi yang bisa dipanggil dari FastAPI route"""
    await _fetch_and_publish_config()

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload_str = msg.payload.decode('utf-8')
        logger.info(f"📥 Menerima pesan MQTT dari {topic}: {payload_str}")
        
        # Parse: vending/{machine_id}/restock
        parts = topic.split('/')
        if len(parts) == 3 and parts[2] == 'restock':
            machine_id = parts[1]
            data = json.loads(payload_str)
            item_id = data.get('item')
            if item_id is not None:
                # Gunakan run_coroutine_threadsafe karena dipanggil dari thread MQTT
                if main_loop:
                    asyncio.run_coroutine_threadsafe(_log_dispense(machine_id, item_id), main_loop)
                else:
                    logger.error("Main loop belum diinisialisasi")
        elif topic == 'vending/request_config':
            try:
                data = json.loads(payload_str)
                if data.get('msg') == 'REQUEST_DATA_BARANG':
                    logger.info(f"ESP32 meminta konfigurasi index terbaru...")
                    if main_loop:
                        asyncio.run_coroutine_threadsafe(_fetch_and_publish_config(), main_loop)
                    else:
                        logger.error("Main loop belum diinisialisasi")
            except json.JSONDecodeError:
                logger.warning("Pesan request_config bukan JSON yang valid.")
    except Exception as e:
        logger.error(f"❌ Error memproses pesan MQTT: {e}")

client.on_message = on_message

def start_mqtt(loop=None):
    """Memulai MQTT client loop di background"""
    global main_loop
    main_loop = loop or asyncio.get_running_loop()
    
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, MQTT_KEEPALIVE)
        client.loop_start()
    except Exception as e:
        logger.error(f"Gagal memulai MQTT: {e}")

def stop_mqtt():
    """Menghentikan MQTT client"""
    client.loop_stop()
    client.disconnect()

def publish_dispense(gate_id: int, items: list):
    """Publish perintah mengeluarkan barang ke ESP32"""
    # Build machine ID based on gate_id (misal: 1 -> VM001)
    machine_id = f"VM{str(gate_id).zfill(3)}"
    topic = f"vending/{machine_id}/cmd"
    
    payload = {
        "items": items
    }
    
    try:
        result = client.publish(topic, json.dumps(payload), qos=1)
        result.wait_for_publish()
        logger.info(f"📤 MQTT Dispense terkirim ke {topic}: {payload}")
    except Exception as e:
        logger.error(f"❌ Gagal mengirim MQTT Dispense: {e}")
