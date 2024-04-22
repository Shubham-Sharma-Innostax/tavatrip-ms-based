#!/bin/bash
# Stop all servers and start the server
cd /home/ubuntu/aws-codedeploy
export NODE_ENV=staging
pm2 kill
pm2 start index.js
