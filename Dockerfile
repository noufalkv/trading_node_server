# Use Node.js official Alpine image for smaller size
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Set npm registry to default and install dependencies
RUN npm config set registry https://registry.npmjs.org/ && \
    npm cache clean --force && \
    npm install && \
    npm cache clean --force

# Copy source code
COPY . .

# Create a non-root user for security and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

# Expose the port your app runs on
EXPOSE 4000

# Use production command instead of dev
CMD ["npm", "start"]