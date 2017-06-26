![Logo](admin/mihome-vacuum.png)
ioBroker mihome-vacuum adapter
=================
[![NPM version](http://img.shields.io/npm/v/iobroker.mihome-vacuum.svg)](https://www.npmjs.com/package/iobroker.mihome-vacuum)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mihome-vacuum.svg)](https://www.npmjs.com/package/iobroker.mihome-vacuum)
[![Tests](https://travis-ci.org/ioBroker/ioBroker.mihome-vacuum.svg?branch=master)](https://travis-ci.org/ioBroker/ioBroker.mihome-vacuum)

[![NPM](https://nodei.co/npm/iobroker.mihome-vacuum.png?downloads=true)](https://nodei.co/npm/iobroker.mihome-vacuum/)

This adapter allows you control the Xiaomi vacuum cleaner.

### Install

```
cd /opt/iobroker
npm install iobroker.mihome-vacuum
iobroker add mihome-vacuum
```

## Konfiguration
Derzeit stellt das Ermitteln des Tokens das größte Problem.
Folgende Vorgehensweisen können genutzt werden:

###  Bei Android
Vorbereitung:
Benötigt wird ein Android Smartphone mit fertig eingerichteter MiHome App. Der Sauger muss in dieser hinzugefügt und eingerichtet sein.

- Das [MiToolkit](https://github.com/ultrara1n/MiToolkit/releases) herunterladen, entpacken und die MiToolkit.exe starten.
- USB-Degugging in den Smartphone-Einstellungen einschalten ([video](https://www.youtube.com/watch?v=aw7D6bNgI1U))
- Das Smartphone über ein USB-Kabel mit dem PC verbinden.
- Im MiToolkit auf "Verbindung prüfen" klicken und ggf. die Java Installation testen, beide Tests sollten fehlerfrei verlaufen.
- Auf "Token auslesen" klicken und die Meldung auf dem Smartphone bestätigen (KEIN Passwort vergeben!).

Auf dem Smartphone sollte nun die MiHome App geöffnet werden (automatisch) und ein Backup auf den PC gezogen werden (sollte ein paar Sekunden dauern), das Programm liest dann den Token aus der MiHome Datenbank (miio2.db) aus.
Nun nur in dem geöffneten Fenster nach rockrobo.vaccuum suchen und den 32 Stelligen Token kopieren und in dem Konfigurationsfenster eingeben.


###  Bei iOS

Mit Jailbreak:
- Findet man den Token unter /var/mobile/Containers/Data/Application/514106F3-C854-45E9-A45C-119CB4FFC235/Documents/USERID_mihome.sqlite

Ohne Jailbreak:
- Muss man einen unverschlüsselten iTunes Backup machen mit z.B. ([Link](http://www.imactools.com/iphonebackupviewer/)).
- Und dann in den Dateien nach  DB unter RAW, com.xiaomi.home, USERID_mihome.sqlite suchen.


Auch hier wird nach dem 32 stelligen Token gesucht

## Widget
![Widget](widgets/mihome-vacuum/img/previewControl.png)

## Changelog
### 0.3.2 (2017-06-07)
* (MeisterTR) fix no communication after softwareupdate(Vers. 3.3.9)

### 0.3.1 (2017-04-10)
* (MeisterTR) fix setting the fan power
* (bluefox) catch error if port is occupied

### 0.3.0 (2017-04-08)
* (MeisterTR) add more states

### 0.0.2 (2017-04-02)
* (steinwedel) implement better decoding of packets

### 0.0.1 (2017-01-16)
* (bluefox) initial commit
