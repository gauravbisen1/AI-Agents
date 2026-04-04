FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/agentA/package*.json ./apps/agentA/
COPY apps/worker/package*.json ./apps/worker/
RUN npm install

COPY . .

EXPOSE 4000
CMD ["npm", "run", "start", "-w", "apps/agentA"]
