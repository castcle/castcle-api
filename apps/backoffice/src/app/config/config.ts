import { Size } from '@castcle-api/utils/aws';

export const EXPIRE_TIME = 2 * 24 * 60 * 60 * 1000;
export const IMAGE_BUCKET_FOLDER = 'images';

export const AVATAR_SIZE_CONFIGS: Size[] = [
  { name: 'thumbnail', width: 120, height: 120 },
  { name: 'medium', width: 480, height: 480 },
  { name: 'large', width: 1080, height: 1080 },
  { name: 'fullHd', width: 1920, height: 1920 },
];

export const COMMON_SIZE_CONFIGS: Size[] = [
  { name: 'thumbnail', width: 640, height: 360 },
  { name: 'medium', width: 960, height: 540 },
  { name: 'large', width: 1280, height: 720 },
  { name: 'fullHd', width: 1920, height: 1080 },
];
