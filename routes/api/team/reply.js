const {
  config
} = require('../../../app')
const db = require('../../../database/team')
const crypto = require('crypto')

/**
 * /api/team/reply
 */
exports.route = {
  async post({rid, text, response}) {
    let targetRegis = await db.registration.find({ rid}, 1);
    if (targetRegis.status != 0) {
      throw "回复失败";
    }
    let targetTeam = await db.team.find({ tid: targetRegis.tid}, 1);
    let currentPeople = targetTeam.currentPeople.split(' ');

    try {
      let status = 1;
      if (response) {
        if (currentPeople.length >= targetTeam.maxPeople) {
          throw "队内人数已达上限";
        }
        let updatedPeople = currentPeople + ` ${targetRegis.cardnum}`;
        await db.team.update({tid: targetRegis.tid}, {currentPeople: updatedPeople});
      } else {
        status = 2;
      }
      await db.registration.update({rid}, {status,updateTime: moment().unix(),responseText: text});
      return {status: 0}

    } catch (e) {
      throw "数据库错误"
    }
  }
}
