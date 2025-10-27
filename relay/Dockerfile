FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./
RUN npm i --omit=dev --no-audit --no-fund || true
COPY src ./src
EXPOSE 8080
CMD ["node", "src/server.js"]

