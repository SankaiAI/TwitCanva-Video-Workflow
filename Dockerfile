FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy application code
COPY . .

# Build the frontend (Vite)
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Set the environment to production
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/index.js"]
