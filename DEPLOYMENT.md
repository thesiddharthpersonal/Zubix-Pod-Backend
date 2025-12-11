# AWS EC2 Deployment Setup

This repository is configured for automatic deployment to AWS EC2 via GitHub Actions.

## Prerequisites

1. An AWS EC2 instance running your backend
2. SSH access to the EC2 instance
3. PM2 installed on the EC2 instance for process management

## GitHub Secrets Setup

You need to add the following secrets to your GitHub repository:

1. Go to your repository: https://github.com/thesiddharthpersonal/Zubix-Pod-Backend
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add each of these:

### Required Secrets:

#### `EC2_HOST`
- **Value**: Your EC2 instance hostname or IP address
- **Example**: `podapi.zoobalo.com` or `54.123.45.67`

#### `EC2_USER`
- **Value**: SSH username for your EC2 instance
- **Example**: `ec2-user` (Amazon Linux) or `ubuntu` (Ubuntu)

#### `EC2_SSH_KEY`
- **Value**: Your private SSH key content
- To get this, run on your local machine:
  ```bash
  cat ~/.ssh/your-ec2-key.pem
  ```
- Copy the entire output (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)
- Paste it as the secret value

#### `PROJECT_PATH`
- **Value**: The full path to your project on the EC2 instance
- **Example**: `/home/ec2-user/zubix-pod-backend` or `/var/www/zubix-pod-backend`

## EC2 Server Setup

If you haven't set up your EC2 instance yet, run these commands on your EC2 instance:

```bash
# Update system
sudo yum update -y  # Amazon Linux
# OR
sudo apt update && sudo apt upgrade -y  # Ubuntu

# Install Node.js (v18+)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -  # Amazon Linux
# OR
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -  # Ubuntu

sudo yum install -y nodejs  # Amazon Linux
# OR
sudo apt install -y nodejs  # Ubuntu

# Install PM2 globally
sudo npm install -g pm2

# Clone your repository
cd /home/ec2-user  # or your preferred directory
git clone https://github.com/thesiddharthpersonal/Zubix-Pod-Backend.git zubix-pod-backend
cd zubix-pod-backend

# Install dependencies
npm install

# Set up environment variables
nano .env
# Add your DATABASE_URL, JWT_SECRET, etc.

# Run initial database migrations
npx prisma migrate deploy
npx prisma generate

# Start the application with PM2
pm2 start npm --name "zubix-backend" -- start

# Save PM2 process list
pm2 save

# Set PM2 to start on system boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status
```

## How It Works

Once configured, every time you push to the `main` branch:

1. GitHub Actions triggers the deployment workflow
2. Connects to your EC2 instance via SSH
3. Pulls the latest code
4. Installs any new dependencies
5. Runs database migrations
6. Restarts the application with PM2
7. Shows the PM2 status

## Manual Deployment

If you need to deploy manually without pushing to GitHub:

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@podapi.zoobalo.com

# Navigate to project directory
cd /home/ec2-user/zubix-pod-backend

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Restart application
pm2 restart zubix-backend
```

## Troubleshooting

### Check logs
```bash
pm2 logs zubix-backend
```

### Restart application
```bash
pm2 restart zubix-backend
```

### Check application status
```bash
pm2 status
```

### View running processes
```bash
pm2 list
```

### Stop application
```bash
pm2 stop zubix-backend
```

### Delete application from PM2
```bash
pm2 delete zubix-backend
```

## Security Notes

- Never commit your `.env` file or SSH keys to the repository
- Keep your `EC2_SSH_KEY` secret secure in GitHub Secrets
- Regularly update your EC2 instance security patches
- Use security groups to restrict access to your EC2 instance
