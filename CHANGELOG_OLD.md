# Older changes

### 5.1.0 (2025-01-18)

* (AlexAchilleus) Added mop pad status and some states for Dreame/Xiaomi
* (dirkhe) change model handling

### 5.0.0 (2025-01-04)

* (dirkhe) token from config now encrypted, user has to re-choose device in settings
* (dirkhe) some fixes in UI Setting

### 4.3.0 (2025-01-02) rejected

* (JimmyBondi) added dreame error messages
* (simatec) responsive design added
* (dirkhe) update dependecies and linting

### 4.2.0 (2024-04-01)

* (mcm1957) Adapter requires node.js 18 and js-controller >= 5 now
* (mcm1957) Dependencies have been updated
* (dirkhe) update dependecies
* (dirkhe) replace zlib with native zlib

### 4.1.1 (2024-01-06)

* (Dirkhe) adapt stockConsumables to dreame
* (dirkhe) fix url #886

### 4.1.0 (2023-10-31)

* (Dirkhe) update dependecies
* (Dirkhe) add Roborock S8 and P10
* (Dirkhe) rework consumable features

### 4.0.0 (2023-08-15)

* (DemigodCode) inital version of dream support
* (Dirkhe) add Roborock S8 Ultra Pro

### 3.11.0 (2023-05-12)

* (TA2k) fix too much map request to prevent map rate limit in the app

### 3.10.1 (2023-04-10)

* (Dirkhe) fix waterBoxLevel
* (Dirkhe) fix overwriting of roomStates from global

### 3.10.0 (2023-04-07)

* (Dirkhe) check also stockcommands in onMessage
* (Dirkhe) add feature waterbox level #755

### 3.9.5 (2023-01-13)

* (Dirkhe) change type of unsupported features
* (Dirkhe) fix button/command loadRooms

### 3.9.4 (2023-01-11)

* (Dirkhe) cleanmap.mapURL typo fixed

### 3.9.3 (2023-01-11)

* (Dirkhe) fix loosing passwort in config
* (Dirkhe) move map Url to userspace instead of admin space #735
* (Dirkhe) change mapUrl to /mihome-vacuum.0.userfiles/actualMap.png

### 3.9.2 (2023-01-06)

* (Dirkhe) add function setUnsupportedFeature; if token changed, all stored unsupported Features will be cleared
* (dirkhe) fix bug from 3.9.1 for supported repeat devices

### 3.9.1 (2023-01-06)

* (Dirkhe) add step property to repeat DP
* (Dirkhe) add Queue Fallback mode for repeat
* (Dirkhe) remove wrong clearQueue button

### 3.9.0 (2023-01-04)

* (Dirkhe) add Mop washing #679
* (Dirkhe) trigger pauseResume only, if correct state is given #623
* (Dirkhe) add multiple clean iterations (repeat) #690
* (Dirkhe) housekeeping

### 3.8.8 (2022-11-30)

* (Dirkhe) fix behaviour of pauseResume #623

### 3.8.7 (2022-11-26)

* (Dirkhe) fix typo from translation for battary_live (based on viomi id) #629
* (Dirkhe) fix crash, if cloud-roomID is empty #702

### 3.8.6 (2022-11-12)

* (Dirkhe) Fix type for roomMopMode

### 3.8.5 (2022-11-10)

* (Dirkhe) move parseErrors to debug level
* (Dirkhe) avoid new instanziierung on reconnect

### 3.8.4 (2022-11-07)

* (Dirkhe) change logging for sendMessage to debug

### 3.8.3 (2022-11-01)

* (Dirkhe) change logging from timeouts
* (Dirkhe) hide parts of token in log

### 3.8.2 (2022-10-31)

* (Dirkhe) Bump canvas to 2.10.2
* (Dirkhe) disable map, if CANVAS not installed #681

### 3.8.1 (2022-10-30)

* (Dirkhe) remove deprecated node 12.x Version for workflow

### 3.8.0 (2022-10-30)

