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

import {
  Content,
  ContentServiceV2,
  EntityVisibility,
  NotificationServiceV2,
  NotificationSource,
  NotificationType,
  ReportingIllegal,
  ReportingStatus,
  ReportingType,
  Repository,
  ResponseDto,
  User,
  UserType,
} from '@castcle-api/database';
import { Configs } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { pipelineOfGetReporting } from '../aggregations';
import { StaffRole } from '../models/authentication.enum';
import {
  GetReportingQuery,
  GetReportingResponse,
  UpdateIllegal,
} from '../models/reporting.dto';
import { Staff } from '../schemas/staff.schema';

@Injectable()
export class ReportingService {
  private logger = new CastLogger(ReportingService.name);
  constructor(
    private repository: Repository,
    private notificationService: NotificationServiceV2,
    private contentService: ContentServiceV2,
  ) {}

  private checkingStatusActive(status: ReportingStatus) {
    switch (status) {
      case ReportingStatus.REVIEWING:
        return ReportingStatus.DONE;

      case ReportingStatus.APPEAL:
        return ReportingStatus.CLOSED;

      default:
        return;
    }
  }

  private async toPayloadReportings({
    reportings,
    reportedBy,
  }: GetReportingResponse) {
    const userIds = reportings.map(({ user }) => user);
    const reportUserIds = reportedBy.map(({ user }) => user);
    const payloadIds = reportedBy.map(({ payload }) => payload._id);

    const users = await this.repository.findUsers({
      _id: [...userIds, ...reportUserIds, ...payloadIds],
      visibility: [
        EntityVisibility.Publish,
        EntityVisibility.Illegal,
        EntityVisibility.Deleted,
      ],
    });
    return Promise.all(
      reportings.map(async (reporting) => {
        const content =
          reporting.type === ReportingType.CONTENT
            ? await this.repository.findContent({
                _id: reporting.id,
                visibility: [
                  EntityVisibility.Illegal,
                  EntityVisibility.Publish,
                  EntityVisibility.Deleted,
                ],
              })
            : undefined;

        const user = users?.find((user) => user.id === String(reporting.user));

        return {
          id: reporting.id,
          status: reporting.status,
          type: reporting.type,
          user: {
            ...user?.toPublicResponse(),
            visibility: user?.visibility,
          },
          content: content
            ? {
                ...this.contentService.toCastPayload({ content }),
                visibility: content?.visibility,
              }
            : undefined,
          reportBy: reporting.reportBy.map((id) => {
            const payloadReportBy = reportedBy.find(
              ({ type, user }) =>
                type === reporting.type && String(user) === String(id),
            );

            const reportUser = users?.find(
              (user) => user.id === String(payloadReportBy?.payload?._id),
            );

            const reportByUser = users?.find(
              (user) => user.id === String(payloadReportBy?.user),
            );

            return {
              id: payloadReportBy?.id,
              user: reportByUser?.toPublicResponse(),
              subject: payloadReportBy?.subject,
              message: payloadReportBy?.message,
              payload:
                reporting.type === ReportingType.USER
                  ? reportUser?.toPublicResponse()
                  : this.contentService.toCastPayload({
                      content: payloadReportBy?.payload as Content,
                    }),
              createdAt: payloadReportBy?.createdAt,
              updatedAt: payloadReportBy?.updatedAt,
            };
          }),
          createdAt: reporting.createdAt,
          updatedAt: reporting.updatedAt,
        };
      }),
    );
  }

  async getReporting(query?: GetReportingQuery) {
    this.logger.log(
      `#pipelineOfGetReporting::${JSON.stringify(
        pipelineOfGetReporting(query),
      )}`,
    );

    const [payloadReporting] = await this.repository.aggregateReporting(
      pipelineOfGetReporting(query),
    );

    if (!payloadReporting)
      return {
        payload: [],
      };

    return ResponseDto.ok({
      payload: await this.toPayloadReportings(payloadReporting),
    });
  }

