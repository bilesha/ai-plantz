# Use Node image
FROM node:20-alpine

# Install expo-cli globally
RUN npm install -g expo-cli

# Set working directory
WORKDIR /app

# Copy package.json first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose Expo ports
EXPOSE 19000 19001 19002

# Start Expo in development mode
CMD ["npx", "expo", "start", "--tunnel"]