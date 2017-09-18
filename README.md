![Logo](admin/mihome-vacuum.png)

ioBroker mihome-vacuum adapter
=================

[![NPM version](http://img.shields.io/npm/v/iobroker.mihome-vacuum.svg)](https://www.npmjs.com/package/iobroker.mihome-vacuum)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mihome-vacuum.svg)](https://www.npmjs.com/package/iobroker.mihome-vacuum)
[![Tests](https://travis-ci.org/ioBroker/ioBroker.mihome-vacuum.svg?branch=master)](https://travis-ci.org/ioBroker/ioBroker.mihome-vacuum)

[![NPM](https://nodei.co/npm/iobroker.mihome-vacuum.png?downloads=true)](https://nodei.co/npm/iobroker.mihome-vacuum/)

[Deutsche beschreibung hier](README_de.md)

This adapter allows you control the Xiaomi vacuum cleaner.

## Content
- [Setup](#configuration)
    - [with Android](#on-android)
    - [with iOS](#for-ios)
    - [Configure Adapter](#adapter-configuration)
        - [Control via Alexa](#control-over-alexa)
        - [Second robot](#second-robot)
- [Functions](#functions)
    - [Own Commands](#send-your-own-commands)
- [widget](#widget)
- [bugs](#bugs)
- [Changelog](#changelog)

## Configuration
Currently, finding the token is the biggest problem.
The following procedures can be used:

### On Android
Preparation:
An Android smartphone with ready-made MiHome app is required. The teat must be added and fitted in it.

- Download and unzip the [MiToolkit](https://github.com/ultrara1n/MiToolkit/releases) and start MiToolkit.exe.
- Enable USB debugging in the smartphone settings ([video](https://www.youtube.com/watch?v=aw7D6bNgI1U))
- Connect the smartphone to the PC using a USB cable.
- In the MiToolkit click on "Check connection" and if necessary test the Java installation, both tests should run fault-free.
- Click on "Read token" and confirm the message on the smartphone (NO give password!).

On the smartphone the MiHome app should be opened (automatically) and a backup to the PC should be taken (should take a few seconds), the program then reads the token from the MiHome database (miio2.db).
Now look for the rockrobo.vaccuum in the open window and copy the 32-digit token and enter it in the configuration window.

### For iOS

With Jailbreak:
- If the token is found at /var/mobile/Containers/Data/Application/514106F3-C854-45E9-A45C-119CB4FFC235/Documents/USERID_mihome.sqlite

Without Jailbreak:
- A long discription you can find here: ([Link](http://technikzeugs.de/xiaomi-mirobot-staubsaugroboter-mit-iobroker-und-echo-bzw-alexa-fernsteuern/)).
- If you need to make an unencrypted iTunes backup with e.g. ([Link](http://www.imactools.com/iphonebackupviewer/)).
- And then look in the files for DB under RAW, com.xiaomi.home, USERID_mihome.sqlite.

Again, the 32-character token or 96-character token is searched for

### Adapter Configuration
- For IP address, the IP address of the robot must be entered in the format "192.168.178.XX"
- The port of the robot is set to "54321" by default, this should not be changed
- Own port, should only be changed with second robot
- Query Interval The time in ms in which the robot's status values are retrieved (should not be <10000)

#### Control over Alexa
In the config add alexa state is activated here is a hack is set an additional state "clean_home" it is a switch which starts at "true" the sucker and at "false" it goes home, it becomes automatically a smart device in the cloud Adapter created with the name "vacuum cleaner", which can be changed in the cloud adapter.

- Experimental: Using the checkbox "Send your own commands" objects are created, via which you can send and receive your own commands to the robot.

#### Second robot
If two robots are to be controlled via ioBroker, two instances must be created. The second robot must change its own port (default: 53421) so that both robots have different ports.

## Functions
### Send your own commands
NOTE: This function should only be used by experts, as the sucker might be damaged by wrong commands

The robot distinguishes between the commands in methods (methods) and parameters (params) which serve to specify the methods.
Under the object "mihome-vacuum.X.control.X_send_command" you can send your own commands to the robot.
The object structure must look as follows: method; [params]

Under the object "mihome-vacuum.X.control.X_get_response", the response is entered by the robot after sending. If parameters were queried, they appear here in the JSON format. If only one command was sent, the robot responds only with "0".

The following methods and parameters are supported:

| method          | params                                                              | Beschreibung                                                                                           |
|-----------      |-------                                                              |-------------------                                                                                     |
| get_timer       |                                                                     | Returns the set timerSetting the suction times BSp. 12 o'clock 30 in 5 days                            |
| set_timer       | [["TIME_IN_MS",["30 12 * * 1,2,3,4,5",["start_clean",""]]]]         | Enable / disable timer                                                                                 |
| upd_timer       | ["1481997713308","on/off"]                                          |                                                                                                        |
|                 |                                                                     | Rescues the times of the Do Not Distrube                                                               |
| get_dnd_timer   |                                                                     | Delete DND times                                                                                       |
| close_dnd_timer |                                                                     | DND Setting h, min, h, min                                                                             |
| set_dnd_timer   | [22,0,8,0]                                                          |                                                                                                        |
|                 |                                                                     |                                                                                                        |
| app_rc_start    |                                                                     | Start Romote Control                                                                                   |
| app_rc_end      |                                                                     | Finish Remote Control                                                                                  |
| app_rc_move     |[{"seqnum":'0-1000',"velocity":VALUE1,"omega":VALUE2,"duration":VALUE3}]| Move. Sequence number must be continuous, VALUE1 (speed) = -0.3-0.3, VALUE2 (rotation) = -3.1-3.1, VALUE3 (duration)


more methods and parameters you can find here ([Link](https://github.com/MeisterTR/XiaomiRobotVacuumProtocol)).

## Widget
Sorry, not yet finished.
![Widget](widgets/mihome-vacuum/img/previewControl.png)

## Bugs
- occasional disconnections, however, this is not due to the adapter but mostly on its own networks
- Widget at the time without function

## Changelog
### 0.5.8 (2017-09-18)
* (MeisterTR) use 96 char token from Ios Backup
* (AlCalzone) add selection of predefined power levels
### 0.5.7 (2017-08-17)
* (MeisterTR) compare system time and Robot time (fix no connection if system time is different)
* (MeisterTR) update values if robot start by cloud
### 0.5.6 (2017-07-23)
* (MeisterTR) add option for crate switch for Alexa control

### 0.5.5 (2017-06-30)
* (MeisterTR) add states, fetures, fix communication errors

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