  async updateNotIllegal(body: UpdateIllegal, staff: Staff) {
    const query = {
      payloadId: Types.ObjectId(body.id),
      type: body.type as ReportingType,
      status: undefined,
    };

    if (staff.role === StaffRole.EDITOR)
      query.status = [ReportingStatus.APPEAL, ReportingStatus.REVIEWING];

    const reportings = await this.repository.findReportings(query);
    if (!reportings.length) throw new CastcleException('REPORTING_NOT_FOUND');

    await Promise.all(
      reportings.map(async (reporting) => {
        if (reporting.status === ReportingStatus.CLOSED) return;
        reporting.status = ReportingStatus.CLOSED;
        (reporting.actionBy ??= []).push({
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          action: ReportingIllegal.NOT_ILLEGAL,
          status: ReportingStatus.CLOSED,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        reporting.markModified('actionBy');
        await reporting.save();

        reporting.type === ReportingType.USER
          ? await this.repository.updateUser(
              {
                _id: reporting.payload._id,
                visibility: EntityVisibility.Illegal,
              },
              {
                $set: { visibility: EntityVisibility.Publish },
                $unset: { reportedStatus: 1, reportedSubject: 1 },
              },
            )
          : await this.repository.updateContent(
              {
                _id: reporting.payload._id,
                visibility: EntityVisibility.Illegal,
              },
              {
                $set: { visibility: EntityVisibility.Publish },
                $unset: { reportedStatus: 1, reportedSubject: 1 },
              },
            );

        const userOwner = await this.repository.findUser({
          _id: reporting.user as any,
          visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
        });

        const accountOwner = await this.repository.findAccount({
          _id: userOwner?.ownerAccount,
        });

        await this.notificationService.notifyToUser(
          {
            source:
              userOwner.type === UserType.PEOPLE
                ? NotificationSource.Profile
                : NotificationSource.Page,
            sourceUserId: undefined,
            type: NotificationType.NotIllegal,
            profileRef:
              reporting.type === ReportingType.USER
                ? reporting.payload._id
                : undefined,
            contentRef:
              reporting.type === ReportingType.CONTENT
                ? reporting.payload._id
                : undefined,
            account: userOwner.ownerAccount,
            read: false,
          },
          userOwner,
          accountOwner?.preferences?.languages[0] ?? Configs.DefaultLanguage,
        );
      }),
    );
  }

  async updateIllegal(body: UpdateIllegal, staff: Staff) {
    const query = {
      payloadId: Types.ObjectId(body.id),
      type: body.type as ReportingType,
      status: undefined,
    };

    if (staff.role === StaffRole.EDITOR)
      query.status = [ReportingStatus.APPEAL, ReportingStatus.REVIEWING];

    const reportings = await this.repository.findReportings(query);
    if (!reportings.length) throw new CastcleException('REPORTING_NOT_FOUND');

    await Promise.all(
      reportings.map(async (reporting) => {
        const status = this.checkingStatusActive(reporting.status);
        if (!status && reporting.status === ReportingStatus.CLOSED) return;
        reporting.status = status;
        (reporting.actionBy ??= []).push({
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          action: ReportingIllegal.ILLEGAL,
          status: status,
          subject: body.subjectByAdmin,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        reporting.markModified('actionBy');
        await reporting.save();

        const contentReporting =
          reporting.type === ReportingType.USER
            ? await this.repository.findUser({
                _id: reporting.payload._id,
                visibility: [
                  EntityVisibility.Illegal,
                  EntityVisibility.Publish,
                ],
              })
            : await this.repository.findContent({
                _id: reporting.payload._id,
                visibility: [
                  EntityVisibility.Illegal,
                  EntityVisibility.Publish,
                ],
              });

        contentReporting.visibility =
          contentReporting.visibility === EntityVisibility.Publish
            ? EntityVisibility.Illegal
            : EntityVisibility.Deleted;

        if (contentReporting.reportedStatus === ReportingStatus.ILLEGAL)
          contentReporting.reportedStatus = ReportingStatus.CLOSED;

        if (!contentReporting.reportedStatus)
          contentReporting.reportedStatus = ReportingStatus.ILLEGAL;

        contentReporting.reportedSubject = body.subjectByAdmin;

        await contentReporting.save();

        const userOwner =
          reporting.type === ReportingType.USER
            ? (contentReporting as User)
            : await this.repository.findUser({
                _id: reporting.user as any,
                visibility: [
                  EntityVisibility.Publish,
                  EntityVisibility.Illegal,
                ],
              });

        const accountOwner = await this.repository.findAccount({
          _id: userOwner?.ownerAccount,
        });

        await this.notificationService.notifyToUser(
          {
            source:
              userOwner.type === UserType.PEOPLE
                ? NotificationSource.Profile
                : NotificationSource.Page,
            sourceUserId: undefined,
            type:
              status === ReportingStatus.DONE
                ? NotificationType.IllegalDone
                : NotificationType.IllegalClosed,
            profileRef:
              reporting.type === ReportingType.USER
                ? reporting.payload._id
                : undefined,
            contentRef:
              reporting.type === ReportingType.CONTENT
                ? reporting.payload._id
                : undefined,
            account: userOwner.ownerAccount,
            read: false,
          },
          userOwner,
          accountOwner?.preferences?.languages[0] ?? Configs.DefaultLanguage,
        );
      }),
    );
  }

  async updateAutoDelete(staff: Staff) {
    const reporting = await this.repository.findReportings({
      status: [ReportingStatus.DONE, ReportingStatus.NOT_APPEAL],
      createdAt_lt: DateTime.local().minus({ days: 7 }).toJSDate(),
    });

    if (!reporting.length) throw new CastcleException('REPORTING_NOT_FOUND');

    const userIds = reporting
      .filter(({ type }) => type === ReportingType.USER)
      .map(({ payload }) => payload._id);

    const contentIds = reporting
      .filter(({ type }) => type === ReportingType.CONTENT)
      .map(({ payload }) => payload._id);

    const [users, contents] = await Promise.all([
      await this.repository.findUsers({
        _id: userIds,
        visibility: EntityVisibility.Illegal,
      }),
      await this.repository.findContents({
        _id: contentIds,
        visibility: EntityVisibility.Illegal,
      }),
    ]);

    if (!(users.length || contents.length)) return;

    await Promise.all([
      this.repository.updateReportings(
        {
          payloadId: [
            ...users.map(({ _id }) => _id),
            ...contents.map(({ _id }) => _id),
          ],
        },
        {
          $set: {
            status: ReportingStatus.CLOSED,
          },
          $addToSet: {
            actionBy: {
              firstName: staff.firstName,
              lastName: staff.lastName,
              email: staff.email,
              action: ReportingIllegal.AUTO_DELETE,
              status: ReportingStatus.CLOSED,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        },
      ),
      users.map(async (user) => {
        user.visibility = EntityVisibility.Deleted;
        await user.save();

        const accountOwner = await this.repository.findAccount({
          _id: user?.ownerAccount,
        });

        await this.notificationService.notifyToUser(
          {
            source:
              user.type === UserType.PEOPLE
                ? NotificationSource.Profile
                : NotificationSource.Page,
            sourceUserId: undefined,
            type: NotificationType.IllegalClosed,
            profileRef: user._id,
            account: user.ownerAccount,
            read: false,
          },
          user,
          accountOwner?.preferences?.languages[0] ?? Configs.DefaultLanguage,
        );
      }),
      contents.map(async (content) => {
        content.visibility = EntityVisibility.Deleted;
        await content.save();

        const userOwner = await this.repository.findUser({
          _id: content.author.id,
        });

        const accountOwner = await this.repository.findAccount({
          _id: userOwner?.ownerAccount,
        });

        await this.notificationService.notifyToUser(
          {
            source:
              userOwner.type === UserType.PEOPLE
                ? NotificationSource.Profile
                : NotificationSource.Page,
            sourceUserId: undefined,
            type: NotificationType.IllegalClosed,
            contentRef: content._id,
            account: userOwner.ownerAccount,
            read: false,
          },
          userOwner,
          accountOwner?.preferences?.languages[0] ?? Configs.DefaultLanguage,
        );
      }),
    ]);
  }
}
