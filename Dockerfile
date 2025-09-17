FROM node:22

WORKDIR /app

#Copy package.json and package-lock.json
COPY package*.json ./

#install app dependencies
RUN npm install

#Copy the rest of our app into the container
COPY . .

# Set port environment variables
ENV PORT=9000
# Expose the port so our computer can access it
EXPOSE 9000

# Run the app
CMD ["npm", "start"]