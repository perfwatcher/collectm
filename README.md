CollectW
========

Collectd agent for Windows

Installation
============

* Download https://github.com/perfwatcher/collectw/raw/master/releases/CollectW-1.1.2.exe
* run `CollectW-1.1.2.exe`

CollectW would be added as service and started. If not :
```
C:\Program\ Files\CollectW\bin\node.exe C:\Program\ Files\CollectW\service.js [install|installAndStart|uninstall|stopAndUninstall|start|stop]
```
or
```
C:\Program\ Files (x86)\CollectW\bin\node.exe C:\Program\ Files (x86)\CollectW\service.js [install|installAndStart|uninstall|stopAndUninstall|start|stop]
```

Installer options :
* /S : silent install
* /D=<C:\your\path> : install to C:\your\path

Example : install to C:\Program Files\CollectW

```
Collectw-<version>.exe /S /D="C:\Program Files\CollectW"
```

Configure
=========

Use your browser to go to http://<your_server:25826/ (login: admin / password: admin)


FAQ
===
* Wich Windows version are suported ? It was only tested on Windows 2008, don't know for other version.

TODO
====
* Write more documentation
* Add SSL on management port
* Have the possibility to disable plugins
* Set server host at install
* Stop to write what you'll never do
