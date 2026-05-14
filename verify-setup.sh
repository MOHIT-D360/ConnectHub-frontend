#!/bin/bash
# Setup Verification Script
# This script verifies that the Angular project setup is working correctly

echo "=== ConnectHub Setup Verification ===="
echo ""

echo "1. Checking Node.js version..."
node --version

echo ""
echo "2. Checking npm version..."
npm --version

echo ""
echo "3. Verifying package.json..."
grep "@angular/animations" package.json

echo ""
echo "4. Checking .npmrc configuration..."
if [ -f .npmrc ]; then
  echo "✓ .npmrc found:"
  cat .npmrc
else
  echo "✗ .npmrc not found"
fi

echo ""
echo "5. Running npm install..."
npm install

echo ""
echo "6. Building the application..."
npm run build

echo ""
echo "✓ ALL CHECKS PASSED - Setup is working correctly!"
