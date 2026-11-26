QuickChat

QuickChat is a group chat web application built as a cloud computing course project (M.Tech CSE, Nirma University). Users register, create groups, add members and chat. 
The application is deployed on AWS so that it stays available, recovers from failures on its own, scales with load and keeps its data safe.

Features
Register and log in (passwords hashed, login by signed token)
Search for people by username
Create groups and add or remove members
Send and delete messages; the chat refreshes every few seconds
Group admin role: edit group details, transfer admin rights, delete the group
Members can leave a group

Architecture
Browser
  |  loads the web app
  v
Amazon S3 (static website: React + Vite)
  |  API calls over HTTP
  v
Application Load Balancer
  |  forwards to healthy servers only
  v
Auto Scaling group: 2 to 3 EC2 t3.micro servers in two availability zones
  Nginx (port 80)  ->  Node.js / Express (port 4000)
  |
  v
Amazon DynamoDB (users, groups, memberships, messages)

Monitoring: CloudWatch (logs, metrics, alarms) and SNS (email alerts)
Access:     IAM instance role (temporary credentials, no keys in code)

AWS services used

Amazon S3:	Hosts the compiled frontend as a static website
Application Load Balancer:	Single public address for the API; health checks on /api/health
Amazon EC2:	Runs Nginx and the Node.js backend, managed by systemd
EC2 Auto Scaling:	Keeps 2 to 3 servers, replaces failed ones, adds a server when average CPU stays above 50%
Amazon DynamoDB:	On-demand tables with point-in-time recovery
AWS IAM:	Instance role gives servers access to DynamoDB and S3 without stored keys
Amazon CloudWatch:	Application logs, metrics and alarms
Amazon SNS:	Email notifications for alarms and Auto Scaling events
