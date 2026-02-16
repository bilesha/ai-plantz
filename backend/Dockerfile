# backend/Dockerfile

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies, including nodemon globally
RUN npm install -g nodemon
RUN npm install

# Copy the rest of the app
COPY . .

# Expose backend port
EXPOSE 5000

# Run nodemon instead of node
CMD ["nodemon", "src/index.ts"]