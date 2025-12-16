# ----- Builder -----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ----- Runner -----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/legal ./legal

ENV PORT=3000
EXPOSE 3000

ENV MONGO_URI=mongodb://mongo:27017/rentalapp
ENV CLAUSE_POLICY_VERSION=1.0.0

CMD ["npm","run","start:prod"]
