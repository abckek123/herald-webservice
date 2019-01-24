const crypto = require('crypto')
const db=require('../../../database/team')
const moment=require('moment')

/**
 * /api/team/registration 申请加入队伍
 */
exports.route = {
  async post({ tid }){
    let teamView=await db.getCollection('userTeamView');
    let regisView=await db.getCollection('userRegisView');

    let data=this.params;
    let {cardnum,name}=this.user;

    let findRegis=await regisView.findOne({tid,cardnum,status:{$in:[0,1]}});
    if(findRegis){
      throw "不可重复申请";
    }
    let targetTeam=await teamView.findOne({tid});
    let currentPeople=targetTeam.currentPeople;

    if(process.env.NODE_ENV==='production'&&targetTeam.cardnum===cardnum){
      throw "请勿申请加入自己创建的队伍"
    }
    if(currentPeople.length>=targetTeam.maxPeople){
      throw "队内人数已达上限";
    }

    const currentTime=moment().unix();
    const rid = crypto.createHash('sha256')
                    .update( tid )
                    .update( `${currentTime}` )
                    .update( cardnum )
                    .digest( 'hex' );

    let _data={
      rid,
      tid:data.tid,
      applicantName:name,
      QQ:data.QQ,
      description:data.description,
      requestTime:currentTime,
      updateTime:currentTime,
      cardnum,
      status:0
    }

    //数据库操作
    try{
      let regis=await db.getCollection('registration');  
      await regis.insertOne(_data);
      return {status:0};
    }
    catch(e){
      if(e.code==11000)
        return {status:1};
      throw "提交申请失败"
    }
  },

  async put({rid}){
    let regisView=await db.getCollection('userRegisView');

    let data=this.params;
    let {cardnum}=this.user;
    let target=await regisView.findOne({rid});
    if(target.cardnum!==cardnum){
      throw 403;
    }
    if(target.status!==0){
      throw "无法修改";
    }

    data.updateTime=moment().unix();
    try{
      delete data.tid;
      delete data.applicantName;
      delete data.cardnum;
      let regis=await db.getCollection('registration');
      await regis.updateMany({rid},{$set:data});
      return {status:0};
    }
    catch(e){
      throw "数据库错误";
    }

  },

  async delete({rid ,hard}) {
    hard=hard==='true';

    let regisView=await db.getCollection('userRegisView');
    let {cardnum}=this.user;
    let regis = await regisView.findOne({ rid });

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
      let regis=await db.getCollection('registration');
      if(hard){
        await regis.removeOne({rid});
      }else{
        await regis.updateOne({rid},{$set:{status:3}});
      }
      return{status:0}
    }
    catch(e){
      throw "数据库错误";
    }
  }
}
