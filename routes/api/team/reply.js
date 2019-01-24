const db=require('../../../database/team')
const moment=require('moment')

/**
 * /api/team/reply 回复加入组队请求
 */
exports.route = {
  async post({rid, text, response}) {
    let teamView=await db.getCollection('userTeamView');
    let regisView=await db.getCollection('userRegisView');

    response=response==='true';

    let targetRegis = await regisView.findOne({ rid});
    switch(targetRegis.status){
      case 0:break;
      case 1:throw '请求已被同意';
      case 2:throw '请求已被拒接';
      case 3:throw '对方请求已取消';
      case 4:throw '对方请求已失效';
      default: throw '未知的参数"status"'
    }
    
    let targetTeam = await teamView.findOne({ tid: targetRegis.tid});
    let currentPeople = targetTeam.currentPeople;
    if (currentPeople.length >= targetTeam.maxPeople) {
      throw "队内人数已达上限";
    }

    //创建事务
    let client=await db.getMongoClient();
    let session=client.startSession();
    session.startTransaction();
    try {
      let team=await db.getCollection('team');
      let regis=await db.getCollection('registration');  
      let status;
      if (response) {
        currentPeople.push({cardnum:targetRegis.cardnum,name:targetRegis.applicantName});
        await team.updateOne({tid: targetRegis.tid}, {$set:{currentPeople}});
        status=1;
      } else{
        status = 2;
      }
      await regis.updateMany(
        {rid}, 
        {$set:{
          status,updateTime: moment().unix(),
          responseText: text
        }});
      //提交事务
      session.commitTransaction();
      session.endSession();
      return {status: 0}

    } catch (e) {
      //回滚事务
      session.abortTransaction();
      session.endSession();
      throw "数据库错误"
    }
  }
}
