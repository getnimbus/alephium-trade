FROM node:18-alpine

WORKDIR /opt/nimbus

COPY package.json .
COPY yarn.lock .

RUN corepack enable
RUN yarn

COPY . .
RUN yarn install
RUN yarn build

EXPOSE 3000

CMD [ "yarn", "start" ]
