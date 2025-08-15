# Android Development Environment Setup
Write-Host "Setting up Android Development Environment..." -ForegroundColor Green

# Check Android SDK path
$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $sdkPath) {
    Write-Host "Android SDK found at: $sdkPath" -ForegroundColor Green
    
    # Set environment variables
    [Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkPath, "User")
    [Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $sdkPath, "User")
    Write-Host "Environment variables set" -ForegroundColor Green
    
    # Check for adb
    $adbPath = "$sdkPath\platform-tools\adb.exe"
    if (Test-Path $adbPath) {
        Write-Host "ADB found" -ForegroundColor Green
    } else {
        Write-Host "ADB not found - install Android Platform Tools" -ForegroundColor Red
    }
    
} else {
    Write-Host "Android SDK not found" -ForegroundColor Red
    Write-Host "Please install Android Studio first:" -ForegroundColor Yellow
    Write-Host "https://developer.android.com/studio" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup complete! Restart your terminal and run:" -ForegroundColor Green
Write-Host "npx expo run:android" -ForegroundColor Blue
