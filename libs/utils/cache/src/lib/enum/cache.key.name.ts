/*
 * Copyright (c) 2021, Castcle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 3 only, as
 * published by the Free Software Foundation.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * version 3 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 3 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Castcle, 22 Phet Kasem 47/2 Alley, Bang Khae, Bangkok,
 * Thailand 10160, or visit www.castcle.com if you need additional information
 * or have any questions.
 */
export const CacheKeyName = {
  NotificationsGet: {
    Name: 'NOTIFICATIONS_GET',
    Ttl: 30
  },
  NotificationsBadges: {
    Name: 'NOTIFICATIONS_BADGES',
    Ttl: 30
  },
  LanguagesGet: {
    Name: 'LANGUAGES_GET',
    Ttl: 3600
  },
  HashtagsGet: {
    Name: 'HASHTAGS_GET',
    Ttl: 60
  },
  TopTrends: {
    Name: 'TOPTRENDS',
    Ttl: 60
  },
  Searches: {
    Name: 'SEARCHES',
    Ttl: 60
  },
  Pages: {
    Name: 'PAGES',
    Ttl: 300
  },
  Feeds: {
    Name: 'FEEDS',
    Ttl: 300
  },
  Contents: {
    Name: 'CONTENTS',
    Ttl: 300
  },
  Comments: {
    Name: 'COMMENTS',
    Ttl: 300
  },
  Users: {
    Name: 'USERS',
    Ttl: 300
  }
};
