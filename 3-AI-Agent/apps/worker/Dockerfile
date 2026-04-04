FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

COPY package*.json ./
COPY apps/agentA/package*.json ./apps/agentA/
COPY apps/worker/package*.json ./apps/worker/
RUN npm install

COPY . .

CMD ["npm", "run", "start", "-w", "apps/worker"]
