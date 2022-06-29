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

import { Logger } from '@nestjs/common';
import { connect, disconnect, model, Schema } from 'mongoose';
import { SchemaTypes } from 'mongoose';

enum MetadataType {
  COUNTRY = 'country',
  LANGUAGE = 'language',
  REPORTING_SUBJECT = 'reporting-subject',
}

class Migration {
  static logger = new Logger(Migration.name);
  static run = async () => {
    const args: Record<string, string> = {};

    process.argv.forEach((arg) => {
      const v = arg.match(/--(\w+)=(.+)/);
      if (v) args[v[1]] = v[2];
    });

    const dbName = args['dbName'] || 'test';
    const url = args['url'] || `mongodb://localhost:27017/${dbName}`;

    this.logger.log(`Process.`);

    await connect(url, {
      useUnifiedTopology: true,
    });

    const metadataSchemaModel = model(
      'Metadata',
      new Schema(
        {
          type: SchemaTypes.String,
          payload: SchemaTypes.Map,
        },
        { timestamps: true },
      ),
    );
    const countryModel = model('Country', new Schema({}));
    const languageModel = model('Language', new Schema({}));

    this.logger.log(`Start insert report subject.`);

    const reporting = [
      {
        type: 'reporting-subject',
        payload: { slug: 'nudity', name: 'Nudity', order: 1 },
      },
      {
        type: 'reporting-subject',
        payload: { slug: 'violence', name: 'Violence', order: 2 },
      },
      {
        type: 'reporting-subject',
        payload: { slug: 'harassment', name: 'Harassment', order: 3 },
      },
      {
        type: 'reporting-subject',
        payload: {
          slug: 'suicide-or-self-injury',
          name: 'Suicide or self-injury',
          order: 4,
        },
      },
      {
        type: 'reporting-subject',
        payload: {
          slug: 'false-information',
          name: 'False Information',
          order: 5,
        },
      },
      {
        type: 'reporting-subject',
        payload: { slug: 'spam', name: 'Spam', order: 6 },
      },
      {
        type: 'reporting-subject',
        payload: {
          slug: 'unauthorized-sales',
          name: 'Unauthorized sales',
          order: 7,
        },
      },
      {
        type: 'reporting-subject',
        payload: { slug: 'hate-speech', name: 'Hate speech', order: 8 },
      },
      {
        type: 'reporting-subject',
        payload: { slug: 'terrorism', name: 'Terrorism', order: 9 },
      },
      {
        type: 'reporting-subject',
        payload: { slug: 'something-else', name: 'Something else', order: 10 },
      },
    ];

    await metadataSchemaModel.insertMany(reporting, { ordered: true });

    this.logger.log(`End insert report subject.`);

    this.logger.log(`Start insert countries.`);

    const countries = await countryModel.aggregate([
      {
        $sort: { name: 1 },
      },
      {
        $addFields: {
          payload: {
            name: '$name',
            code: '$code',
            dialCode: '$dialCode',
          },
        },
      },
      {
        $project: {
          _id: 0,
          type: MetadataType.COUNTRY,
          payload: 1,
        },
      },
    ]);

    await metadataSchemaModel.insertMany(countries, { ordered: true });

    this.logger.log(`End insert countries.`);

    this.logger.log(`Start insert languages.`);

    const languages = await languageModel.aggregate([
      {
        $sort: { title: 1 },
      },
      {
        $addFields: {
          payload: {
            code: '$code',
            title: '$title',
            display: '$display',
          },
        },
      },
      {
        $project: {
          _id: 0,
          type: MetadataType.LANGUAGE,
          payload: 1,
        },
      },
    ]);

    await metadataSchemaModel.insertMany(languages, { ordered: true });

    this.logger.log(`End insert languages.`);

    await disconnect();

    this.logger.log(`Done.`);
  };
}

Migration.run();
