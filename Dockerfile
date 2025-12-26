FROM node:20-slim
WORKDIR /app

# Install bun
RUN npm install -g bun

COPY package.json ./
RUN npm install
COPY . .

EXPOSE 8080
ENV PORT=8080
CMD ["bun", "run", "src/server/index.ts"]
