#!/bin/bash

# Azure startup script for Node.js
echo "Starting MedConnect AI application..."

# Set default port if not specified
export PORT=${PORT:-8000}

# Start the application
echo "Starting server on port $PORT"
node server.js
