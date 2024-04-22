#!/bin/bash
if [ ! -d "/home/ubuntu/aws-codedeploy" ]; then
    # Create the directory if it doesn't exist
    mkdir /home/ubuntu/aws-codedeploy
fi
cd /home/ubuntu/aws-codedeploy
npm install --production
npx prisma format
npx prisma db pull
npx prisma generate