# Domino 101 Online

Mobil ekran üçün hazırlanmış real-time Domino 101 prototipi.

## İşə salmaq

```powershell
cd "C:\Users\elman\Documents\New project\domino-101"
node server.mjs
```

Sonra brauzerdə aç:

```text
http://localhost:4173
```

İki fərqli brauzer pəncərəsi və ya telefonla eyni Wi-Fi üzərindən server IP ünvanına qoşulub otaq kodu ilə online test etmək olar.

## Hazır funksiyalar

- Otaq yaratmaq və otaq kodu ilə qoşulmaq
- 2-4 oyunçu üçün real-time WebSocket oyun
- Domino daşlarının paylanması, növbə sistemi, sola/sağa daş qoyma
- Oynanacaq daş yoxdursa bazardan daş götürmə və ya pass
- Raund hesabı və 101 xala çatanda matç qalibi
- Mobilə uyğun oyun masası və əl daşları

## Google Play yolu

Bu MVP hazır web oyun kimi işləyir. Google Play üçün növbəti praktiki addım:

1. Capacitor və ya Android WebView wrapper əlavə etmək.
2. Serveri VPS/Fly.io/Render kimi daimi hostinqə yerləşdirmək.
3. WebSocket URL-ni production domeninə yönləndirmək.
4. Google Play üçün ikon, splash screen, privacy policy və test track hazırlamaq.

Oracle Cloud Always Free server qurmaq üçün ayrıca təlimat:

```text
deploy\oracle-ubuntu.md
```

Render Free ilə test deploy üçün:

```text
deploy\render.md
```

Firebase Firestore tarixçə üçün:

```text
deploy\firebase.md
```

## Qayda qeydi

Bu versiya Domino 101-in oynana bilən əsasını qurur. Yerli qayda fərqləri, məsələn cərimələr, qoşa daş açılışı, komanda oyunu və raund sonu xüsusi hesablamalar ayrıca sərtləşdirilə bilər.

## APK yığmaq

Əvvəlcə kompüterdə Android Studio quraşdırılmalıdır. Quraşdırma zamanı Android SDK, Android SDK Platform-Tools və Android SDK Build-Tools seçimləri aktiv olsun.

Sonra:

```powershell
cd "C:\Users\elman\Documents\New project\domino-101"
npm install
npm run android:add
npm run android:sync
npm run android:open
```

Android Studio açıldıqdan sonra:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

APK adətən bu qovluqda yaranır:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

Əgər terminaldan yığmaq istəyirsənsə, Android Studio qurulandan sonra `JAVA_HOME` adətən belə verilə bilər:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
cd "C:\Users\elman\Documents\New project\domino-101\android"
.\gradlew.bat assembleDebug
```

Telefon APK-dan oynayanda kompüterdə server yenə açıq olmalıdır:

```powershell
node server.mjs
```

Telefondakı tətbiqin `Server` sahəsinə kompüterin Wi-Fi IP ünvanını yaz:

```text
192.168.1.6:4173
```
