# ----- Builder -----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend ci
COPY institution-frontend/package*.json ./institution-frontend/
RUN npm --prefix institution-frontend ci
COPY . .
ARG VITE_STRIPE_KEY
ENV VITE_STRIPE_KEY=$VITE_STRIPE_KEY
RUN npm run build && npm --prefix frontend run build && npm --prefix institution-frontend run build

# ----- Runner -----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Crear directorios necesarios para uploads y storage
# Asegurar permisos correctos para el usuario 'node'
RUN mkdir -p uploads storage/contracts-audit storage/contracts-signed && \
    chown -R node:node /app

# Copiar dependencias y asignar permisos
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copiar artefactos construidos
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/legal ./legal
COPY --chown=node:node --from=builder /app/frontend/dist ./frontend/dist
COPY --chown=node:node --from=builder /app/institution-frontend/dist ./institution-frontend/dist

# Ejecutar como usuario no-root por seguridad
USER node

ENV PORT=3000
EXPOSE 3000

ENV MONGO_URI=mongodb://mongo:27017/rentalapp
ENV CLAUSE_POLICY_VERSION=1.0.0

CMD ["npm","run","start:prod"]
