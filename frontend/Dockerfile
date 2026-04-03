# Gunakan image Node.js yang ringan
FROM node:24-alpine

# Set folder kerja di dalam container
WORKDIR /app

# Copy file package.json dan install dependency
COPY package*.json ./
RUN npm install

# Copy seluruh sisa kode frontend
COPY . .

# Ekspos port 5173 (Port bawaan Vite)
EXPOSE 5173

# Jalankan server development Vite dengan flag --host agar bisa diakses dari luar container
CMD ["npm", "run", "dev", "--", "--host"]