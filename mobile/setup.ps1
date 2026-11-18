# One-time setup for the Expo app (Windows PowerShell)
# Installs the latest Expo SDK and lets `expo install` pick versions that match it.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# npm/npx are separate programs, so PowerShell does not stop on their errors by itself.
function Assert-Step($name) {
  if ($LASTEXITCODE -ne 0) { throw "Setup failed at: $name. Fix the error above and run setup again." }
}

Write-Host "1/4 Installing Expo SDK..." -ForegroundColor Magenta
npm install expo@latest
Assert-Step "Expo SDK"

Write-Host "2/4 Installing React + native modules (SDK-matched versions)..." -ForegroundColor Magenta
npx expo install react react-dom react-native expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-splash-screen expo-font @expo-google-fonts/inter expo-linear-gradient expo-blur expo-haptics expo-clipboard react-native-reanimated react-native-worklets react-native-gesture-handler react-native-svg lottie-react-native expo-image-picker expo-document-picker expo-image @react-native-async-storage/async-storage @react-navigation/native @react-navigation/bottom-tabs expo-dev-client expo-system-ui expo-image-manipulator expo-video expo-file-system @react-native-google-signin/google-signin
Assert-Step "native modules"

Write-Host "3/4 Installing JS libraries..." -ForegroundColor Magenta
npm install zustand @tanstack/react-query @supabase/supabase-js react-native-url-polyfill
Assert-Step "JS libraries"

Write-Host "4/4 Installing TypeScript..." -ForegroundColor Magenta
npx expo install typescript @types/react -- --save-dev
Assert-Step "TypeScript"

npx expo install --fix
Assert-Step "version fix"
Write-Host "Done. Run:  npx expo start   (press 'a' with your phone connected over USB)" -ForegroundColor Green
