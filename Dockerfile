# https://hub.docker.com/_/node
FROM node:19 AS api-base

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
COPY package*.json ./

# Install production dependencies.
RUN npm i --production

# Copy local code to the container image.
COPY . .

# Expose port
EXPOSE 3000
ENV DOCKER_RUN=1 PORT=3000

# API app
FROM api-base AS api-app
CMD [ "npm", "run", "app" ]

# API jobs
FROM api-base AS api-jobs
CMD [ "npm", "run", "jobs" ]