* (Dirkhe) fix missing stock command for mop_mode
* (Dirkhe) add mop mode also for cleanSegments and cleanZone
* (Dirkhe) add mop mode also for rooms
* (MeisterTR) map zooming amd show carpet

### 3.7.0 (2022-10-28)

* (Dirkhe) accept custom commands with single paramter
* (Dirkhe) optional parameter waterboxMode and fanSpeed for cleanSegments and cleanZone
* (Dirkhe) fix crash on message send (#652)
* (Dirkhe) add mop mode (#670)
* (Dirkhe) adapt fan_power for S7 Ultra (#677)

### 3.6.0 (2022-07-07)

* (Dirkhe) add dust collecting

### 3.5.0 (2022-06-29)

* (Dirkhe) add Roborock S6 Pure model
* (Dirkhe) add/extend some Hints in readme
* (Dirkhe) add additional log info for cleanRooms
* (Dirkhe) fix error for wrong map-dp

### 3.4.2 (2022-06-24)

* (Apollon77) Update dependencies to allow better automatic rebuild

### 3.4.1 (2022-05-31)

* (Dirkhe) add missed Vacuum states
* (Dirkhe) add dock state Waste water tank full

### 3.4.0 (2022-05-28)

* (Apollon77) Fix several potential crash cases reported by Sentry

### 3.3.6 (2022-05-03)

* (Dirkhe) fix spotcleaning

### 3.3.5 (2022-02-07)

* (Dirkhe) fixed some errors
* (lasthead0) fix cyrillic issue RC4 lib#

### 3.3.3 (2022-01-20)

* (Dirkhe) fixed some errors
* (Dirkhe) add RC4

### 3.3.1 (2021-10-02)

* (MeisterTR) fix IOBROKER-MIHOME-VACUUM-Z
* (MeisterTR) fix some errors

### 3.3.0 (2021-10-01)

* (MeisterTR) fix no rooms for S5
* (MeisterTR) fix IOBROKER-MIHOME-VACUUM-4 DB closed
* (MeisterTR) fix connection error

### 3.2.2 (2021-07-16)

* (bluefox) the communication is corrected
* (bluefox) Added roles to be detected by type-detector

### 3.2.1 (2021-07-02)

* (Apollon77) Adjust several crash cases (IOBROKER-MIHOME-VACUUM-K, IOBROKER-MIHOME-VACUUM-J, IOBROKER-MIHOME-VACUUM-F, IOBROKER-MIHOME-VACUUM-7,
  IOBROKER-MIHOME-VACUUM-A, IOBROKER-MIHOME-VACUUM-4, IOBROKER-MIHOME-VACUUM-G, IOBROKER-MIHOME-VACUUM-C, IOBROKER-MIHOME-VACUUM-B,
  IOBROKER-MIHOME-VACUUM-Q, IOBROKER-MIHOME-VACUUM-M)

### 3.2.0 (02.06.2021)

* (MeisterTR) release candidate
* (MeisterTR) get consumable after reset

### 3.1.10 (23.05.2021)

* error fixed
* add sentry

### 3.1.6 (05.05.2021)

* minimize Disk write
* minimized Messages
* changed warn Messages to debug
* extend Debuglog to find error for e2 vacuum
* added getStates when map is changed

### 3.1.5 (03.05.2021)

* try to fix the map error
* Map64 changed. now without img tags
* add Multimap support (get rooms and map when map is changed)
* select Multimaps
* fix error with zone coordinates
* add WiFi
* fix connection Problems
* fix Valetudo map
* add Mop state
* fix some objects

### 3.1.1 (18.4.2021)

* Full rewrite
* Fix map bug with multiple vacuums
* fix performance Problems
* better connection to vacuum
* fix bug in ReloadMap button
* Show Goto and Zone States ti find places
* and many more...

### 2.2.5 (2021-04-02)

* added S7 Support
* bugfixes for S5 Max and others

### 2.2.4 (2020-09-15)

* (dirkhe) add config for send Pause Before Home

### 2.2.3 (2020-08-20)

* (dirkhe) room DP are not deleted, on map change

### 2.2.0 (2020-08-13)

* (MeisterTR) add test for Viomi and Dreame Api

### 2.1.1 (2020-07-10)

* (bluefox) Refactoring
* (bluefox) Support of compact mode added

### 2.0.10 (2020-07-05)

* try to start the cleaning 3 times, if robot not answers and some fixes

### 2.0.9 (2020-03-05)

* (dirkhe) add state info for room channels and change queue info from number to JSON

### 2.0.8 (2020-02-26)

* (dirkhe) decreased communication with robot

### 2.0.7 (2020-02-25)

* (dirkhe) add Resuming after pause for rooms

### 2.0.6 (2020-02-17)

* (MeisterTR) add rooms for s50 with map (cloud or Valetudo needed)

### 2.0.4 (2020-02-13)

* (MeisterTR) add cloud login to get token
* (MeisterTR) add cloud Map
* (MeisterTR) add new and old Map format
* (MeisterTR) rebuild config page

### 1.10.5 (2020-02-11)

* send Ping only if not connected, otherwise get_status
* set button states to true, if clicked
* move timer manager and room manager to own libs

### 1.10.4 (2020-02-06)

* (MeiserTR) add valetudo map support for gen3 and gen2 2XXX

### 1.10.1 (2020-01-20)

* (dirkhe) added zone as room handling
* (dirkhe) timer could room channels directly

### 1.10.0 (2020-01-17)

* (dirkhe) added room handling
* (dirkhe) added Timer
* (dirkhe) changed feature handling

### 1.1.6 (2018-12-06)

* (JoJ123) Added fan speed for MOP (S50+).

### 1.1.5 (2018-09-02)

* (BuZZy1337) Added description for Status 16 and 17 (goTo and zone cleaning).
* (BuZZy1337) Added setting for automatic resume of paused zone cleaning.

### 1.1.4 (2018-08-24)

* (BuZZy1337) Added possibility to resume a paused zone clean (State: mihome-vacuum.X.control.resumeZoneClean)

### 1.1.3 (2018-07-11)

* (BuZZy1337) fixed zoneCleanup state not working (vacuum was only leaving the dock, saying "Finished ZoneCleanup", and returned immediately back to
  the dock)

### 1.1.2 (2018-07-05)

* (BuZZy1337) fixed detection of new Firmware / Second generation Vacuum

### 1.1.1 (2018-04-17)

* (MeisterTR) error caught , added states for new fw

### 1.1.0 (2018-04-10)

* (mswiege) Finished the widget

### 1.0.1 (2018-01-26)

* (MeisterTR) ready for admin3
* (MeisterTR) support SpotClean and voice level (v1)
* (MeisterTR) support second generation (S50)
* (MeisterTR) Speed up data requests

### 0.6.0 (2017-11-17)

* (MeisterTR) use 96 char token from Ios Backup
* (MeisterTR) faster connection on first use

### 0.5.9 (2017-11-03)

* (MeisterTR) fix communication error without i-net
* (AlCalzone) add selection of predefined power levels

### 0.5.7 (2017-08-17)

* (MeisterTR) compare system time and Robot time (fix no connection if system time is different)
* (MeisterTR) update values if robot start by cloud

### 0.5.6 (2017-07-23)

* (MeisterTR) add option for crate switch for Alexa control

### 0.5.5 (2017-06-30)

* (MeisterTR) add states, features, fix communication errors

### 0.3.2 (2017-06-07)

* (MeisterTR) fix no communication after softwareupdate (Vers. 3.3.9)

### 0.3.1 (2017-04-10)

* (MeisterTR) fix setting the fan power
* (bluefox) catch error if port is occupied

### 0.3.0 (2017-04-08)

* (MeisterTR) add more states

### 0.0.2 (2017-04-02)

* (steinwedel) implement better decoding of packets

### 0.0.1 (2017-01-16)

* (bluefox) initial commit