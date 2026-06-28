  # ---- WealthOrbit Backend (Express / Node) ----
  FROM node:20-alpine
  WORKDIR /app

  # Copy manifests FIRST and install — this layer is cached and only
  # rebuilds when dependencies change, not on every code edit.
  # npm ci = reproducible install from lockfile
  COPY package*.json ./
  RUN npm ci --omit=dev     

  # Now copy source (changes often, so it comes after the deps layer)
  COPY . .
  ENV NODE_ENV=production

  # multer writes uploaded files to /app/uploads at runtime. COPY runs as root,
  # so this dir is root-owned; make it writable by the non-root `node` user
  # or every upload fails with EACCES (surfaces as "Internal server error").
  RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

  # documentation only; doesn't publish the port
  EXPOSE 5000      
  
  # don't run as root — security best practice            
  USER node                     
  CMD ["node", "server.js"]
