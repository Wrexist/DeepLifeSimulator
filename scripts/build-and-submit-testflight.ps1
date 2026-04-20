# Build and Submit to TestFlight - PowerShell Script
# Deep Life Simulator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deep Life Simulator - TestFlight Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if EAS CLI is installed
Write-Host "Checking EAS CLI installation..." -ForegroundColor Yellow
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue
if (-not $easInstalled) {
    Write-Host "ERROR: EAS CLI is not installed!" -ForegroundColor Red
    Write-Host "Install it with: npm install -g eas-cli" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ EAS CLI found" -ForegroundColor Green
Write-Host ""

# Check if logged in to EAS
Write-Host "Checking EAS authentication..." -ForegroundColor Yellow
$easWhoami = eas whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in to EAS. Please log in:" -ForegroundColor Yellow
    Write-Host "  eas login" -ForegroundColor Cyan
    exit 1
}
Write-Host "✓ Logged in to EAS" -ForegroundColor Green
Write-Host ""

# Display current version info
Write-Host "Current Build Configuration:" -ForegroundColor Cyan
$appConfig = Get-Content app.config.js -Raw
if ($appConfig -match 'version:\s*"([^"]+)"') {
    Write-Host "  Version: $($matches[1])" -ForegroundColor White
}
if ($appConfig -match 'buildNumber:\s*"([^"]+)"') {
    Write-Host "  Build Number: $($matches[1])" -ForegroundColor White
}
Write-Host ""

# Confirm before proceeding
$confirm = Read-Host "Do you want to proceed with the build? (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Build cancelled." -ForegroundColor Yellow
    exit 0
}
Write-Host ""

# Run preflight checks before starting any release build
Write-Host "Running mandatory preflight checks..." -ForegroundColor Yellow
npm run preflight -- --platform ios
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Preflight checks failed. Aborting TestFlight build." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Preflight checks passed" -ForegroundColor Green
Write-Host ""

# Step 1: Build iOS app
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 1: Building iOS app..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will take 15-30 minutes. You can monitor progress at:" -ForegroundColor Yellow
Write-Host "https://expo.dev/accounts/isacm/projects/deeplife-simulator/builds" -ForegroundColor Cyan
Write-Host ""

$buildOutput = eas build --platform ios --profile production --non-interactive 2>&1
$buildExitCode = $LASTEXITCODE

if ($buildExitCode -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    Write-Host $buildOutput -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  - Not logged in to Apple account (run: eas credentials)" -ForegroundColor White
    Write-Host "  - Build credits exhausted (check billing)" -ForegroundColor White
    Write-Host "  - Network issues" -ForegroundColor White
    exit 1
}

# Extract build ID from output
$buildId = $null
if ($buildOutput -match 'Build ID:\s*([a-f0-9-]+)') {
    $buildId = $matches[1]
} elseif ($buildOutput -match 'https://expo.dev/.*/builds/([a-f0-9-]+)') {
    $buildId = $matches[1]
}

if ($buildId) {
    Write-Host ""
    Write-Host "✓ Build started successfully!" -ForegroundColor Green
    Write-Host "Build ID: $buildId" -ForegroundColor Cyan
    Write-Host "Monitor at: https://expo.dev/accounts/isacm/projects/deeplife-simulator/builds/$buildId" -ForegroundColor Cyan
    Write-Host ""
    
    # Ask if user wants to wait for build or submit later
    Write-Host "The build is now processing on EAS servers." -ForegroundColor Yellow
    Write-Host "You can:" -ForegroundColor Yellow
    Write-Host "  1. Wait here for the build to complete (recommended)" -ForegroundColor White
    Write-Host "  2. Submit manually later with: eas submit --platform ios --profile production --latest" -ForegroundColor White
    Write-Host ""
    
    $waitChoice = Read-Host "Wait for build to complete and auto-submit? (y/n)"
    
    if ($waitChoice -eq "y" -or $waitChoice -eq "Y") {
        Write-Host ""
        Write-Host "Waiting for build to complete..." -ForegroundColor Yellow
        Write-Host "This may take 15-30 minutes. Checking every 30 seconds..." -ForegroundColor Yellow
        Write-Host ""
        
        $maxWaitTime = 3600 # 60 minutes
        $checkInterval = 30 # 30 seconds
        $elapsed = 0
        
        while ($elapsed -lt $maxWaitTime) {
            Start-Sleep -Seconds $checkInterval
            $elapsed += $checkInterval
            
            Write-Host "[$([math]::Floor($elapsed/60))m $($elapsed%60)s] Checking build status..." -ForegroundColor Gray
            
            $statusOutput = eas build:view $buildId --json 2>&1
            if ($statusOutput -match '"status":\s*"finished"') {
                Write-Host ""
                Write-Host "✓ Build completed successfully!" -ForegroundColor Green
                Write-Host ""
                break
            } elseif ($statusOutput -match '"status":\s*"errored"') {
                Write-Host ""
                Write-Host "ERROR: Build failed!" -ForegroundColor Red
                Write-Host "Check the build logs for details." -ForegroundColor Yellow
                exit 1
            }
        }
        
        if ($elapsed -ge $maxWaitTime) {
            Write-Host ""
            Write-Host "Build is taking longer than expected." -ForegroundColor Yellow
            Write-Host "You can check status manually or submit later with:" -ForegroundColor Yellow
            Write-Host "  eas submit --platform ios --profile production --latest" -ForegroundColor Cyan
            exit 0
        }
        
        # Step 2: Submit to TestFlight
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Step 2: Submitting to TestFlight..." -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        
        $submitOutput = eas submit --platform ios --profile production --latest --non-interactive 2>&1
        $submitExitCode = $LASTEXITCODE
        
        if ($submitExitCode -ne 0) {
            Write-Host ""
            Write-Host "ERROR: Submission failed!" -ForegroundColor Red
            Write-Host $submitOutput -ForegroundColor Red
            Write-Host ""
            Write-Host "You can try submitting manually later with:" -ForegroundColor Yellow
            Write-Host "  eas submit --platform ios --profile production --latest" -ForegroundColor Cyan
            exit 1
        }
        
        Write-Host ""
        Write-Host "✓ Successfully submitted to TestFlight!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Wait 10-30 minutes for App Store Connect processing" -ForegroundColor White
        Write-Host "  2. Check App Store Connect: https://appstoreconnect.apple.com" -ForegroundColor White
        Write-Host "  3. Distribute to TestFlight testers when ready" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "Build is processing. Submit to TestFlight later with:" -ForegroundColor Yellow
        Write-Host "  eas submit --platform ios --profile production --latest" -ForegroundColor Cyan
        Write-Host ""
    }
} else {
    Write-Host ""
    Write-Host "Build started, but couldn't extract build ID." -ForegroundColor Yellow
    Write-Host "Check build status at: https://expo.dev/accounts/isacm/projects/deeplife-simulator/builds" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Submit to TestFlight when build completes with:" -ForegroundColor Yellow
    Write-Host "  eas submit --platform ios --profile production --latest" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Done!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

