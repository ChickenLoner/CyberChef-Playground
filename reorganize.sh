#!/bin/bash
# Reorganize CyberChef Playground directory structure

set -e

cd /mnt/g/CyberChef-Playground

echo "=========================================="
echo "Reorganizing Directory Structure"
echo "=========================================="
echo ""

# Step 1: Create directories
echo "Step 1: Creating directories..."
mkdir -p cyberchef
mkdir -p uploads
echo "✓ Directories created"

# Step 2: Move CyberChef files
echo ""
echo "Step 2: Moving CyberChef files to cyberchef/..."

# Move HTML files
mv index.html cyberchef/ 2>/dev/null && echo "  ✓ Moved index.html" || echo "  - index.html already moved"
mv index.html.br cyberchef/ 2>/dev/null && echo "  ✓ Moved index.html.br" || true
mv index.html.gz cyberchef/ 2>/dev/null && echo "  ✓ Moved index.html.gz" || true

# Move directories
mv assets cyberchef/ 2>/dev/null && echo "  ✓ Moved assets/" || echo "  - assets/ already moved"
mv images cyberchef/ 2>/dev/null && echo "  ✓ Moved images/" || echo "  - images/ already moved"
mv modules cyberchef/ 2>/dev/null && echo "  ✓ Moved modules/" || echo "  - modules/ already moved"

# Move worker files
mv ChefWorker.js cyberchef/ 2>/dev/null || true
mv DishWorker.js cyberchef/ 2>/dev/null || true
mv InputWorker.js cyberchef/ 2>/dev/null || true
mv LoaderWorker.js cyberchef/ 2>/dev/null || true
mv ZipWorker.js cyberchef/ 2>/dev/null || true

# Move LICENSE files
mv *.LICENSE.txt cyberchef/ 2>/dev/null || true

echo "✓ CyberChef files organized"

# Step 3: Check public/index.html
echo ""
echo "Step 3: Checking CTF web interface..."
if [ -f "public/index.html" ]; then
    FILE_SIZE=$(du -h public/index.html | cut -f1)
    echo "✓ CTF interface found (${FILE_SIZE})"
else
    echo "⚠ WARNING: public/index.html not found!"
    echo ""
    echo "You need the CTF web interface file."
    echo "This is NOT the CyberChef index.html"
    echo "This is the CTF challenge selection page."
    echo ""
    echo "Download it from the project files."
fi

# Step 4: Summary
echo ""
echo "=========================================="
echo "Reorganization Complete!"
echo "=========================================="
echo ""

echo "Directory Structure:"
echo ""
echo "CyberChef-Playground/"
echo "├── cyberchef/              ← CyberChef app (for validation)"
if [ -d "cyberchef" ]; then
    echo "│   ├── index.html         ✓"
    echo "│   ├── assets/            ✓"
    echo "│   ├── images/            ✓"
    echo "│   └── modules/           ✓"
fi
echo "├── public/                 ← Your CTF web interface"
if [ -f "public/index.html" ]; then
    echo "│   └── index.html         ✓"
else
    echo "│   └── index.html         ✗ MISSING!"
fi
echo "├── challenges/             ← Challenge binaries"
BINARY_COUNT=$(find challenges/ -type f -executable ! -name "*.c" 2>/dev/null | wc -l)
echo "│   └── $BINARY_COUNT binaries"
echo "├── solutions/              ← Solution recipes"
SOLUTION_COUNT=$(find solutions/ -name "*.json" 2>/dev/null | wc -l)
echo "│   └── $SOLUTION_COUNT recipes"
echo "└── server.js              ← CTF server"
echo ""

# Final checks
echo "Final Checks:"
echo ""

if [ -f "cyberchef/index.html" ]; then
    echo "✓ CyberChef organized"
else
    echo "✗ CyberChef index.html missing"
fi

if [ -f "public/index.html" ]; then
    echo "✓ CTF interface ready"
else
    echo "✗ CTF interface missing - download public/index.html"
fi

if [ -f "server.js" ]; then
    echo "✓ Server found"
else
    echo "✗ Server missing"
fi

if [ $BINARY_COUNT -ge 5 ]; then
    echo "✓ All challenge binaries present ($BINARY_COUNT/5)"
else
    echo "⚠ Missing binaries ($BINARY_COUNT/5)"
fi

echo ""
echo "Next steps:"
if [ ! -f "public/index.html" ]; then
    echo "1. Download public/index.html (CTF web interface)"
fi
echo "2. Update server.js to use cyberchef/index.html"
echo "3. npm install"
echo "4. npm start"
echo ""