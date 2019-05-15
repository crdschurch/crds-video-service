FROM node:10.15.1

# Create app directory
WORKDIR /usr/src/app

# Install app deps
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

RUN npm run tsc

CMD [ "node", "build/app.js" ]
