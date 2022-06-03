import { INestApplication } from '@nestjs/common';

export const apps: {
  authentications?: INestApplication;
  feeds?: INestApplication;
  pages?: INestApplication;
  users?: INestApplication;
} = {};
