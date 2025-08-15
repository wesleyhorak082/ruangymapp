# Java JDK Installation Script for Android Development
Write-Host "Installing Java JDK for Android development..." -ForegroundColor Green

# Check if Java is already installed
$javaPath = Get-Command java -ErrorAction SilentlyContinue
if ($javaPath) {
    Write-Host "Java is already installed at: $($javaPath.Source)" -ForegroundColor Green
    Write-Host "Version: $(java -version 2>&1 | Select-String 'version')" -ForegroundColor Green
    exit 0
}

Write-Host "Java not found. Installing OpenJDK 17..." -ForegroundColor Yellow

# Install OpenJDK using winget (Windows Package Manager)
try {
    Write-Host "Installing OpenJDK 17 using winget..." -ForegroundColor Blue
    winget install Oracle.JDK.17
    Write-Host "Java JDK 17 installed successfully!" -ForegroundColor Green
} catch {
    Write-Host "winget installation failed. Trying alternative method..." -ForegroundColor Yellow
    
    # Alternative: Download and install manually
    Write-Host "Please install Java manually:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://adoptium.net/temurin/releases/" -ForegroundColor Blue
    Write-Host "2. Download OpenJDK 17 for Windows x64" -ForegroundColor Blue
    Write-Host "3. Run the installer" -ForegroundColor Blue
    Write-Host "4. Restart your terminal" -ForegroundColor Blue
}

Write-Host ""
Write-Host "After Java installation, restart your terminal and run:" -ForegroundColor Green
Write-Host "npx expo run:android" -ForegroundColor Blue
