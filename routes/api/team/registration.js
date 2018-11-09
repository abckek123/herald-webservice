const { config } = require('../../../app')
const db = require('../../../database/team')
const crypto = require('crypto')

/**
 * /api/team/registration
 */
exports.route = {
  async post({ tid }){
    let data=this.params;
    let {cardnum}=this.user;

    let targetTeam=await db.team.find({tid},1);
    let currentPeople=targetTeam.currentPeople.split(' ');

    if(currentPeople.length>=targetTeam.maxPeople){
      throw "队内人数已达上限";
    }
    let findRegis=await db.registration.find({tid,cardnum,status:{$in:[0,1]}},1);
    if(findRegis){
      throw "不可重复申请";
    }
    
    data.status=0;
    data.cardnum=cardnum;
    data.applicationDate=data.updateDate=moment().unix();
    data.rid = crypto.createHash('sha256')
                    .update( tid )
                    .update( `${data.updateDate}` )
                    .update( cardnum )
                    .digest( 'hex' );

    if(Object.keys(data).length!=9)
      throw "错误的参数";
    try{
      await db.registration.insert(data);
      return {status:0};
    }
    catch(e){
      if(e.errno==19)
        return {status:1};
      throw "提交申请失败"
    }
  },

  async put({rid}){
    let data=this.params;

    let {cardnum}=this.user;

    let target=await db.registration.find({rid},1);

    if(target.cardnum!==cardnum){
      throw 403;
    }
    try{
      delete data.tid;//以防修改组队项
      await db.registration.update({rid},data);
      return {status:0};
    }
    catch(e){
      throw "数据库错误";
    }

  },

  async delete({rid }) {
    let {cardnum}=this.user;
    let regis = await db.registration.find({ rid },1);

    if(cardnum!==regis.cardnum){
      throw 403;
    }
    if(regis.status!==0){
      throw "无法取消申请"
    }

    try{
      await db.registration.update({rid},{status:4});
      return{status:0}
    }
    catch(e){
      throw "数据库错误";
    }
  }
}
