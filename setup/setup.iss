#include "idp.iss"

[Setup]
AppName=DappStarter CLI
AppVersion=1.0
WizardStyle=modern
DisableWelcomePage=no
DisableDirPage=yes
DefaultDirName={autopf}\DappStarter
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\trycrypto.ico
WizardImageFile=trycrypto_background.bmp
WizardSmallImageFile=trycrypto_small_logo.bmp
PrivilegesRequired=lowest
ShowLanguageDialog=no
AppPublisher=TryCrypto
AppPublisherURL=www.trycrypto.com
UninstallDisplayName=DappStarter CLI by TryCrypto
OutputBaseFilename=dappstarter_setup
[Files]
Source: "..\assets\trycrypto.ico"; DestDir: "{app}"

[Messages]
WelcomeLabel2=Installer will download latest version from GitHub
ClickFinish=dappstarter is now available in your PATH. Click Finish to exit Setup.

[Code]
procedure InitializeWizard;
begin
  { Create the pages }

  IDPAddFile('https://github.com/trycrypto/dappstarter-cli/releases/latest/download/dappstarter.exe', expandconstant('{tmp}\dappstarter.exe'));
      
          
  idpDownloadAfter(wpReady);
  { Set default values, using settings that were stored last time if possible }
  
  end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  { Store the settings so we can restore them next time }
  
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
end;


procedure CurStepChanged(CurStep: TSetupStep);
begin
 if CurStep=ssInstall then begin //Lets install those files that were downloaded for us
  filecopy(expandconstant('{tmp}\dappstarter.exe'),expandconstant('{%USERPROFILE}\dappstarter.exe'),false);
 end;
end;


[UninstallDelete]
Type: files; Name: "{%USERPROFILE}\dappstarter.exe"