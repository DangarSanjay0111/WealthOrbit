
  # ---- Stage 1: build the static assets ----
  # Vite 8 / Rolldown require Node ^20.19 || >=22.12. Pin to 22-alpine so a
  # stale/floating node:20 tag from the build cache can't ship an old 20.x
  # that fails to load Rolldown's native binding ("npm run build" exit 1).
  FROM node:22-alpine AS build
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  
  # Vite bakes env vars in at BUILD time
  ARG VITE_API_URL                
  ENV VITE_API_URL=$VITE_API_URL

  # outputs to /app/dist
  RUN npm run build       

  # ---- Stage 2: serve with nginx (tiny final image) ----
  FROM nginx:alpine AS production
  COPY --from=build /app/dist /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  EXPOSE 80
  CMD ["nginx", "-g", "daemon off;"]
