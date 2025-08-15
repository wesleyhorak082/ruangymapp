# Android Development Environment Setup Script
# Run this after installing Android Studio

Write-Host "🔧 Setting up Android Development Environment..." -ForegroundColor Green
Write-Host ""

# Check if Android Studio is installed
$androidStudioPath = "${env:LOCALAPPDATA}\Google\AndroidStudio"
$androidSdkPath = "${env:LOCALAPPDATA}\Android\Sdk"

if (Test-Path $androidStudioPath) {
    Write-Host "✅ Android Studio found at: $androidStudioPath" -ForegroundColor Green
} else {
    Write-Host "❌ Android Studio not found. Please install it first." -ForegroundColor Red
    Write-Host "   Download from: https://developer.android.com/studio" -ForegroundColor Yellow
    exit 1
}

if (Test-Path $androidSdkPath) {
    Write-Host "✅ Android SDK found at: $androidSdkPath" -ForegroundColor Green
} else {
    Write-Host "❌ Android SDK not found. Please install it through Android Studio." -ForegroundColor Red
    exit 1
}

# Check for required tools
$tools = @(
    "platform-tools\adb.exe",
    "platform-tools\fastboot.exe",
    "tools\bin\sdkmanager.bat"
)

Write-Host ""
Write-Host "🔍 Checking required tools..." -ForegroundColor Blue

foreach ($tool in $tools) {
    $toolPath = Join-Path $androidSdkPath $tool
    if (Test-Path $toolPath) {
        Write-Host "✅ $tool found" -ForegroundColor Green
    } else {
        Write-Host "❌ $tool not found" -ForegroundColor Red
    }
}

# Set environment variables
Write-Host ""
Write-Host "🔧 Setting environment variables..." -ForegroundColor Blue

$envVars = @{
    "ANDROID_HOME" = $androidSdkPath
    "ANDROID_SDK_ROOT" = $androidSdkPath
}

foreach ($envVar in $envVars.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($envVar.Key, $envVar.Value, "User")
    Write-Host "✅ Set $($envVar.Key) = $($envVar.Value)" -ForegroundColor Green
}

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$pathsToAdd = @(
    "$androidSdkPath\platform-tools",
    "$androidSdkPath\tools\bin",
    "$androidSdkPath\emulator"
)

foreach ($path in $pathsToAdd) {
    if ($currentPath -notlike "*$path*") {
        $newPath = "$currentPath;$path"
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        Write-Host "✅ Added $path to PATH" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  $path already in PATH" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Android development environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Next steps:" -ForegroundColor Blue
Write-Host "1. Restart your terminal/PowerShell to load new environment variables"
Write-Host "2. Run: npx expo run:android"
Write-Host "3. Select your target device (emulator or physical device)"
Write-Host ""
Write-Host "💡 If you get any errors, try:" -ForegroundColor Yellow
Write-Host "   - Restarting your terminal"
Write-Host "   - Running: npx expo doctor"
Write-Host "   - Checking: npx expo run:android --help"
