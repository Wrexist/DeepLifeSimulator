#!/bin/bash
# Build and Submit to TestFlight - Bash Script
# Deep Life Simulator

echo "========================================"
echo "Deep Life Simulator - TestFlight Build"
echo "========================================"
echo ""

# Check if EAS CLI is installed
echo "Checking EAS CLI installation..."
if ! command -v eas &> /dev/null; then
    echo "ERROR: EAS CLI is not installed!"
    echo "Install it with: npm install -g eas-cli"
    exit 1
fi
echo "✓ EAS CLI found"
echo ""

# Check if logged in to EAS
echo "Checking EAS authentication..."
if ! eas whoami &> /dev/null; then
    echo "Not logged in to EAS. Please log in:"
    echo "  eas login"
    exit 1
fi
echo "✓ Logged in to EAS"
echo ""

# Display current version info
echo "Current Build Configuration:"
if grep -q 'version:' app.config.js; then
    VERSION=$(grep -oP 'version:\s*"\K[^"]+' app.config.js | head -1)
    echo "  Version: $VERSION"
fi
if grep -q 'buildNumber:' app.config.js; then
    BUILD_NUMBER=$(grep -oP 'buildNumber:\s*"\K[^"]+' app.config.js | head -1)
    echo "  Build Number: $BUILD_NUMBER"
fi
echo ""

# Confirm before proceeding
read -p "Do you want to proceed with the build? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Build cancelled."
    exit 0
fi
echo ""

# Step 1: Build iOS app
echo "========================================"
echo "Step 1: Building iOS app..."
echo "========================================"
echo ""
echo "This will take 15-30 minutes. You can monitor progress at:"
echo "https://expo.dev/accounts/isacm/projects/deeplife-simulator/builds"
echo ""

BUILD_OUTPUT=$(eas build --platform ios --profile production --non-interactive 2>&1)
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "ERROR: Build failed!"
    echo "$BUILD_OUTPUT"
    echo ""
    echo "Common issues:"
    echo "  - Not logged in to Apple account (run: eas credentials)"
    echo "  - Build credits exhausted (check billing)"
    echo "  - Network issues"
    exit 1
fi

# Extract build ID from output
BUILD_ID=$(echo "$BUILD_OUTPUT" | grep -oP 'Build ID:\s*\K[a-f0-9-]+' | head -1)
if [ -z "$BUILD_ID" ]; then
    BUILD_ID=$(echo "$BUILD_OUTPUT" | grep -oP 'https://expo.dev/.*/builds/\K[a-f0-9-]+' | head -1)
fi

if [ -n "$BUILD_ID" ]; then
    echo ""
    echo "✓ Build started successfully!"
    echo "Build ID: $BUILD_ID"
    echo "Monitor at: https://expo.dev/accounts/isacm/projects/deeplife-simulator/builds/$BUILD_ID"
    echo ""
    
    # Ask if user wants to wait for build or submit later
    echo "The build is now processing on EAS servers."
    echo "You can:"
    echo "  1. Wait here for the build to complete (recommended)"
    echo "  2. Submit manually later with: eas submit --platform ios --profile production --latest"
    echo ""
    
    read -p "Wait for build to complete and auto-submit? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "Waiting for build to complete..."
        echo "This may take 15-30 minutes. Checking every 30 seconds..."
        echo ""
        
        MAX_WAIT_TIME=3600  # 60 minutes
        CHECK_INTERVAL=30   # 30 seconds
        ELAPSED=0
        
        while [ $ELAPSED -lt $MAX_WAIT_TIME ]; do
            sleep $CHECK_INTERVAL
            ELAPSED=$((ELAPSED + CHECK_INTERVAL))
            
            MINUTES=$((ELAPSED / 60))
            SECONDS=$((ELAPSED % 60))
            echo "[${MINUTES}m ${SECONDS}s] Checking build status..."
            
            STATUS_OUTPUT=$(eas build:view "$BUILD_ID" --json 2>&1)
            if echo "$STATUS_OUTPUT" | grep -q '"status":\s*"finished"'; then
                echo ""
                echo "✓ Build completed successfully!"
                echo ""
                break
            elif echo "$STATUS_OUTPUT" | grep -q '"status":\s*"errored"'; then
                echo ""
                echo "ERROR: Build failed!"
                echo "Check the build logs for details."
                exit 1
            fi
        done
        
        if [ $ELAPSED -ge $MAX_WAIT_TIME ]; then
            echo ""
            echo "Build is taking longer than expected."
            echo "You can check status manually or submit later with:"
            echo "  eas submit --platform ios --profile production --latest"
            exit 0
        fi
        
        # Step 2: Submit to TestFlight
        echo ""
        echo "========================================"
        echo "Step 2: Submitting to TestFlight..."
        echo "========================================"
        echo ""
        
        SUBMIT_OUTPUT=$(eas submit --platform ios --profile production --latest --non-interactive 2>&1)
        SUBMIT_EXIT_CODE=$?
        
        if [ $SUBMIT_EXIT_CODE -ne 0 ]; then
            echo ""
            echo "ERROR: Submission failed!"
            echo "$SUBMIT_OUTPUT"
            echo ""
            echo "You can try submitting manually later with:"
            echo "  eas submit --platform ios --profile production --latest"
            exit 1
        fi
        
        echo ""
        echo "✓ Successfully submitted to TestFlight!"
        echo ""
        echo "Next steps:"
        echo "  1. Wait 10-30 minutes for App Store Connect processing"
        echo "  2. Check App Store Connect: https://appstoreconnect.apple.com"
        echo "  3. Distribute to TestFlight testers when ready"
        echo ""
    else
        echo ""
        echo "Build is processing. Submit to TestFlight later with:"
        echo "  eas submit --platform ios --profile production --latest"
        echo ""
    fi
else
    echo ""
    echo "Build started, but couldn't extract build ID."
    echo "Check build status at: https://expo.dev/accounts/isacm/projects/deeplife-simulator/builds"
    echo ""
    echo "Submit to TestFlight when build completes with:"
    echo "  eas submit --platform ios --profile production --latest"
    echo ""
fi

echo "========================================"
echo "Done!"
echo "========================================"

