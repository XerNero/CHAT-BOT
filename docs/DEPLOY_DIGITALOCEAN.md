# Panduan Deploy ke DigitalOcean
## Step-by-Step Deployment Guide

---

## 1. Buat Droplet di DigitalOcean

### 1.1 Spesifikasi Droplet

| Opsi | Pilihan |
|------|---------|
| **Image** | Ubuntu 22.04 LTS |
| **Plan** | Basic - Regular (SSD) |
| **RAM** | Minimal 8GB ($48/bulan) |
| **Region** | Singapore (SGP1) - terdekat |
| **Authentication** | SSH Key (rekomendasi) |

### 1.2 Langkah di Dashboard DO

1. Login ke [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Klik **Create** → **Droplets**
3. Pilih Ubuntu 22.04
4. Pilih plan **8GB RAM / 4 vCPU** ($48/mo)
5. Pilih region **Singapore**
6. Tambahkan SSH Key
7. Klik **Create Droplet**
8. Catat IP address droplet

---

## 2. Setup Server (SSH ke Droplet)

### 2.1 Connect via SSH

```bash
ssh root@YOUR_DROPLET_IP
```

### 2.2 Update System

```bash
apt update && apt upgrade -y
```

### 2.3 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify
docker --version
docker-compose --version
```

### 2.4 Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install nodejs -y
node --version
```

### 2.5 Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Download models
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

---

## 3. Deploy Aplikasi

### 3.1 Clone Repository

```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/chatbot-rag.git
cd chatbot-rag
```

### 3.2 Jalankan Qdrant

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -v /opt/qdrant_data:/qdrant/storage \
  --restart always \
  qdrant/qdrant
```

### 3.3 Setup Backend

```bash
cd /opt/chatbot-rag/apps/api
npm install

# Jalankan dengan PM2 (process manager)
npm install -g pm2
pm2 start server.mjs --name "chatbot-api"
pm2 save
pm2 startup
```

### 3.4 Setup Frontend

```bash
cd /opt/chatbot-rag/apps/web
npm install
npm run build

# Jalankan dengan PM2
pm2 start npm --name "chatbot-web" -- start
pm2 save
```

---

## 4. Setup Domain & SSL

### 4.1 Install Nginx

```bash
apt install nginx -y
```

### 4.2 Konfigurasi Nginx

```bash
nano /etc/nginx/sites-available/chatbot
```

Isi file:

```nginx
server {
    listen 80;
    server_name chatbot.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Aktifkan:

```bash
ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 4.3 Setup SSL (HTTPS)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d chatbot.yourdomain.com
```

---

## 5. Ingest PDF ke Production

```bash
cd /opt/chatbot-rag/apps/api

# Upload PDF ke folder pdfs/
# Jalankan ingestion
node ingest_all.mjs
```

---

## 6. Monitoring & Maintenance

### Cek Status Services

```bash
pm2 status
docker ps
systemctl status nginx
```

### Cek Logs

```bash
pm2 logs chatbot-api
pm2 logs chatbot-web
```

### Restart Services

```bash
pm2 restart all
docker restart qdrant
```

### Backup Qdrant Data

```bash
tar -czvf qdrant_backup.tar.gz /opt/qdrant_data
```

---

## 7. Firewall Setup

```bash
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw enable
```

---

## 8. Checklist Deploy

| Step | Status |
|------|--------|
| ☐ Buat Droplet 8GB RAM | |
| ☐ Install Docker | |
| ☐ Install Node.js 18 | |
| ☐ Install Ollama + Models | |
| ☐ Clone repo | |
| ☐ Jalankan Qdrant | |
| ☐ Setup Backend (PM2) | |
| ☐ Setup Frontend (PM2) | |
| ☐ Ingest PDF | |
| ☐ Setup Nginx | |
| ☐ Setup SSL | |
| ☐ Setup Firewall | |
| ☐ Test chatbot | |

---

## 9. Estimasi Biaya

| Item | Biaya/bulan |
|------|-------------|
| Droplet 8GB | $48 |
| Domain .com | ~$12/tahun |
| **Total** | ~$49/bulan |

---

## 10. Troubleshooting

### Ollama tidak jalan

```bash
systemctl status ollama
systemctl restart ollama
```

### Port sudah dipakai

```bash
lsof -i :3000
kill -9 <PID>
```

### Qdrant error

```bash
docker logs qdrant
docker restart qdrant
```

---

*Dokumen ini dibuat untuk panduan deployment ke DigitalOcean*  
*Terakhir diperbarui: 4 Januari 2026*
