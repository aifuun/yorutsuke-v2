#!/bin/bash

#################################################################################
# AWS SAM Lambda Local Test - Azure Document Intelligence
#
# Usage:
#   ./run-sam-test.sh
#
# Prerequisites:
#   - SAM CLI installed (brew install aws-sam-cli)
#   - Azure DI credentials set in environment
#################################################################################

set -e  # Exit on error

echo "🚀 Yorutsuke Lambda Local Test - Azure DI"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

# Check SAM CLI
if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ SAM CLI not found${NC}"
    echo "Install with: brew install aws-sam-cli"
    exit 1
fi
echo -e "${GREEN}✅ SAM CLI found${NC}: $(sam --version)"

# Check Docker (for start-api)
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found (needed for 'sam local start-api' only)${NC}"
    echo "   Install with: brew install docker"
else
    echo -e "${GREEN}✅ Docker found${NC}"
fi

# Check Azure credentials
if [ -z "$AZURE_DI_ENDPOINT" ]; then
    echo -e "${YELLOW}⚠️  AZURE_DI_ENDPOINT not set${NC}"
    echo "   Run: export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/"
else
    echo -e "${GREEN}✅ AZURE_DI_ENDPOINT set${NC}: ${AZURE_DI_ENDPOINT:0:50}..."
fi

if [ -z "$AZURE_DI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  AZURE_DI_API_KEY not set${NC}"
    echo "   Run: export AZURE_DI_API_KEY=your-api-key"
else
    echo -e "${GREEN}✅ AZURE_DI_API_KEY set${NC}"
fi

echo ""
echo "🏗️  Building SAM project..."
echo ""

# Build
sam build

echo ""
echo -e "${GREEN}✅ Build successful!${NC}"
echo ""

# Menu for test options
echo "🧪 Select test mode:"
echo "1) Quick invoke (no Docker needed, fastest)"
echo "2) Local API Gateway (needs Docker, more realistic)"
echo "3) Just show the setup (don't run)"
echo ""
read -p "Choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "🔧 Running: sam local invoke"
        echo ""
        echo "Command:"
        echo "  sam local invoke InstantProcessorFunction \\"
        echo "    --event events/s3-event.json"
        echo ""

        sam local invoke InstantProcessorFunction \
            --event events/s3-event.json

        echo ""
        echo -e "${GREEN}✅ Invoke completed!${NC}"
        ;;

    2)
        echo ""
        echo "🔧 Running: sam local start-api"
        echo ""
        echo "Command:"
        echo "  sam local start-api --port 3000"
        echo ""
        echo "API will be available at: http://localhost:3000"
        echo "Test with: curl -X POST http://localhost:3000/invoke -d @events/s3-event.json"
        echo "Press Ctrl+C to stop"
        echo ""

        sam local start-api --port 3000
        ;;

    3)
        echo ""
        echo "📖 Setup complete! You can now run:"
        echo ""
        echo "Option A (Quick test):"
        echo "  sam local invoke InstantProcessorFunction --event events/s3-event.json"
        echo ""
        echo "Option B (Full API):"
        echo "  sam local start-api --port 3000"
        echo ""
        echo "Option C (Debug):"
        echo "  sam local invoke InstantProcessorFunction --event events/s3-event.json --debug"
        echo ""
        ;;

    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "📖 For more details, see: SAM-TEST-GUIDE.md"
echo ""
