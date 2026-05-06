# Stage 1: Build the application
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build 

# Stage 2: Serve the application
FROM nginx:stable-alpine
# Copy the build output to the Nginx html folder
COPY --from=build /app/dist /usr/share/nginx/html
# Copy a custom nginx config if you have one
# EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]