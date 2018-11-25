const crypto = require('crypto')
const _db=require('../../../database/mongodb')

/**
 * /api/team/registration 申请加入队伍
 */
exports.route = {
  async post({ tid }){
    let _col_team=await _db('team');
    let _col_regis=await _db('registration');

    let data=this.params;
    let {cardnum,name}=this.user;

    let findRegis=await _col_regis.findOne({tid,cardnum,status:{$in:[0,1]}});
    if(findRegis){
      throw "不可重复申请";
    }
    let targetTeam=await _col_team.findOne({tid});
    let currentPeople=targetTeam.currentPeople;

    if(process.env.NODE_ENV==='production'&&targetTeam.cardnum===cardnum){
      throw "请勿申请加入自己创建的队伍"
    }

    if(currentPeople.length>=targetTeam.maxPeople){
      throw "队内人数已达上限";
    }

    data.status=0;
    data.cardnum=cardnum;
    data.applicant=name;
    data.applicationDate=data.updateDate=moment().unix();
    data.rid = crypto.createHash('sha256')
                    .update( tid )
                    .update( `${data.updateDate}` )
                    .update( cardnum )
                    .digest( 'hex' );

    if(Object.keys(data).length!=9)
      throw "错误的参数";
    try{
      await _col_regis.ensureIndex('rid',{unique:true});
      await _col_regis.insertOne(data);
      return {status:0};
    }
    catch(e){
      if(e.code==11000)
        return {status:1};
      throw "提交申请失败"
    }
  },

  async put({rid}){
    let _col_regis=await _db('registration');

    let data=this.params;

    let {cardnum}=this.user;

    let target=await _col_regis.findOne({rid});

    if(target.cardnum!==cardnum){
      throw 403;
    }
    try{
      delete data.tid;
      delete data.applicant;
      delete data.cardnum;
      await _col_regis.updateMany({rid},{$set:data});
      return {status:0};
    }
    catch(e){
      throw "数据库错误";
    }

  },

  async delete({rid ,hard}) {
    if(!(hard&&typeof(hard)==='string')){
      throw '错误的请求参数';
    }
    hard=hard==='true';

    let _col_regis=await _db('registration');

    let {cardnum}=this.user;
    let regis = await _col_regis.findOne({ rid });

    if(!regis){
      throw "找不到申请";
    }

    if(cardnum!==regis.cardnum){
      throw 403;
    }
    if(regis.status!==0){
      throw "无法取消申请";
    }

    try{
      if(hard){
        await _col_regis.removeOne({rid});
      }else{
      await _col_regis.updateOne({rid},{$set:{status:3}});
      }
      return{status:0}
    }
    catch(e){
      throw "数据库错误";
    }
  }
}
