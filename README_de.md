![Logo](admin/mihome-vacuum.png)

# ioBroker mihome-vacuum Adapter

[![Paypal-Spende](https://img.shields.io/badge/paypal-donate%20%7C%20spenden-blue.svg)](https://www.paypal.com/paypalme/MeisterTR)

![Anzahl der Installationen](https://iobroker.live/badges/mihome-vacuum-installed.svg)
![Anzahl der stabilen Installationen](https://iobroker.live/badges/mihome-vacuum-stable.svg)
[![NPM-Version](https://img.shields.io/npm/v/iobroker.mihome-vacuum.svg)](https://www.npmjs.com/package/iobroker.mihome-vacuum)

![Test and Release](https://github.com/iobroker-community-adapters/ioBroker.mihome-vacuum/workflows/Test%20and%20Release/badge.svg)
[![Übersetzungsstatus](https://weblate.iobroker.net/widgets/adapters/-/mihome-vacuum/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mihome-vacuum.svg)](https://www.npmjs.com/package/iobroker.mihome-vacuum)

[English documentation](README.md)

Der mihome-vacuum Adapter verbindet ioBroker mit kompatiblen Saugrobotern aus dem Xiaomi-Ökosystem. Er unterstützt die lokale Steuerung über
IP-Adresse und Token, optional die Gerätesuche und Karten über die Xiaomi Cloud, Raumreinigung, Timer, Reinigungsverlauf, Verbrauchsmaterialien sowie
eigene Widgets für VIS 1 und VIS 2.

Zu den unterstützten Gerätefamilien gehören Roborock/rockrobo, Viomi und Dreame. Welche Befehle, Karten-, Raum-, Wisch-, Stations- und
Wartungsfunktionen verfügbar sind, hängt vom Modell und dessen Firmware ab.

## Unterstützte Geräte und Funktionen

Die folgenden Modelle sind ausdrücklich als unterstützt dokumentiert. Weitere Modelle derselben Gerätefamilien können mit dem passenden Manager
funktionieren, gelten bis zu einem erfolgreichen Test jedoch nicht als garantiert unterstützt. Der verfügbare Funktionsumfang kann außerdem von der
installierten Firmware abhängen.

| Gerät                   | Grundsteuerung | Reinigungsverlauf | Raumreinigung | Karte |
|:------------------------|:--------------:|:-----------------:|:-------------:|:-----:|
| `viomi.vacuum.v6`       |       ✅        |         —         |       —       |   —   |
| `viomi.vacuum.v7`       |       ✅        |         —         |       —       |   —   |
| `viomi.vacuum.v8`       |       ✅        |         —         |       —       |   —   |
| `viomi.vacuum.v19`      |       ✅        |         —         |       —       |   —   |
| `rockrobo.vacuum.v1`    |       ✅        |         ✅         |       —       |   ✅   |
| `roborock.vacuum.s4`    |       ✅        |         ✅         |       ✅       |   ✅   |
| `roborock.vacuum.s5`    |       ✅        |         ✅         |       ✅       |   ✅   |
| `roborock.vacuum.s5e`   |       ✅        |         ✅         |       ✅       |   ✅   |
| `roborock.vacuum.m1s`   |       ✅        |         ✅         |       ✅       |   ✅   |
| `roborock.vacuum.a10`   |       ✅        |         ✅         |       ✅       |   ✅   |
| `roborock.vacuum.a15`   |       ✅        |         ✅         |       ✅       |   ✅   |
| `dreame.vacuum.r2205`   |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.r2216o`  |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.r2228o`  |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2008`   |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2009`   |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2027`   |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2028`   |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2029`   |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2036`   |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2041o`  |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2114a`  |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2148o`  |       ✅        |         ✅         |       —       |   —   |
| `dreame.vacuum.p2156o`  |       ✅        |         ✅         |       —       |   —   |

`✅` bedeutet, dass die Funktion für das dokumentierte Modell unterstützt wird. `—` bedeutet, dass der Adapter diese Funktion für das Modell derzeit
nicht bereitstellt.

## Haftungsausschluss

Alle in diesem Projekt genannten Produkt- und Firmennamen, Logos und Marken gehören ihren jeweiligen Eigentümern. Xiaomi, Mi Home, Roborock, Viomi,
Dreame sowie die zugehörigen Namen, Logos und Marken sind Eigentum der jeweiligen Rechteinhaber. Ihre Verwendung dient ausschließlich der
Identifikation und bedeutet keine Verbindung, Förderung oder Empfehlung durch die genannten Unternehmen. Dies ist ein privates, nicht kommerzielles
Open-Source-Projekt, das zu Freizeitzwecken entwickelt wird.

## Sentry

**Dieser Adapter verwendet Sentry-Bibliotheken, um Ausnahmen und Programmfehler automatisch an die Entwickler zu melden.** Weitere Informationen und
eine Anleitung zum Abschalten der Fehlerberichte enthält die [Dokumentation des Sentry-Plugins](https://github.com/ioBroker/plugin-sentry).
Sentry-Berichte stehen ab js-controller 3.0 zur Verfügung.

## Voraussetzungen

- Node.js 22.13 oder neuer
- js-controller 7.2.2 oder neuer
- Admin 7.8.23 oder neuer
- ioBroker-Host und Roboter sollten über dasselbe lokale Netzwerk erreichbar sein
- Für die lokale UDP-Steuerung wird ein gültiger lokaler Geräte-Token benötigt

Die Xiaomi Cloud ist für die normale lokale Steuerung optional. Sie dient der komfortablen Gerätesuche und dem Abruf von Xiaomi-Cloud-Karten.

## Schnellstart

1. Adapter installieren und eine Instanz anlegen.
2. Die Instanzkonfiguration öffnen und den Tab **Verbindung** auswählen.
3. Die Xiaomi-Region auswählen, in der der Sauger registriert ist.
4. Auf **Xiaomi-Anmeldelink erstellen** klicken.
5. Den angezeigten Link öffnen und die Xiaomi-Anmeldung im Browser bestätigen.
6. Zu ioBroker zurückkehren, sobald der Cloud-Status **Angemeldet** anzeigt.
7. Auf **Geräte abrufen** klicken und den Saugroboter aus der Liste auswählen.
8. Die automatisch eingetragenen Werte für Token, IP-Adresse, Modell und Manager prüfen.
9. Die Konfiguration speichern und kontrollieren, ob `info.connection` den Wert `true` erhält.

![Verbindung und Xiaomi-Cloud-Anmeldung](admin/media/Login%20VacuumControl-redacted.png)

Die Anmeldung erfolgt über einen Xiaomi-Anmeldelink. Der Adapter erzeugt kein QR-Bild. Der Link läuft nach kurzer Zeit ab; bei `expired` oder `error`
muss ein neuer Link erstellt werden.

Das ausgewählte Gerät liefert normalerweise automatisch den lokalen Token, die IP-Adresse und das Modell. Der Token wird verschlüsselt in der
ioBroker-Instanzkonfiguration gespeichert und in der Oberfläche verdeckt dargestellt. Das Auge sollte nur verwendet werden, wenn der Token bewusst
angezeigt oder kopiert werden soll.

Geräte-Token, Xiaomi-Anmeldelinks, Cookies, Cloud-Sitzungen und ungekürzte Debug-Antworten dürfen niemals in Issues oder Forenbeiträgen veröffentlicht
werden.

## Lokale Einrichtung ohne Xiaomi Cloud

Die lokale Steuerung ist nicht von einer aktiven Xiaomi-Cloud-Sitzung abhängig. Wenn lokaler Token, IP-Adresse und Modell bereits bekannt sind, können
sie unter **Manuelle Einstellungen** eingetragen werden:

- **Token:** lokaler hexadezimaler Geräte-Token
- **IP-Adresse:** aktuelle lokale Adresse des Roboters
- **Modell:** Modellkennung wie `roborock.vacuum.s5`
- **Manager:** wird normalerweise automatisch erkannt; Roborock, Viomi oder Dreame nur bei Bedarf manuell auswählen
- **Port des Roboters:** normalerweise `54321`
- **Eigener Port:** lokaler UDP-Port dieser Adapterinstanz, normalerweise `53421`

Dem Roboter sollte im Router eine feste DHCP-Zuordnung gegeben werden, damit sich seine IP-Adresse nicht ändert.

### Token manuell ermitteln

Das manuelle Ermitteln des lokalen Geräte-Tokens kann bei einer Einrichtung ohne Xiaomi-Cloud-Gerätesuche der schwierigste Schritt sein. Die folgende
externe Anleitung beschreibt eine mögliche Vorgehensweise für verschiedene Xiaomi- und Roborock-Modelle:

[Anleitung zum Auslesen des Tokens](https://www.smarthomeassistent.de/token-auslesen-roborock-s6-roborock-s5-xiaomi-mi-robot-xiaowa/)

Die Anleitung stammt von einem Drittanbieter und funktioniert möglicherweise nicht mit jedem Modell, jeder Firmware oder jeder aktuellen Version der
Mi-Home-App. Der Token muss wie ein Passwort behandelt, sicher aufbewahrt und darf niemals in Logs, Screenshots, Issues oder Forenbeiträgen
veröffentlicht werden.

## Konfiguration

### Verbindung

Der Tab Verbindung enthält die Xiaomi-Cloud-Anmeldung, die Gerätesuche und die lokalen Einstellungen für die direkte Kommunikation mit dem Roboter.

- Eine erfolgreiche Cloud-Anmeldung wird als geschützte und verschlüsselte Sitzung gespeichert.
- **Geräte abrufen** wird erst nach erfolgreicher Anmeldung freigeschaltet.
- Die Auswahl eines erkannten Saugers ergänzt fehlende lokale Angaben und ersetzt bei Bedarf einen veralteten Token.
- Der Anmeldelink wird nach erfolgreicher Anmeldung oder nach Ablauf entfernt.
- Das Löschen eines gespeicherten Tokens wird beim Speichern der Konfiguration wirksam.

### Allgemeine Einstellungen

![Allgemeine Einstellungen](admin/media/Settings%20VacuumControl.png)

- **Status anfordern in Sekunden:** bestimmt, wie oft der aktuelle Roboterstatus abgefragt wird. Sehr kurze Intervalle belasten Netzwerk und Roboter.
- **WLAN-Status anfordern in Sekunden:** bestimmt, wie oft die Signalwerte aktualisiert werden.
- **Karte aus der Xiaomi Cloud aktivieren:** aktiviert den Xiaomi-Cloud-Kartenabruf und benötigt eine gültige Cloud-Sitzung.
- **Valetudo aktivieren:** verwendet eine kompatible lokale Valetudo-Kartenquelle.
- **Eigene Befehle senden:** erzeugt die Experten-Datenpunkte `control.X_send_command` und `control.X_get_response`.
- **Pause senden vor Zuhause:** sendet bei Modellen, die dies benötigen, zuerst Pause und danach den Befehl zur Ladestation.
- **Pausierte Zonenreinigung mit Start fortsetzen:** setzt eine unterbrochene Zonenreinigung fort, statt eine vollständige Reinigung zu starten.
- **Erweiterte Diagnoseprotokollierung:** ergänzt ausführliche, bereinigte Debug-Ausgaben. Diese Option nur vorübergehend zur Fehlersuche aktivieren.

### Karteneinstellungen

![Karteneinstellungen](admin/media/Karteeinstellung%20VacuumControl.png)

Die Kartenunterstützung hängt vom Modell und der gewählten Quelle ab.

- **Abrufintervall:** bestimmt, wie häufig die Kartenquelle abgefragt wird.
- **Intervall für die Kartenspeicherung:** bestimmt, wie häufig die erzeugte PNG-Datei gespeichert wird.
- **Neues Kartenformat mit Raumfarben:** aktiviert, soweit unterstützt, die Darstellung segmentierter Räume.
- **Boden-, Wand- und Pfadfarbe:** passt die erzeugte Karte an.
- **Robotersymbol:** wählt das Symbol für die aktuelle Roboterposition.

| Datenpunkt           | Beschreibung                                          |
|----------------------|-------------------------------------------------------|
| `cleanmap.map64`     | Karte als Base64-/Data-URL, empfohlen für VIS-Widgets |
| `cleanmap.mapURL`    | Pfad zur erzeugten PNG-Datei                          |
| `cleanmap.actualMap` | Kennung der aktiven Karte                             |
| `cleanmap.mapStatus` | Aktueller Status der Kartenverarbeitung               |
| `cleanmap.loadMap`   | Fordert eine Aktualisierung der Karte an              |

Xiaomi-Cloud-Karten benötigen sowohl **Karte aus der Xiaomi Cloud aktivieren** als auch eine gültige Cloud-Anmeldung. Lokale Roboterbefehle
funktionieren weiterhin, wenn die Cloud-Sitzung nicht verfügbar ist.

### Timer

![Timerkonfiguration](admin/media/Timer%20VacuumControl.png)

Adapter-Timer können ausgewählte Raumkanäle an bestimmten Wochentagen und Uhrzeiten starten.

1. Zuerst die Raumkanäle laden oder anlegen.
2. Den Tab **Timer** öffnen und auf **Hinzufügen** klicken.
3. Wochentag, Stunde, Minute, Räume und/oder Raumkanäle auswählen.
4. Timer aktivieren und **Timer speichern** anklicken.

Adapter-Timer werden in ioBroker gespeichert und können deshalb auch in VIS angezeigt oder gesteuert werden. Sie sind unabhängig von Timern in der
Xiaomi-App.

## Funktionen

### Grundlegende Steuerung

| Datenpunkt           | Funktion                                                |
|----------------------|---------------------------------------------------------|
| `control.start`      | Vollständige Reinigung starten                          |
| `control.pause`      | Aktuellen Auftrag pausieren                             |
| `control.home`       | Zur Ladestation zurückkehren                            |
| `control.find`       | Ortungston des Roboters abspielen                       |
| `control.spotclean`  | Punktreinigung starten                                  |
| `control.fan_power`  | Saugleistung lesen oder einstellen                      |
| `control.zoneClean`  | Eine oder mehrere Zonen anhand von Koordinaten reinigen |
| `control.goTo`       | Zu Kartenkoordinaten fahren                             |
| `control.clearQueue` | Wartende Reinigungsaufträge löschen                     |
| `control.clean_home` | `true` startet die Reinigung, `false` fährt zur Station |

Weitere Befehle für Wischen, Moppwäsche, Trocknung, Staubabsaugung, Teppichmodus und Dockfunktionen werden nur angelegt, wenn das gewählte Modell sie
unterstützt.

### Räume

Der Adapter erstellt unter `rooms` Kanäle, wenn der Roboter Raum- oder Segmentinformationen bereitstellt.

- Mit `rooms.loadRooms` werden die Räume erneut vom Roboter geladen.
- Ein Raumkanal enthält seinen Kartenindex oder Zonenkoordinaten und einen Startbefehl.
- Raumkanäle können ioBroker-Einträgen unter `enum.rooms` zugewiesen werden.
- Vor dem Start eines Raums kann dessen gewünschte Saugleistung gesetzt werden.
- `rooms.multiRoomClean` startet mehrere zugewiesene Räume gemeinsam.
- Mit `rooms.addRoom` kann anhand eines Kartenindexes oder von Zonenkoordinaten manuell ein Raum angelegt werden.

Raumnamen und verfügbare Funktionen stammen vom Roboter und können je nach Modell und Firmware abweichen.

### Reinigungsverlauf

Der Kanal `history` enthält Gesamtreinigungszeit, Gesamtfläche, Anzahl der Reinigungen sowie die letzten Reinigungsdatensätze im JSON- und
HTML-Format. Der Verlauf wird außerdem in beiden mitgelieferten Widgets angezeigt.

### Verbrauchsmaterialien und Wartung

Unterstützte Wartungswerte werden unter `consumable` angelegt, zum Beispiel Filter, Hauptbürste, Seitenbürste, Sensoren, Wasserfilter, Wischpad, Sieb,
Reinigungsbürste und Staubabsaugungszähler.

Eine Lebensdauer darf erst nach Reinigung oder Austausch des betreffenden Teils zurückgesetzt werden. Nicht unterstützte Verbrauchsmaterialien werden
in den Widgets ausgeblendet.

### Erweiterte eigene Befehle

Wenn **Eigene Befehle senden** aktiviert ist, können Befehle in `control.X_send_command` geschrieben werden. Antworten erscheinen in
`control.X_get_response`. Diese Funktion richtet sich an erfahrene Benutzer. Ungültige oder nicht zum Modell passende Befehle können zu unerwartetem
Roboterverhalten führen.

## Wichtige Datenpunkte

| Kanal               | Zweck                                                           |
|---------------------|-----------------------------------------------------------------|
| `info.connection`   | Status der lokalen Verbindung                                   |
| `info.state`        | Numerischer Roboterstatus mit lesbaren Statusbezeichnungen      |
| `info.error`        | Numerischer Fehlercode mit lesbaren Fehlerbezeichnungen         |
| `info.battery`      | Akkustand in Prozent                                            |
| `info.cleanedarea`  | Fläche der aktuellen oder letzten Reinigung                     |
| `info.cleanedtime`  | Reinigungsdauer                                                 |
| `info.wifi_signal`  | WLAN-Signalstärke des Roboters                                  |
| `deviceInfo.model`  | Erkanntes Modell                                                |
| `deviceInfo.fw_ver` | Firmwareversion                                                 |
| `auth.status`       | Status der Xiaomi-Cloud-Anmeldung                               |
| `auth.loginUrl`     | Temporärer Anmeldelink; wird nach Abschluss oder Ablauf geleert |
| `auth.lastError`    | Letzte bereinigte Fehlermeldung der Anmeldung                   |
| `auth.expiresAt`    | Ablaufzeitpunkt des Anmeldelinks                                |

`info.state` und `info.error` enthalten im ioBroker-Objekt lesbare Wertelisten. Unbekannte Codes bleiben sichtbar, damit der ursprüngliche Wert bei
einer Fehlermeldung nicht verloren geht.

## VIS-1- und VIS-2-Widgets

Beide mitgelieferten Widgets bieten ein responsives Dashboard mit Karte, Verbindungs- und Roboterstatus, Akku, Fläche, Dauer, Fehlerinformationen,
Auswahl der Saugleistung, Schnellsteuerung, bis zu sechs Räumen, Wartungsaktionen und einer eigenen Verlaufsansicht.

### VIS 1

Im Widget-Set **mihome-vacuum** das Widget **Vacuum dashboard with map, maintenance and history** auswählen. Danach die benötigten Datenpunkte in den
Widget-Eigenschaften zuweisen. Die Standardwerte zeigen auf `mihome-vacuum.0`; bei einer anderen Instanz müssen sie angepasst werden.

![VIS-1-Saugroboter-Widget](admin/media/Vis%201%20VacuumControlWidget.png)

### VIS 2

Im Widget-Set **Mi Home Vacuum** das Widget **Staubsaugersteuerung mit Karte** auswählen. Die Einstellungen sind in Allgemein, Zustände und Steuerung,
Wartung, Räume und Verlauf gegliedert.

![VIS-2-Saugroboter-Widget](admin/media/Vis%202%20VacuumControlWidget.png)

### Räume, Saugleistung und Darstellung

Jeder Raumeintrag kann einen eigenen Anzeigenamen, Start-Datenpunkt, Saugleistungs-Datenpunkt und eine eigene Saugstufe besitzen. Die Zahlenwerte der
Saugstufen sind konfigurierbar, weil Roborock-, Viomi- und Dreame-Modelle unterschiedliche Wertebereiche verwenden können.

Die Widgets erhalten das vollständige Seitenverhältnis der Karte und passen den Aufbau an die verfügbare Breite an. Ist ein Widget zu klein, wird der
Inhalt gescrollt, statt Karte, Steuerelemente oder Wartungskarten zu überlagern.

### Verlauf im Widget

Der Tab Verlauf zeigt die gesamte Anzahl der Reinigungen, Gesamtfläche, Gesamtzeit sowie die letzten Reinigungsergebnisse.

![Reinigungsverlauf in VIS 1 und VIS 2](admin/media/History%20vis%201%20und%202%20VacuumControlWidget.png)

## Fehlerbehebung

### Der Roboter verbindet sich nicht

- `info.connection`, IP-Adresse, Token und ausgewähltes Modell prüfen.
- Sicherstellen, dass Roboter und ioBroker-Host im lokalen Netzwerk miteinander kommunizieren können. Einige Modelle benötigen dasselbe Subnetz.
- Dem Roboter im DHCP-Server eine feste IP-Adresse reservieren.
- Den Roboter-Port bei `54321` belassen, sofern das Gerät nicht ausdrücklich einen anderen Port verwendet.
- Prüfen, ob eine andere Adapterinstanz denselben eigenen UDP-Port verwendet.

### Cloud-Anmeldung oder Gerätesuche schlägt fehl

- Dieselbe Xiaomi-Region auswählen, in der der Roboter registriert ist.
- Bei einem abgelaufenen Link einen neuen Anmeldelink erstellen.
- Die Anmeldung im Browser abschließen, bevor **Geräte abrufen** angeklickt wird.
- Eine Xiaomi-Antwort mit `401` oder `403` macht die gespeicherte Sitzung ungültig und erfordert eine neue ausdrückliche Anmeldung.

### Es wird keine Karte angezeigt

- Prüfen, ob das verbundene Modell den Kartenabruf unterstützt.
- Entweder Xiaomi-Cloud-Karten oder Valetudo aktivieren.
- Bei Xiaomi-Karten muss `auth.status` den Wert `authenticated` haben.
- `cleanmap.mapStatus`, `cleanmap.map64` und das Debug-Protokoll des Adapters prüfen.

### Die Installation scheitert beim Bau von canvas

Der Kartenrenderer verwendet das optionale native Paket `canvas`. Wenn unter Linux kein fertiges Binärpaket verfügbar ist, müssen vor einer erneuten
Installation die benötigten Systempakete installiert werden:

```sh
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

Keine alte `canvas`-Version 2.x manuell in das Adapterverzeichnis installieren.

### Mehrere Roboter

Für jeden Roboter wird eine eigene Adapterinstanz benötigt. Jede Instanz muss einen anderen **Eigenen Port** verwenden, zum Beispiel `53421`, `53422`
und so weiter.

## Unterstützung und Fehlermeldungen

Eine Fehlermeldung sollte Adapterversion, Node.js-Version, js-controller-Version, Modellkennung, relevante Logzeilen und die auslösende Aktion
enthalten. Token, Anmeldelinks, Cookies, Cloud-Sitzungen, IP-Adressen und andere private Daten müssen vor dem Veröffentlichen entfernt werden.

Für reproduzierbare Fehler und Funktionswünsche steht
der [GitHub Issue Tracker](https://github.com/iobroker-community-adapters/ioBroker.mihome-vacuum/issues) zur Verfügung.

## Lizenz

MIT-Lizenz

Copyright (c) 2023-2026 iobroker-community-adapters

Copyright (c) 2017-2023 bluefox

Der vollständige Lizenztext steht in [LICENSE](LICENSE).
