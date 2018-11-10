const _db=require('../../../database/mongodb')

/**
 * /api/team/reply
 */
exports.route = {
  async post({rid, text, response}) {
    let _col_team=await _db('team');
    let _col_regis=await _db('registration');

    let targetRegis = await _col_regis.findOne({ rid});
    if (targetRegis.status != 0) {
      throw "回复失败";
    }
    let targetTeam = await _col_team.findOne({ tid: targetRegis.tid});
    let currentPeople = targetTeam.currentPeople;

    try {
      let status = 1;
      if (response==="true") {
        if (currentPeople.length >= targetTeam.maxPeople) {
          throw "队内人数已达上限";
        }
        currentPeople.push({cardnum:targetRegis.cardnum,name:targetRegis.applicant});
        await _col_team.updateOne({tid: targetRegis.tid}, {$set:{currentPeople}});
      } else if(response==="false"){
        status = 2;
      }
      await _col_regis.updateMany({rid}, {$set:{status,updateTime: moment().unix(),responseText: text}});
      return {status: 0}

    } catch (e) {
      throw "数据库错误"
    }
  }
}
