![Logo](admin/mihome-vacuum.png)
# ioBroker mihome-vacuum adapter

[![Paypal Donation](https://img.shields.io/badge/paypal-donate%20|%20spenden-blue.svg)](https://www.paypal.com/paypalme/MeisterTR)

![Number of Installations](http://iobroker.live/badges/mihome-vacuum-installed.svg)
![Number of Installations](http://iobroker.live/badges/mihome-vacuum-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.mihome-vacuum.svg)](https://www.npmjs.com/package/iobroker.mihome-vacuum)

![Test and Release](https://github.com/iobroker-community-adapters/iobroker.mihome-vacuum/workflows/Test%20and%20Release/badge.svg)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/mihome-vacuum/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mihome-vacuum.svg)](https://www.npmjs.com/package/iobroker.mihome-vacuum)

This adapter allows you to control the Xiaomi vacuum cleaner.

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## Inhalt
- [Einrichtung](#konfiguration)
    - [Adapter konfigurieren](#adapterkonfiguration)
        - [Steuerung über Alexa](#steuerung-über-alexa)
        - [Zweiter Roboter](#zweiter-roboter)
    - [Einrichtung Valetudo](#valetudo-einrichtung)
- [Funtionen](#funktionen)
    - [S50 Kommandos](#Komandos-des-S50)
	        - [GoTo](#GoTo)
			- [zoneClean](#zoneClean)
            - [Räume](#Räume)
            - [Timer](#Timer)
    - [Eigene Kommandos](#sende-eigene-kommandos)
    - [sendTo-Hook](#eigene-kommandos-per-sendto-schicken)
- [Widget](#widget)
- [Bugs](#bugs)
- [Changelog](#changelog)

## Konfiguration
Derzeit stellt das Ermitteln des Tokens das größte Problem.
Am besten folgt man der Anleitung des folgenden Links:

[Token Vorgehensweise](https://www.smarthomeassistent.de/token-auslesen-roborock-s6-roborock-s5-xiaomi-mi-robot-xiaowa/).

### Fehler bei der Installation
Wenn der Adapter nicht installiert werden kann, kann Canvas nicht installiert werden

``npm ERR! canvas@2.6.1 install: node-pre-gyp install --fallback-to-build
npm ERR! Exit status 1``

Dann müssen folgende Pakete und Bibliotheken selber installiert werden:

``
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
``

``
sudo npm install canvas --unsafe-perm=true
``


### Adapterkonfiguration
- Bei IP-Adresse muss die IP-Adresse des Roboters eingegeben werden im Format `192.168.178.XX`
- Port des Roboters ist Standardmäßig auf `54321` eingestellt, dies sollte nicht verändert werden
- Eigener Port, sollte nur bei zweiten Roboter geändert werden
- Abfrageintervall ist die Zeit in ms, in der die Statuswerte des Roboters abgerufen werden (sollte nicht <10000 sein)

#### Steuerung über Alexa
In der Konfiguration add Alexa state aktivieren, 
ist hier ein Hacken gesetzt wird ein zusätzlicher State erzeugt `clean_home` es ist ein 
Schalter der bei `true` den Sauger startet und bei `false` fährt er nach Hause, es wird automatisch ein Smart-Gerät im Cloud Adapter erzeugt mit dem Namen "Staubsauger", dieser kann im Cloud Adapter geändert werden.

#### Zonenreinigung nach pausierung fortsetzen
Wenn diese Option aktiviert ist, wird die Zonenreinigung durch Senden des `start` Kommandos automatisch fortgesetzt.
Wenn die Option deaktiviert ist, wird durch Senden von `start` eine neue Komplettreinigung gestartet, auch wenn der Sauger während einer Zonenreinigung pausiert wurde.

- Experimental: Über den Haken bei "Sende eigene Kommandos" werden Objekte angelegt, über die man eigene Kommandos an den Roboter senden und empfangen kann.

#### Zweiter Roboter
Sollen zwei Roboter über ioBroker gesteuert werden, müssen zwei Instanzen angelegt werden. Dafür muss für den zweiten Roboter der eigene Port von IO-Broker (Default: 53421) geändert werden, damit beide Roboter unterschiedliche Ports auf der IObroker Insztanz ansprechen.

## Valetudo Einrichten

Hierfür muss der Roboter ge"root"et und Valetudo installiert sein. dafür nutzt man am besten folgende Versionen:
[Valetudo RE](https://github.com/rand256/valetudo) oder das normale [Valetudo](https://github.com/Hypfer/Valetudo)

![Konfig](admin/valetudo_conf.png)
- Aktiviere Valetudo, aktiviert das Map-interface
- Abrufintervall muss mindestens 1000ms sein, damit wird das Abrufintervall der html Map angegeben
- Map Intervall ist das Intervall für das Map PNG File, welches für Telegramm oder vis genutzt werden kann, hier muss es mindestens 5000ms betragen
- Farben sind für die Karte folgende Typen können genutzt werden:
```
- #2211FF
- rbg(255,200,190)
- rgba(255,100,100,0.5) //for Transparent
- green
```
- Unter Roboter Bilder kann man verschiedene Bilder auswählen die in der Karte angezeigt werden sollen

### Einbindung der Karte
 
 Die Karte wird in zwei Formaten gespeichert:
 - base64: `mihome-vacuum.0.cleanmap.map64`
 - PNG: `mihome-vacuum.0.cleanmap.mapURL`
 
 Beide Formate können direkt als Bildquelle verwendet werden. Im HTML-Stil sieht das bspw. wie folgt aus:
 `<img src="mihome-vacuum.0.cleanmap.map64">`
 
 Mit zusätzlichen Stil-Attributen kann die Karte noch in Größe und Format geändert werden.
 
Die Bildquellen können natürlich in den verschiedenen VIS von ioBroker verwendet werden. In `jarvis` kann einer der o.g. Datenpunkte als URL im DisplayImage-Widget verwendet werden. 
Durch die Einstellungen im Widget kann die Größe der Karte angepasst werden. Aufgrund des sich anpassendes Designs von jarvis verändert sich die Karte in Verbindung mit der Display-Größe.
  
Im `ioBroker VIS` kann man die Karte bspw. über ein HTML Widget einbinden. Einfach den Datenpunk mit {mihome-vacuum.0.cleanmap.map64} wie im unteren Beispiel einbinden:

```
[{"tpl":"tplHtml","data":{"g_fixed":false,"g_visibility":false,"g_css_font_text":false,"g_css_background":false,"g_css_shadow_padding":false,"g_css_border":false,"g_gestures":false,"g_signals":false,"g_last_change":false,"visibility-cond":"==","visibility-val":1,"visibility-groups-action":"hide","refreshInterval":"0","signals-cond-0":"==","signals-val-0":true,"signals-icon-0":"/vis/signals/lowbattery.png","signals-icon-size-0":0,"signals-blink-0":false,"signals-horz-0":0,"signals-vert-0":0,"signals-hide-edit-0":false,"signals-cond-1":"==","signals-val-1":true,"signals-icon-1":"/vis/signals/lowbattery.png","signals-icon-size-1":0,"signals-blink-1":false,"signals-horz-1":0,"signals-vert-1":0,"signals-hide-edit-1":false,"signals-cond-2":"==","signals-val-2":true,"signals-icon-2":"/vis/signals/lowbattery.png","signals-icon-size-2":0,"signals-blink-2":false,"signals-horz-2":0,"signals-vert-2":0,"signals-hide-edit-2":false,"lc-type":"last-change","lc-is-interval":true,"lc-is-moment":false,"lc-format":"","lc-position-vert":"top","lc-position-horz":"right","lc-offset-vert":0,"lc-offset-horz":0,"lc-font-size":"12px","lc-font-family":"","lc-font-style":"","lc-bkg-color":"","lc-color":"","lc-border-width":"0","lc-border-style":"","lc-border-color":"","lc-border-radius":10,"lc-zindex":0,"html":"{mihome-vacuum.0.cleanmap.map64}"},"style":{"left":"0","top":"0","width":"100%","height":"100%"},"widgetSet":"basic"}]
```

Dies funktioniert mit beiden Formaten. Am besten verwendet man das base64-Format, da dies öfter aktualisiert wird und den Roboter nahezu in Echtzeit anzeigt.

## Funktionen

### Kommandos des S50 (second Generation)
Die Kartengröße immer 52000mm x 52000mm somit sind Werte von 0 bis 51999mm möglich.
Leider kann die Position und die und die Lage der Karte night abgefragt werden, dieses kann sich von Saugvorgang zu Saugvorgang ändern. Genutzt als basis wird immer die letzte Saugkarte, wie auch in der App.
Saugt der Roboter nur ein Bereich und baut die Karte immer gleich auf, kann man ihn zuverlässig zu Orten schicken oder Bereich eSaugen lassen.

#### GoTo
Um dem Staubsauger zu einem Punkt fahren zu lassen muss das Objekt `goTo` wie folgt befüllt werden:
```
xVal,yVal
```
Die Werte müssen den oben genannten Gültigkeitsbereich erfüllen und geben die x und y Koordinate auf der Karte an.

Beispiel:
```
24850,26500
```

#### zoneClean
Zum Saugen einer Zone muss ZoneClean wie folgt befüllt werden:
```
[x1,y1,x2,x2,count]
```
Wobei x und y die Koordinaten des Rechteckigen Bereiches sind und `count` die Reinigungsvorgänge.
Man kann auch mehrere Bereiche auf einmal saugen lassen:

```
[x1,y1,x2,x2,count],[x3,y3,x4,x4,count2]
```

Beispiel:
```
[24117,26005,25767,27205,1],[24320,24693,25970,25843,1]
```
#### Räume
neuere Sauger unterstützen mit der neuesten miHome App die Definition von Räumen, siehe 
[Video](https://www.youtube.com/watch?v=vEiUZzoXfPg)

Dabei hat jeder Raum in der aktuellen Karte einen Index. Dieser wird dann dem Raum aus der App zugewiesen.
Vom Roboter bekommen wir dann nur ein Mapping mit Raumnummer und Index.
Der Adapter fragt diese Räume jedes Mal beim Adapter start ab und erstellt für jeden Raum einen channel, der dann den aktuellen RaumIndex kennt. Manuell passiert dasselbe mit dem Button loadRooms.
Dieser channel kann dann den ioBroker-Räumen zugeordnet werden. Wenn dann der Button roomClean gedrückt wird, wird der Index der Karte ermittelt und dieser dann an den Roboter geschickt, so dass der dann gezielt diesen Raum saugt. Vorher wird bei Einzelraum Saugung noch die FAN-Power eingestellt.
Wenn man in der App die Möglichkeit zum Benennen der Räume noch nicht hat, gibt es noch die Möglichkeit manuell solche channel zu erzeugen, indem man den Map Index angibt. Zusätzlich kann man anstelle des mapIndex jetzt auch die Koordinaten einer Zone eingeben.
Wenn man spontan mal mehrere Räume reinigen will, kann man das über multiRoomClean tun, indem man diesem Datenpunkt die ioBroker-Räume zuweist und dann den Button drückt.

#### Timer
Sobald der Sauger die Raumfunktion (siehe oben) unterstützt, kann man auch Timer erstellen, die dann die entsprechenden Raum-channel antriggert, bzw. dessen mapIndex ermittelt.
Ein Timer kann entweder Räume antriggern und/oder auch direkt Raum Channels.
Die Timer selber werden über den config Bereich erstellt, wird dann aber zu einem Datenpunkt. Dort kann jeder Timer dann aktiviert/deaktiviert werden oder auch einmalig übersprungen werden. Auch ein Direktstart ist möglich.

Der Vorteil der ioBroker timer sind zum einen, dass die auch in der VIS angezeigt bzw. dort genutzt werden können und der Roboter auch vom Internet getrennt werden, da die Timer der App aus China getriggert werden.

### Sende eigene Kommandos
HINWEIS: Diese Funktion sollte nur von Experten genutzt werden, da durch falsche Kommandos der sauger zu Schaden kommen könnte

Der Roboter unterscheidet bei den Kommandos in Methoden (method) und Parameter(params) die zur spezifizierung der Methoden dienen.
Under dem Object `mihome-vacuum.X.control.X_send_command` können eigene Kommandos an den Roboter gesendet werden.
Der Objektaufbau muss dabei wie folgt aussehen: method;[params]

Unter dem Objekt `mihome-vacuum.X.control.X_get_response` wird nach dem Absenden die Antwort vom Roboter eingetragen. 
Wurden Parameter abgefragt erscheinen sie hier im JSON Format, wurde nur ein Befehl gesendet, antwortet der Roboter nur mit "0".

Folgende Methoden und Parameter werden unterstützt:

| method          | params                                                              | Beschreibung                                                                                           |
|-----------      |-------                                                              |-------------------                                                                                     |
| get_timer       |                                                                     | liefert den eingestellten Timer zurück                                                                 |
| set_timer       | [["ZEIT_IN_MS",["30 12 * * 1,2,3,4,5",["start_clean",""]]]]         | Einstellen der Saugzeiten BSp. 12 Uhr 30 an 5 Tagen                                                    |
| upd_timer       | ["1481997713308","on/off"]                                          | Timer aktivieren an/aussehen                                                                           |
|                 |                                                                     |                                                                                                        |
| get_dnd_timer   |                                                                     | Liefert die Zeiten des `Do Not Distrub` zurück                                                         |
| close_dnd_timer |                                                                     |       DND Zeiten löschen                                                                               |
| set_dnd_timer   |   [22,0,8,0]                                                        |       DND Einstellen h,min,h,min                                                                       |
|                 |                                                                     |                                                                                                        |
|app_rc_start     |                                                                     | Remote Control starten                                                                                 |
|app_rc_end       |                                                                     | Remote Control beenden                                                                                 |
|app_rc_move      |[{"seqnum":'0-1000',"velocity":WERT1,"omega":WERT2,"duration":WERT3}]| Bewegung. Sequenznummer muss fortlaufend sein, WERT1(Geschw.) = -0.3 - 0.3, WERT2(Drehung) = -3.1 - 3.1, WERT3(Dauer)|

Mehr Methoden und Parameter können sie hier finden ([Link](https://github.com/MeisterTR/XiaomiRobotVacuumProtocol)).

### Eigene Kommandos per sendTo schicken
Es ist auch möglich, per `sendTo` eigene Kommandos aus anderen Adaptern zu senden. Die Benutzung ist wie folgt:
```
sendTo("mihome-vacuum.0", "sendCustomCommand", 
    {method: "method_id", params: [...] /* optional*/}, 
    function (response) { /* Ergebnis auswerten */}
);
```
mit `method_id` und `params` nach obiger Definition.

Das `response` Objekt hat zwei Eigenschaften: `error` und (sofern kein Fehler aufgetreten ist) `result`.

Eine handvoll vordefinierter Kommandos kann auch folgendermaßen abgesetzt werden:
```
sendTo("mihome-vacuum.0", 
    commandName, 
    {param1: value1, param2: value2, ...}, 
    function (response) { /* do something with the result */}
);
```
Die unterstützten Kommandos sind:

| Beschreibung | `commandName` | Erforderliche Parameter | Anmerkungen |
|---|---|---|---|
| Saugprozess starten | `startVacuuming` | - keine - |  |
| Saugprozess beenden | `stopVacuuming` | - keine - |  |
| Saugprozess pausieren | `pause` | - keine - |  |
| wartende Aufträge löschen | `clearQueue` | - keine - |  |
| Einen kleinen bereich um den Roboter saugen | `cleanSpot` | - keine - |  |
| Zurück zur Ladestation | `charge` | - keine - |  |
| "Hi, I'm over here!" sagen | `findMe` | - keine - |  |
| Status der Verbrauchsmaterialien prüfen (Bürste, etc.) | `getConsumableStatus` | - keine - |  |
| Status der Verbrauchsmaterialien zurücksetzen (Bürste, etc.) | `resetConsumables` | `consumable` | String: filter_work_time, filter_element_work_time, sensor_dirty_time, main_brush_work_time, side_brush_work_time |
| Eine Zusammenfassung aller vorheriger Saugvorgänge abrufen | `getCleaningSummary` | - keine - |  |
| Eine detaillierte Zusammenfassung eines Saugvorgangs abrufen | `getCleaningRecord` | `recordId` |  |
| Karte auslesen | `getMap` | - keine - | Unbekannt, was mit dem Ergebnis getan werden kann |
| Aktuellen Status des Roboters auslesen | `getStatus` | - keine - |  |
| Seriennummer des Roboters auslesen | `getSerialNumber` | - keine - |  |
| Detaillierte Geräteinfos auslesen | `getDeviceDetails` | - keine - |  |
| *Nicht-stören*-Timer abrufen | `getDNDTimer` | - keine - |  |
| Neuen *Nicht-stören*-Timer festlegen | `setDNDTimer` | `startHour`, `startMinute`, `endHour`, `endMinute` |  |
| *Nicht-stören*-Timer löschen | `deleteDNDTimer` | - keine - |  |
| Saugstufe abrufen | `getFanSpeed` | - keine - |  |
| Saugstufe festlegen | `setFanSpeed` | `fanSpeed` | `fanSpeed` ist eine Zahl zwischen 1 und 100 |
| Fernsteuerungsfunktion starten | `startRemoteControl` | - keine - |  |
| Bewegungskommando für Fernsteuerung absetzen | `move` | `velocity`, `angularVelocity`, `duration`, `sequenceNumber` | sequenceNumber muss sequentiell sein, Dauer ist in ms |
| Fernsteuerungsfunktion beenden | `stopRemoteControl` | - keine - |  |
| Raum/Räume saugen | `cleanRooms` | `rooms` | `rooms` ist ein komma separierter String mit enum.rooms.XXX |
| Segment saugen | `cleanSegments` | `rooms` | `rooms` ist Array mit mapIndex oder komma separierter String mit mapIndex |
| Zone saugen | `cleanZone` | `coordinates` | `coordinates` ist ein String mit Koordinaten und die Anzahl Durchläufe, siehe [zoneClean](#zoneClean) |

## Widget
![Widget](widgets/mihome-vacuum/img/previewControl.png)

## Bugs
- gelegentliche Verbindungsabbrüche dies liegt jedoch nicht am Adapter, sondern meistens am eigenen Netzwerke
- Widget zurzeit ohne Funktion