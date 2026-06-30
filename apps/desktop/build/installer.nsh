; Tras instalar/desinstalar, avisa al shell de que las asociaciones/iconos cambiaron, para que
; el acceso directo del escritorio muestre el icono nuevo y no el viejo cacheado (Electron).
; SHCNE_ASSOCCHANGED = 0x08000000.

!macro customInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  ExecWait '"$SYSDIR\ie4uinit.exe" -show'
!macroend

!macro customUnInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
