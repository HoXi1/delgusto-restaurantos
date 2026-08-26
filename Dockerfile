FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev=false
COPY . .
ENV NODE_ENV=production
EXPOSE 5000
CMD ["sh","-c","npx prisma migrate deploy && node prisma/seed.js && node server.js"]
