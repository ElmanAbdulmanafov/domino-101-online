# Render Deploy

Bu yol test ucundur. Render Free servis bos qalanda yata biler, ona gore ilk qosulma gecike biler. Production ucun sonra VPS daha duzgun secimdir.

## 1. GitHub repo hazirla

En rahat yol `domino-101` qovlugunu ayrica GitHub reposu kimi yuklemekdir.

```powershell
cd "C:\Users\elman\Documents\New project\domino-101"
git init
git add .
git commit -m "Initial Domino 101 online game"
```

Sonra GitHub-da yeni repo yarat ve push et.

## 2. Render-de Web Service yarat

- Render Dashboard > New > Web Service.
- GitHub reposunu sec.
- Runtime: Node.
- Build Command:

```text
npm install
```

- Start Command:

```text
npm start
```

- Instance Type: Free.

`render.yaml` fayli da hazirdir. Repo yalniz `domino-101` qovlugundan ibaretdirse Render Blueprint kimi de acmaq olar.

## 3. Deploy bitende URL gotur

Render sene bele bir URL verecek:

```text
https://domino-101-online.onrender.com
```

Health yoxlamasi:

```text
https://domino-101-online.onrender.com/health
```

`{"ok":true}` cavabi gelirse server hazirdir.

## 4. APK-de server sahesi

Telefon tetbiqinde `Server` sahesine Render domenini yaz:

```text
domino-101-online.onrender.com
```

Tam URL de olar:

```text
https://domino-101-online.onrender.com
```

Tetbiq bunu WebSocket ucun avtomatik `wss://` kimi istifade edecek.

## Qeyd

Render Free servisi bir muddet istifade olunmayanda yata biler. Ilk oyuncu girende serverin ayilmasi 30-60 saniye cekebilir.
