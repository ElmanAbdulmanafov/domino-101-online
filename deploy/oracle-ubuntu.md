# Oracle Cloud Always Free Deploy

Bu telimat Ubuntu VM ucundur. Server internetden acilacaq, APK-de `Server` sahesine Oracle public IP yazilacaq.

## 1. Oracle-da VM yarat

- Oracle Cloud Console > Compute > Instances > Create instance.
- Image: Ubuntu 22.04 ve ya Ubuntu 24.04.
- Shape: Always Free uygun VM.
- SSH key: `.pub` public key elave et.
- Public IPv4 aktiv olsun.

## 2. Oracle firewall qaydasi

Virtual Cloud Network > Security Lists > Ingress Rules bolmesinde TCP `4173` portunu ac:

```text
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 4173
```

## 3. Servere SSH ile gir

```bash
ssh ubuntu@ORACLE_PUBLIC_IP
```

## 4. Node.js qur

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg unzip
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
```

## 5. Layiheni servere kocur

Kompüterində `domino-101` qovlugunu zip et ve servere gonder:

```powershell
Compress-Archive -Path "C:\Users\elman\Documents\New project\domino-101\*" -DestinationPath "$env:TEMP\domino-101.zip" -Force
scp "$env:TEMP\domino-101.zip" ubuntu@ORACLE_PUBLIC_IP:/tmp/domino-101.zip
```

Serverde:

```bash
sudo mkdir -p /opt/domino-101
sudo unzip -o /tmp/domino-101.zip -d /opt/domino-101
sudo chown -R ubuntu:ubuntu /opt/domino-101
```

## 6. Linux firewall ac

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 4173 -j ACCEPT
sudo netfilter-persistent save || true
```

## 7. Servisi aktiv et

```bash
sudo cp /opt/domino-101/deploy/domino-101.service /etc/systemd/system/domino-101.service
sudo systemctl daemon-reload
sudo systemctl enable domino-101
sudo systemctl start domino-101
sudo systemctl status domino-101
```

## 8. Yoxla

Brauzerde ac:

```text
http://ORACLE_PUBLIC_IP:4173/health
```

Telefon APK-de `Server` sahesine yaz:

```text
ORACLE_PUBLIC_IP:4173
```

Meselen:

```text
129.146.12.34:4173
```

## Loglara baxmaq

```bash
sudo journalctl -u domino-101 -f
```
