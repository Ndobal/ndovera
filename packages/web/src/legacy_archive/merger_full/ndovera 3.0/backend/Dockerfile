# Use official Node.js image as the base
FROM node:18-alpine as build

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

RUN npm run build || echo "No build script, skipping."

FROM node:18-alpine as prod
WORKDIR /app
COPY --from=build /app .

EXPOSE 3000
CMD ["node", "src/app.js"]
