FROM node:22-alpine AS ocr-assets
WORKDIR /build
COPY package.json package-lock.json build-ocr.cjs ./
RUN npm ci --ignore-scripts --no-audit --no-fund && npm run build
FROM nginx:alpine
COPY --chmod=644 index.html styles.css config.js registration.js admin.html admin.css admin.js homework.html homework.css homework.js courses.js text-review.js campus-emotes.js photo-attachments.js learning-model.js vocabulary.html vocabulary.css vocabulary.js /usr/share/nginx/html/
COPY --from=ocr-assets /build/ocr /usr/share/nginx/html/ocr
