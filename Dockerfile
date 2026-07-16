FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached between rebuilds
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Now copy the actual application code
COPY server ./server
COPY public ./public
COPY database ./database

WORKDIR /app/server
RUN chmod +x entrypoint.sh

ENV PORT=4000
EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
