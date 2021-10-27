FROM node:14-buster-slim
ENV PM2_PUBLIC_KEY i6u6wena5l33kg6
ENV PM2_SECRET_KEY mvoe4o1o71xfug2
RUN mkdir -p /usr/src/app/
WORKDIR /usr/src/app/
RUN apt-get update && apt-get install -y procps
COPY . .
RUN npm install
RUN npm install -g pm2
EXPOSE 3120
CMD ["pm2-runtime", "process.json"]