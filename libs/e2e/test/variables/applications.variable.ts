import { INestApplication } from '@nestjs/common';

export const apps: {
  authentications?: INestApplication;
  backoffices?: INestApplication;
  feeds?: INestApplication;
  pages?: INestApplication;
  users?: INestApplication;
} = {};
