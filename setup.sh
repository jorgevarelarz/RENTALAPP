#!/bin/bash
# Simple setup script to prepare the Rental App environment.
# This script attempts to install MongoDB and Node.js dependencies.

set -e

echo "Setting up Rental App..."

# Detect package manager
if command -v brew >/dev/null 2>&1; then
  echo "Homebrew detected. Installing MongoDB Community Edition 7.0..."
  brew tap mongodb/brew || true
  brew install mongodb-community@7.0 || true
  echo "Starting MongoDB service..."
  brew services start mongodb/brew/mongodb-community@7.0 || true
elif command -v apt-get >/dev/null 2>&1; then
  echo "APT detected. Installing MongoDB and Node.js build tools..."
  sudo apt-get update
  sudo apt-get install -y mongodb npm
  sudo systemctl start mongodb || true
else
  echo "Unsupported package manager. Please install MongoDB manually." >&2
fi

echo "Installing Node.js dependencies..."
npm install

# Install type definitions if network is available. These are optional.
echo "Attempting to install TypeScript definitions for pdfkit, nodemailer and stripe..."
npm install --save-dev @types/pdfkit @types/nodemailer @types/stripe || true

echo "Setup complete. Please create your .env file based on .env.example before running the app."