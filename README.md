CollectW
========

Collectd agent for Windows

Installation
============

* Download https://github.com/perfwatcher/collectw/blob/master/CollectW-1.1.exe
* run `CollectW-1.1.exe`

CollectW would be added as service and started. If not :
```
C:\Program\ Files (x86)\CollectW\bin\node.exe C:\Program\ Files (x86)\CollectW\service.js [install|installAndStart|uninstall|stopAndUninstall|start|stop]
```

Configure
=========

Use your browser to go to http://<your_server:25826/ (login: admin / password: admin)


FAQ
===
* Wich Windows version are suported ? It was only tested on Windows 2008, don't know for other version.
