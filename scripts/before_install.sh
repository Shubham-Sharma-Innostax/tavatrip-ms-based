#!/bin/bash
# Install node.js and forever
sudo rm -rf /home/ubuntu/aws-codedeploy
sudo apt-get update
sudo apt install -y nodejs npm
# Puppeteer Dependencies Installation on EC2
sudo apt-get update
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgtk-3-0 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libgbm-dev libpango-1.0-0 libpangocairo-1.0-0 libasound2 libcairo2 libxss1 libatk-bridge2.0-0 libgtk-3-0
npm cache clean --force
sudo npm install pm2 -g
