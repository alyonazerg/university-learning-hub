# syntax=docker/dockerfile:1
FROM node:22-alpine AS ocr-assets
WORKDIR /build
COPY package.json package-lock.json build-ocr.cjs ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --ignore-scripts --no-audit --no-fund; \
    else npm ci --ignore-scripts --no-audit --no-fund; fi && npm run build
FROM nginx:alpine
COPY --chmod=644 index.html styles.css config.js registration.js admin.html admin.css admin.js homework.html homework.css homework.js courses.js text-review.js campus-emotes.js photo-attachments.js learning-model.js vocabulary.html vocabulary.css vocabulary.js learning.html learning-session.js coursework-session.js planning-model.js planning-session.js semester-schedule.js cabinet.css /usr/share/nginx/html/
COPY --from=ocr-assets /build/ocr /usr/share/nginx/html/ocr

COPY --chmod=644 calendars /usr/share/nginx/html/calendars

COPY --chmod=644 favicon.svg /usr/share/nginx/html/favicon.svg

COPY --chmod=644 topic-import.js /usr/share/nginx/html/topic-import.js
COPY --chmod=644 templates /usr/share/nginx/html/templates

COPY --chmod=644 midcheck.html midcheck-config.js midcheck-app.js midcheck-timing.js midcheck-launch.js /usr/share/nginx/html/
COPY --chmod=644 assessments /usr/share/nginx/html/assessments

COPY --chmod=644 speaking-audio.js text-feedback.js /usr/share/nginx/html/

COPY --chmod=644 action-feedback.js /usr/share/nginx/html/

COPY --chmod=644 revision-test.html revision-test.js revision-session.js revision-tests.css /usr/share/nginx/html/

# IMT idiom pilot page and its assets
COPY --chmod=644 imt-idiom.html imt-idiom.css imt-idiom.js /usr/share/nginx/html/
COPY --chmod=644 imt-teacher.html imt-teacher.js /usr/share/nginx/html/
COPY --chmod=644 teacher-login.html /usr/share/nginx/html/
COPY --chmod=644 bug-report.js bug-report.css /usr/share/nginx/html/
COPY --chmod=644 messages.js /usr/share/nginx/html/
COPY --chmod=644 message-alerts.js message-notifications-sw.js /usr/share/nginx/html/
COPY --chmod=644 emoji-picker.js /usr/share/nginx/html/
COPY --chmod=644 campus-home.js telegram-message-alerts.js /usr/share/nginx/html/
COPY --chmod=644 student-profile.js mini-app.js /usr/share/nginx/html/
COPY --chmod=644 group-settings.js /usr/share/nginx/html/
COPY --chmod=644 coursework-review.js coursework-files.js coursework-review.css /usr/share/nginx/html/
COPY --chmod=644 campus-mobile.css /usr/share/nginx/html/
COPY --chmod=644 imt-student.html /usr/share/nginx/html/
COPY --chmod=644 student-entry.html student-account.html student-account.js my-imt.js imt-reset.js access.css /usr/share/nginx/html/

# Static directories require traversal permission; documents only need read access.
RUN find /usr/share/nginx/html -type d -exec chmod 755 {} + \
    && find /usr/share/nginx/html -type f -exec chmod 644 {} +
