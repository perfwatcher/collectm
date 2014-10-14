!include x64.nsh

Name "Collectw"

OutFile "out.exe"

Function .onInit
  StrCpy $instdir $programfiles32\CollectW
  ${If} ${RunningX64}
    StrCpy $instdir $programfiles64\CollectW
  ${EndIf}
FunctionEnd


Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

Section ""
  SetOutPath $INSTDIR
  File build\collectw.js
  File build\collectw_utils.js
  File build\httpconfig.js
  File build\service.js
  SetOutPath $INSTDIR\plugins
  File /r /x .git /x .gitignore /x .npmignore build\plugins\*.*
  SetOutPath $INSTDIR\bin
  File build\node.exe
    ${If} ${RunningX64}
        File /oname=node.exe build\node64.exe
  ${Else}
        File /oname=node.exe build\node32.exe
  ${EndIf}
  SetOutPath $INSTDIR\config
  File config\default.json
  SetOutPath $INSTDIR\frontend
  File frontend\index.html
  File frontend\jquery-2.1.1.min.js
  File frontend\collectw.css
  
  SetOutPath $INSTDIR\node_modules\body-parser
  File /r /x .git /x .gitignore /x .npmignore node_modules\body-parser\*.*
  SetOutPath $INSTDIR\node_modules\collectdout
  File /r /x .git /x .gitignore /x .npmignore node_modules\collectdout\*.*
  SetOutPath $INSTDIR\node_modules\connect-basic-auth
  File /r /x .git /x .gitignore /x .npmignore node_modules\connect-basic-auth\*.*
  SetOutPath $INSTDIR\node_modules\diskspace
  File /r /x .git /x .gitignore /x .npmignore node_modules\diskspace\*.*
  SetOutPath $INSTDIR\node_modules\express
  File /r /x .git /x .gitignore /x .npmignore node_modules\express\*.*
  SetOutPath $INSTDIR\node_modules\MD5
  File /r /x .git /x .gitignore /x .npmignore node_modules\MD5\*.*
  SetOutPath $INSTDIR\node_modules\node-windows
  File /r /x .git /x .gitignore /x .npmignore node_modules\node-windows\*.*
  SetOutPath $INSTDIR\node_modules\perfmon
  File /r /x .git /x .gitignore /x .npmignore node_modules\perfmon\*.*
  SetOutPath $INSTDIR\node_modules\process
  File /r /x .git /x .gitignore /x .npmignore node_modules\process\*.*
  SetOutPath $INSTDIR\node_modules\windows-cpu
  File /r /x .git /x .gitignore /x .npmignore node_modules\windows-cpu\*.*
  SetOutPath $INSTDIR\node_modules\config
  File /r /x .git /x .gitignore /x .npmignore node_modules\config\*.*

  WriteUninstaller uninstall.exe

  ExecWait '"$INSTDIR\bin\node.exe" "$INSTDIR\service.js" installAndStart'
  
SectionEnd

Section "Uninstall"

  ExecWait '"$INSTDIR\bin\node.exe" "$INSTDIR\service.js" stopAndUninstall'

  RmDir /r $INSTDIR\node_modules
  RmDir /r $INSTDIR\bin
  RmDir /r $INSTDIR\daemon
  RmDir /r $INSTDIR\frontend
  RmDir /r $INSTDIR\plugins
  Delete $INSTDIR\collectw.js
  Delete $INSTDIR\collectw_utils.js
  Delete $INSTDIR\httpconfig.js
  Delete $INSTDIR\service.js
  Delete $INSTDIR\config\default.json
  Delete $INSTDIR\uninstall.exe
  RmDir $INSTDIR\config
  RmDir $INSTDIR


SectionEnd
