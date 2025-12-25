#!/bin/bash

# 1. Ayarlar
BACKUP_DIR="/root/yedekler"
DATE=$(date +%Y-%m-%d_%H-%M)
DB_USER="stokadmin"
DB_NAME="stoktakip"

# 2. Yedek Al
sudo -u postgres pg_dump $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# 3. Sıkıştır
gzip $BACKUP_DIR/db_$DATE.sql

# 4. Eskileri Sil (7 gün)
find $BACKUP_DIR -type f -name "*.gz" -mtime +7 -delete

# 5. Logla
echo "Yedek alındı: db_$DATE.sql.gz" >> $BACKUP_DIR/backup.log