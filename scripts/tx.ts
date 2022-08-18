import { connect, disconnect, model, Schema, Types } from 'mongoose';

enum WalletType {
  // Castcle Wallet Type
  CASTCLE_AIRDROP = 'castcle.airdrop',
  CASTCLE_SOCIAL = 'castcle.social',
  EXTERNAL_DEPOSIT = 'external.deposit',
  EXTERNAL_WITHDRAW = 'external.withdraw',

  // User Wallet Type
  ADS = 'ads',
  FARM_LOCKED = 'farm.locked',
  PERSONAL = 'personal',
}

enum TransactionStatus {
  FAILED = 'failed',
  PENDING = 'pending',
  VERIFIED = 'verified',
}

const UserWalletTypes = [
  WalletType.ADS,
  WalletType.FARM_LOCKED,
  WalletType.PERSONAL,
];

const pipelineOfTransactionVerification = (tx) => [
  {
    $facet: {
      isValid: [
        {
          $match: {
            _id: new Types.ObjectId(tx._id),
          },
        },
        {
          $project: {
            from: '$from.value',
            check: {
              $reduce: {
                input: '$to',
                initialValue: {
                  sumOfTo: {
                    $toDecimal: 0,
                  },
                  walletType: {
                    $cond: {
                      if: { $in: ['$from.type', UserWalletTypes] },
                      then: { $eq: [{ $type: '$from.user' }, 'objectId'] },
                      else: true,
                    },
                  },
                },
                in: {
                  sumOfTo: {
                    $add: ['$$value.sumOfTo', '$$this.value'],
                  },
                  walletType: {
                    $cond: {
                      if: '$$value.walletType',
                      then: {
                        $cond: {
                          if: {
                            $in: ['$$this.type', UserWalletTypes],
                          },
                          then: {
                            $and: ['$$value.walletType', '$$this.user'],
                          },
                          else: '$$value.walletType',
                        },
                      },
                      else: '$$value.walletType',
                    },
                  },
                },
              },
            },
          },
        },
      ],
      inflows: [
        {
          $match: {
            'to.user': new Types.ObjectId(tx.from.user),
            status: TransactionStatus.VERIFIED,
          },
        },
        {
          $project: {
            to: {
              $reduce: {
                input: '$to',
                initialValue: {
                  ads: {
                    $toDecimal: 0,
                  },
                  farm: {
                    $toDecimal: 0,
                  },
                  personal: {
                    $toDecimal: 0,
                  },
                  others: {
                    $toDecimal: 0,
                  },
                },
                in: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $ne: [
                            '$$this.user',
                            new Types.ObjectId(tx.from.user),
                          ],
                        },
                        then: '$$value',
                      },
                      {
                        case: {
                          $eq: ['$$this.type', 'ads'],
                        },
                        then: {
                          ads: {
                            $add: ['$$value.ads', '$$this.value'],
                          },
                          farm: '$$value.farm',
                          others: '$$value.others',
                          personal: '$$value.personal',
                        },
                      },
                      {
                        case: {
                          $eq: ['$$this.type', 'farm.locked'],
                        },
                        then: {
                          ads: '$$value.ads',
                          farm: {
                            $add: ['$$value.farm', '$$this.value'],
                          },
                          others: '$$value.others',
                          personal: '$$value.personal',
                        },
                      },
                      {
                        case: {
                          $eq: ['$$this.type', 'personal'],
                        },
                        then: {
                          ads: '$$value.ads',
                          farm: '$$value.farm',
                          others: '$$value.others',
                          personal: {
                            $add: ['$$value.personal', '$$this.value'],
                          },
                        },
                      },
                    ],
                    default: {
                      ads: '$$value.ads',
                      farm: '$$value.farm',
                      personal: '$$value.personal',
                      others: {
                        $add: ['$$value.others', '$$this.value'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
      outflows: [
        {
          $match: {
            'from.user': new Types.ObjectId(tx.from.user),
            status: {
              $ne: TransactionStatus.FAILED,
            },
          },
        },
        {
          $project: {
            from: {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: ['$_id', new Types.ObjectId(tx._id)],
                    },
                    then: {
                      unavailable: { $toDecimal: 0.0 },
                    },
                  },
                  {
                    case: {
                      $ne: ['$status', TransactionStatus.VERIFIED],
                    },
                    then: {
                      unavailable: '$from.value',
                    },
                  },
                  {
                    case: {
                      $eq: ['$from.type', 'ads'],
                    },
                    then: {
                      ads: '$from.value',
                    },
                  },
                  {
                    case: {
                      $eq: ['$from.type', 'farm.locked'],
                    },
                    then: {
                      farm: '$from.value',
                    },
                  },
                  {
                    case: {
                      $eq: ['$from.type', 'personal'],
                    },
                    then: {
                      personal: '$from.value',
                    },
                  },
                ],
                default: {
                  others: '$from.value',
                },
              },
            },
          },
        },
      ],
    },
  },
  {
    $project: {
      ads: {
        $subtract: [
          {
            $sum: '$inflows.to.ads',
          },
          {
            $sum: '$outflows.from.ads',
          },
        ],
      },
      farm: {
        $subtract: [
          {
            $sum: '$inflows.to.farm',
          },
          {
            $sum: '$outflows.from.farm',
          },
        ],
      },
      personal: {
        $subtract: [
          {
            $sum: '$inflows.to.personal',
          },
          {
            $sum: '$outflows.from.personal',
          },
        ],
      },
      others: {
        $subtract: [
          {
            $sum: '$inflows.to.others',
          },
          {
            $sum: '$outflows.from.others',
          },
        ],
      },
      unavailable: { $sum: '$outflows.from.unavailable' },
      isValidWalletType: {
        $first: '$isValid.check.walletType',
      },
      from: {
        $first: '$isValid.from',
      },
      sumOfTo: {
        $first: '$isValid.check.sumOfTo',
      },
    },
  },
  {
    $addFields: {
      isEnoughBalance: {
        $gte: [
          {
            $subtract: [
              { $sum: ['$ads', '$farm', '$personal', '$others'] },
              '$unavailable',
            ],
          },
          '$from',
        ],
      },
      isValidChecksum: {
        $eq: ['$from', '$sumOfTo'],
      },
      isValidWalletType: 1,
    },
  },
];

class CreateCampaigns {
  static run = async () => {
    const args = {} as Record<string, string>;
    process.argv.forEach((arg) => {
      const v = arg.match(/--(\w+)=(.+)/);
      if (v) args[v[1]] = v[2];
    });
    const dbName = args['dbName'] || 'test';
    const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
    await connect(url);
    const txModel = model('Transaction', new Schema({}));
    const validation = await txModel.aggregate(
      pipelineOfTransactionVerification({
        _id: '62fce6cc1daacffb2d6f806d',
        from: { user: '6170067a51db852fb36d2109' },
      }),
    );

    console.info(JSON.stringify(validation, null, 4));
    await disconnect();
  };
}

CreateCampaigns.run().catch(console.error);
