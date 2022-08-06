import { EntityVisibility, User, UserType } from '@castcle-api/database';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { UserQuery } from '../models/users.dto';

@Injectable()
export class UserBackofficeService {
  constructor(@InjectModel('User') private userModel: Model<User>) {}

  async getUsers({ keyword, page, maxResults }: UserQuery) {
    const keywordCondition = keyword && {
      displayName: { $regex: keyword, $options: 'i' },
      displayId: { $regex: keyword, $options: 'i' },
      email: { $regex: keyword, $options: 'i' },
    };

    const searchCondition = {
      matchCondition: {
        $match: {
          type: UserType.PEOPLE,
          visibility: EntityVisibility.Publish,
          ...keywordCondition,
        },
      },
      page,
      maxResults,
    };

    const [users, totalUsers] = await Promise.all([
      this.pipelineOfUsers(searchCondition),
      this.pipelineOfCountUsers(searchCondition),
    ]);

    return { users, totalUsers };
  }

  private pipelineOfUsers({
    matchCondition,
    maxResults,
    page,
  }: SearchCondition) {
    return this.userModel.aggregate([
      { ...matchCondition },
      { $skip: page },
      { $limit: maxResults },
    ]);
  }

  private async pipelineOfCountUsers({ matchCondition }: SearchCondition) {
    const [{ totalUsers }] = await this.userModel.aggregate([
      { ...matchCondition },
      { $count: 'totalUsers' },
    ]);

    return totalUsers;
  }
}

type SearchCondition = {
  matchCondition: PipelineStage;
  page: number;
  maxResults: number;
};
