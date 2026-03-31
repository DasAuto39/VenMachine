# Gunakan image Python yang ringan
FROM python:3.10-slim

# Set folder kerja di dalam container
WORKDIR /app

# Copy file requirements dan install library
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh kode FastAPI Anda ke dalam container
COPY . .

# Perintah untuk menyalakan Uvicorn (Host 0.0.0.0 wajib agar bisa diakses dari luar container)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]