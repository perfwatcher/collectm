# How do we release a new file

## Edit those files

* ChangeLog
* package.json

## Generate the installer

```
$ grunt test
$ grunt distexe
$ mv collectm*install.exe releases
```

## Git add the installer

```
$ git add releases/collectm...install.exe
```

Note : Last release to be added : 1.3.3.
We will now try to upload the installer to the "Release" section instead (check https://github.com/perfwatcher/collectm/releases/latest)

## Double check that we have all good

```
$ git status
```

## Commit and tag

Example :
```
$ git commit -a -m "New release 1.3.2"
$ git tag -a "v1.3.2" -m "Version 1.3.2"
```

## Push to Github

```
$ git push -u origin master:master
$ git push origin refs/tags/v1.3.2

```

## Comment the new release

### On Github

Click on the `[Releases]` tab. Then find the new tag (in the `[Tags]` tab) and add a new release note.

Release title : `Version <version number>`

Copy/paste the last changes from the ChangeLog file.
Replace the dashs with stars (markdown syntax)

Upload the installer so it can be available on https://github.com/perfwatcher/collectm/releases/latest

### On the Mailing-list

Send to perfwatcher@lists.perfwatcher.org a mail like this :

Subject : `[CollectM] New release CollectM-<version>`

```
Hello,

CollectM-<version> is released.

We decided to use Perfwatcher mailing-list to post CollectM news for a while.
When we feel that CollectM should have its own mailing list, we will create it.

CollectM is developped by the same authors as Perfwatcher. This is why Perfwatcher Project hosts CollectM.


Download CollectM from https://github.com/perfwatcher/collectm/releases/latest
More information on CollectM : https://github.com/perfwatcher/collectm

ChangeLog  (https://github.com/perfwatcher/collectm/releases) :

*Copy the ChangeLog section related to the last release*

Regards,
the authors
```



