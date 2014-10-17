!include x64.nsh

!define PROJECTNAME "Collectw - updated within grunt"
!define VERSION "version - updated within grunt"

Name "${PROJECTNAME}"

OutFile "${PROJECTNAME}-${VERSION}.install.exe"

LicenseText "${PROJECTNAME} is distributed under the GNU General Public License." 
LicenseData "LICENSE" 

Function .onInit
  ${If} $InstDir == "" ; /D not used
    StrCpy $InstDir $programfiles32\${PROJECTNAME}
    ${If} ${RunningX64}
      StrCpy $InstDir $programfiles64\${PROJECTNAME}
    ${EndIf}
  ${EndIf}
FunctionEnd

Page license
Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

Section ""
  SetOutPath $InstDir
  File build\collectw.js
  File build\collectw_utils.js
  File build\httpconfig.js
  File build\service.js
  File LICENSE
  SetOutPath $InstDir\plugins
  File /r /x .git /x .gitignore /x .npmignore build\plugins\*.*
  SetOutPath $InstDir\bin
  File build\node.exe
    ${If} ${RunningX64}
        File /oname=node.exe build\node64.exe
  ${Else}
        File /oname=node.exe build\node32.exe
  ${EndIf}
  SetOutPath $InstDir\config
  File config\default.json
  SetOutPath $InstDir\frontend
  File frontend\index.html
  File frontend\jquery-2.1.1.min.js
  File frontend\collectw.css
  
  SetOutPath $InstDir\node_modules\body-parser
  File /r /x .git /x .gitignore /x .npmignore node_modules\body-parser\*.*
  SetOutPath $InstDir\node_modules\collectdout
  File /r /x .git /x .gitignore /x .npmignore node_modules\collectdout\*.*
  SetOutPath $InstDir\node_modules\connect-basic-auth
  File /r /x .git /x .gitignore /x .npmignore node_modules\connect-basic-auth\*.*
  SetOutPath $InstDir\node_modules\diskspace
  File /r /x .git /x .gitignore /x .npmignore node_modules\diskspace\*.*
  SetOutPath $InstDir\node_modules\express
  File /r /x .git /x .gitignore /x .npmignore node_modules\express\*.*
  SetOutPath $InstDir\node_modules\MD5
  File /r /x .git /x .gitignore /x .npmignore node_modules\MD5\*.*
  SetOutPath $InstDir\node_modules\node-windows
  File /r /x .git /x .gitignore /x .npmignore node_modules\node-windows\*.*
  SetOutPath $InstDir\node_modules\perfmon
  File /r /x .git /x .gitignore /x .npmignore node_modules\perfmon\*.*
  SetOutPath $InstDir\node_modules\process
  File /r /x .git /x .gitignore /x .npmignore node_modules\process\*.*
  SetOutPath $InstDir\node_modules\windows-cpu
  File /r /x .git /x .gitignore /x .npmignore node_modules\windows-cpu\*.*
  SetOutPath $InstDir\node_modules\config
  File /r /x .git /x .gitignore /x .npmignore node_modules\config\*.*

  ; Write the uninstall keys for Windows
  WriteRegStr HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PROJECTNAME}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PROJECTNAME}" "DisplayName" "${PROJECTNAME} ${VERSION}"
  WriteRegStr HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PROJECTNAME}" "UninstallString" '"$InstDir\uninstall.exe"'
  WriteRegStr HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PROJECTNAME}" "Publisher" "Cyril Feraudet, https://github.com/perfwatcher/collectw"
  WriteRegStr HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PROJECTNAME}" "HelpLink" "https://github.com/perfwatcher/collectw"
  WriteRegStr HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PROJECTNAME}" "URLInfoAbout" "https://github.com/perfwatcher/collectw"
  WriteRegStr HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PROJECTNAME}" "URLUpdateInfo" "https://github.com/perfwatcher/collectw/releases"
  WriteRegDWORD HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PROJECTNAME}" "NoModify" 1
  WriteRegDWORD HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PROJECTNAME}" "NoRepair" 1
  WriteUninstaller uninstall.exe

  ExecWait '"$InstDir\bin\node.exe" "$InstDir\service.js" installAndStart'
  
SectionEnd

Section "Uninstall"

  ExecWait '"$InstDir\bin\node.exe" "$InstDir\service.js" stopAndUninstall'

  RmDir /r $InstDir\node_modules
  RmDir /r $InstDir\bin
  RmDir /r $InstDir\daemon
  RmDir /r $InstDir\frontend
  RmDir /r $InstDir\plugins
  Delete $InstDir\collectw.js
  Delete $InstDir\collectw_utils.js
  Delete $InstDir\httpconfig.js
  Delete $InstDir\service.js
  Delete $InstDir\config\default.json
  Delete $InstDir\LICENSE
  Delete $InstDir\uninstall.exe
  RmDir $InstDir\config
  RmDir $InstDir


SectionEnd
