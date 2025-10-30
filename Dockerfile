FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source
COPY . .

# Build
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start Next.js
CMD ["npm", "start"]


