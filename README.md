CollectM
========

Collectd agent for Windows

Installation
============

* Download from https://github.com/perfwatcher/collectm/releases/latest
* run `CollectM-<version>.install.exe`

CollectM would be added as service and started. If not :
```
C:\Program\ Files\CollectM\bin\node.exe C:\Program\ Files\CollectM\service.js [install|installAndStart|uninstall|stopAndUninstall|start|stop]
```
or
```
C:\Program\ Files (x86)\CollectM\bin\node.exe C:\Program\ Files (x86)\CollectM\service.js [install|installAndStart|uninstall|stopAndUninstall|start|stop]
```

Installer options :
* /S : silent install
* /D=&lt;C:\your\path&gt; : install to C:\your\path

Example : install to C:\Program Files\CollectM

```
Collectm-<version>.exe /S /D=C:\Program Files\CollectM
```
Note (from NSIS doc) :
/D sets the default installation directory. It must be the last parameter used in the command line and must not contain any quotes, even if the path contains spaces. Only absolute paths are supported.

Configure
=========

Use your browser to go to http://localhost:25826/ (login: admin / password: admin)

FAQ
===
* Which Windows version are suported ? It was only tested on Windows 2008, don't know for other version.

Developers
==========
build your own installer :
* install nsis (http://nsis.sourceforge.net/)
* install node (http://nodejs.org/)
* install grunt (http://gruntjs.com/ - "npm install -g grunt-cli" should do it)
* git clone CollectM (git clone...)
* run :
```
cd collectm
npm install --dev
grunt distexe
```

TODO
====
* Write more documentation
* Add SSL on management port
* Set server host at install
* Stop to write what you'll never do
