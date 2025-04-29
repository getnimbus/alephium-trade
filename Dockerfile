# Build stage
FROM node:22-alpine AS builder

WORKDIR /opt/nimbus

# Copy package files
COPY package.json yarn.lock ./
COPY prisma/schema.prisma prisma/schema.prisma

# Install dependencies
RUN corepack enable && yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN yarn build

# Production stage
FROM node:22-alpine

WORKDIR /opt/nimbus

# Copy package files and install only production dependencies
COPY package.json yarn.lock ./
COPY prisma/schema.prisma prisma/schema.prisma

# Install production dependencies
RUN corepack enable && yarn install --frozen-lockfile --production
RUN yarn global add dotenv-cli

# Copy built application from builder stage
COPY --from=builder /opt/nimbus/dist ./dist

EXPOSE 3000

CMD [ "yarn", "start" ]
