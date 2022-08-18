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
  Meta,
  NotificationServiceV2,
  NotificationSource,
  NotificationType,
  ReportingIllegal,
  ReportingStatus,
  ReportingType,
  Repository,
  ResponseDto,
  UserType,
} from '@castcle-api/database';
import { CastLogger } from '@castcle-api/logger';
import { LocalizationLang } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
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
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  private async reduceFollows(userId: string, increase?: number) {
    const follower = await this.repository.findRelationships({
      followedUser: userId as any,
      following: true,
    });

    const followed = await this.repository.findRelationships({
      userId: userId as any,
      followedUser: follower.map(({ user }) => user),
      following: true,
    });

    await Promise.all([
      this.repository.updateUsers(
        {
          _id: follower.map(({ user }) => user as any),
          visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
        },
        { $inc: { followedCount: increase } },
      ),
      this.repository.updateUsers(
        {
          _id: followed.map(({ followedUser }) => followedUser as any),
          visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
        },
        { $inc: { followerCount: increase } },
      ),
    ]);
  }

  private checkingStatusActive(status: ReportingStatus) {
    if (status === ReportingStatus.REVIEWING) {
      return ReportingStatus.DONE;
    } else if (
      status === ReportingStatus.DONE ||
      status === ReportingStatus.APPEAL ||
      status === ReportingStatus.NOT_APPEAL
    ) {
      return ReportingStatus.CLOSED;
    } else {
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
                _id: reporting.payloadId,
                visibility: [
                  EntityVisibility.Illegal,
                  EntityVisibility.Publish,
                  EntityVisibility.Deleted,
                ],
              })
            : undefined;

        const user = users?.find((user) => user.id === String(reporting.user));

        return {
          id: reporting.payloadId,
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
          reportBy: reporting.reportBy.map((reportByUserId) => {
            const payloadReportBy = reportedBy.find(
              ({ user, payload }) =>
                String(payload._id) === String(reporting.payloadId) &&
                String(user) === String(reportByUserId),
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
                  : payloadReportBy?.payload
                  ? this.contentService.toCastPayload({
                      content: payloadReportBy?.payload as Content,
                    })
                  : undefined,
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
    const pipelines = pipelineOfGetReporting(query);

    this.logger.log(`#pipelineOfGetReporting::${JSON.stringify(pipelines)}`);

    const [payloadReporting] = await this.repository.aggregateReporting(
      pipelines,
    );

    return ResponseDto.ok({
      payload: await this.toPayloadReportings(payloadReporting),
      meta: Meta.fromDocuments(payloadReporting.reportings),
    });
  }

  async updateIllegal(
    body: UpdateIllegal,
    staff: Staff,
    action: ReportingIllegal,
  ) {
    const query = {
      payloadId: new Types.ObjectId(body.id),
      type: body.type as ReportingType,
      status: [
        ReportingStatus.REVIEWING,
        ReportingStatus.ILLEGAL,
        ReportingStatus.APPEAL,
        ReportingStatus.NOT_APPEAL,
        ReportingStatus.DONE,
      ],
    };

    if (staff.role === StaffRole.EDITOR)
      query.status = [ReportingStatus.APPEAL, ReportingStatus.REVIEWING];

    const reportings = await this.repository.findReportings(query);

    if (!reportings.length) throw new CastcleException('REPORTING_NOT_FOUND');

    const targetReporting =
      body.type === ReportingType.USER
        ? await this.repository.findUser({
            _id: new Types.ObjectId(body.id) as any,
            visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
          })
        : await this.repository.findContent({
            _id: new Types.ObjectId(body.id) as any,
            visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
          });

    if (!targetReporting)
      throw new CastcleException(
        body.type === ReportingType.USER
          ? 'USER_OR_PAGE_NOT_FOUND'
          : 'CONTENT_NOT_FOUND',
      );

    const userOwner = await this.repository.findUser({
      _id:
        body.type === ReportingType.USER
          ? targetReporting.id
          : (targetReporting as Content).author.id,
      visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
    });

    if (!userOwner) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const accountOwner = await this.repository.findAccount({
      _id: userOwner?.ownerAccount,
    });

    if (!accountOwner) throw new CastcleException('REQUEST_URL_NOT_FOUND');

    if (action === ReportingIllegal.ILLEGAL) {
      targetReporting.visibility =
        targetReporting.visibility === EntityVisibility.Publish
          ? EntityVisibility.Illegal
          : EntityVisibility.Deleted;

      if (targetReporting.reportedStatus === ReportingStatus.ILLEGAL)
        targetReporting.reportedStatus = ReportingStatus.CLOSED;

      if (!targetReporting.reportedStatus)
        targetReporting.reportedStatus = ReportingStatus.ILLEGAL;

      targetReporting.reportedSubject = body.subjectByAdmin;
      if (targetReporting.visibility === EntityVisibility.Illegal) {
        if (body.type === ReportingType.CONTENT) {
          --userOwner.casts;
          await this.repository.updateCastByReCastORQuote(
            body.id,
            EntityVisibility.Illegal,
            -1,
          );
        } else {
          await this.reduceFollows(targetReporting.id, -1);
        }
      } else {
        await this.repository.deleteAllContent(targetReporting.id);
        if (body.type === ReportingType.USER)
          await this.repository.deleteUser(targetReporting.id);
      }
    } else {
      targetReporting.visibility = EntityVisibility.Publish;
      delete targetReporting.reportedStatus;
      delete targetReporting.reportedSubject;
      if (body.type === ReportingType.CONTENT) {
        userOwner.casts++;
        await this.repository.updateCastByReCastORQuote(
          body.id,
          EntityVisibility.Publish,
          1,
        );
      } else {
        await this.reduceFollows(targetReporting.id, 1);
      }
    }

    await Promise.all([
      this.cacheManager.reset(),
      userOwner.save(),
      targetReporting.save(),
      reportings.map(async (reporting) => {
        const status = this.checkingStatusActive(reporting.status);
        if (!status && reporting.status === ReportingStatus.CLOSED) return;
        reporting.status = status;
        (reporting.actionBy ??= []).push({
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          action: action,
          status: status,
          message: body.messageByAdmin,
          subject: body.subjectByAdmin,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        reporting.markModified('actionBy');
        await reporting.save();
      }),
      this.notificationService.notifyToUser(
        {
          source:
            userOwner.type === UserType.PEOPLE
              ? NotificationSource.Profile
              : NotificationSource.Page,
          sourceUserId: undefined,
          type:
            action === ReportingIllegal.ILLEGAL
              ? targetReporting.visibility === EntityVisibility.Illegal
                ? NotificationType.IllegalDone
                : NotificationType.IllegalClosed
              : NotificationType.NotIllegal,
          profileRef:
            body.type === ReportingType.USER ? targetReporting._id : undefined,
          contentRef:
            body.type === ReportingType.CONTENT
              ? targetReporting._id
              : undefined,
          account: userOwner.ownerAccount,
          read: false,
        },
        userOwner,
        accountOwner?.preferences?.languages[0] || LocalizationLang.English,
      ),
    ]);
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

    if (!(users.length && contents.length)) return;

    const checkUnique = (inputList: any[]) =>
      [...new Set(inputList.map((item) => JSON.stringify(item)))].map((item) =>
        JSON.parse(item),
      );

    const uniqueUsers = checkUnique(users);
    const uniqueContents = checkUnique(contents);

    await Promise.all([
      this.cacheManager.reset(),
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
      uniqueUsers.map(async (user) => {
        user.visibility = EntityVisibility.Deleted;
        await user.save();

        await this.repository.deleteUser(user.id);

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
          accountOwner?.preferences?.languages[0] || LocalizationLang.English,
        );
      }),
      uniqueContents.map(async (content) => {
        content.visibility = EntityVisibility.Deleted;
        await content.save();

        await this.repository.deleteAllContent(content.id);

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
          accountOwner?.preferences?.languages[0] || LocalizationLang.English,
        );
      }),
    ]);
  }
}
