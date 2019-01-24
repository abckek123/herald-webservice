const crypto = require('crypto');
const db=require('../../../database/team');
const moment=require('moment')

/**
 * /api/team 竞赛组队API
 *   
 */

exports.route = {
  async get({type,page=1,param}){
    if(page<=0)
      throw "错误的页码";

    let pageSize=6;
    let offset=(page-1)*pageSize;
    let teamView=await db.getCollection('userTeamView');
    let regisView=await db.getCollection('userRegisView');

    if(type==1){
      let data=await teamView
      .find({status:{$lt:4}})
      .hint('publishTime_-1')
      .skip(offset)
      .limit(pageSize)
      .toArray();
      return {data};

    }else if(type==2){

      let {cardnum}=this.user;

      let published=await teamView
      .find({cardnum})
      .hint('publishTime_-1')
      .toArray();

      let requested=await regisView
      .aggregate([{
        $match: {cardnum}
       },{
       $lookup:{
         from:"userTeamView",
         localField:'tid',
         foreignField:'tid',
         as:'team'}
      }
      ])
      .hint('updateTime_-1')
      .map(x=>{
        x.teamName=x.team[0]?x.team[0].teamName:'队伍不存在或已被删除';
        x.projectName=x.team[0]?x.team[0].projectName:'队伍不存在或已被删除';
        delete x.team;
        return x;
      })
      .toArray();

      let tids=published.map(eachColume=>eachColume.tid);
      let received=await regisView
      .aggregate([{
        $match:{
          status:{$lt:4},
          tid:{$in:tids}
        }
      },{
        $lookup: {
          from: "userTeamView",
          localField: 'tid',
          foreignField: 'tid',
          as: 'team'
        }
      }])
      .hint('updateTime_-1')
      .map(x=>{
        x.teamName=x.team[0]?x.team[0].teamName:'队伍不存在或已被删除';
        x.projectName=x.team[0]?x.team[0].projectName:'队伍不存在或已被删除';
        delete x.team;
        return x;
      })
      .toArray();

      return{published,requested,received};

    }else if(type==3){
      param=JSON.parse(param);
      let data=await teamView
      .find({status:{$lt:4},...param})
      .hint('publishTime_-1')
      .skip(offset)
      .limit(pageSize)
      .toArray();
      return {data};
    }
    else{
     throw 'unknown request type';
    }
  },

  async post(){
    let data=this.params;
    let {name,cardnum}=this.user;
    
    let teamView=await db.getCollection('userTeamView');
    let count=await teamView.countDocuments({cardnum,status:{$lt:4}});
    let currentTime=moment().unix();
    //数据格式合法性判断
    if(data.endTime.length!==10){
      throw "错误的日期";
    }
    if(data.endTime<currentTime){
      throw "截止日期需超过今日";
    }
    if(count==2){
      throw '同时可发布数已达上限(两个)';
    }

    let tid = crypto.createHash('sha256')
                    .update( data.teamName )
                    .update( data.projectName )
                    .update( `${data.endTime}` )
                    .update( cardnum )
                    .digest( 'hex' );

    let _data={
      tid:tid,
      teamName:data.teamName,
      projectName:data.projectName,
      masterName:name,
      cardnum:cardnum,
      QQ:data.QQ,
      currentPeople:[{cardnum,name}],
      maxPeople:data.maxPeople,
      publishTime:currentTime,
      endTime:data.endTime,
      status:0,
      deleteReason:null
    }
    //数据库操作
    try{
      let team=await db.getCollection('team');
      await team.insertOne(_data);
      return {status:0}
    }
    catch(e){
      if(e.code==11000)
        return {status:1};
      throw '操作失败';
    }
  },

  async put({tid}){
    let data=this.params;
    let {cardnum}=this.user;
    let teamView=await db.getCollection('userTeamView');
    let targetTeam=await teamView.findOne({tid});

    //数据格式合法性判断
    if(targetTeam.cardnum!==cardnum){
      throw 403;
    }
    if(targetTeam.currentPeople.length>data.maxPeople){
      throw '队内人数大于修改的目标值';
    }
    delete data.masterName;
    delete data.cardnum;


    //数据库操作
    try{
      let team=await db.getCollection('team');  
      await team.updateOne({tid},{$set:data});
      return {status:0}
    }
    catch(e){
      throw '操作失败';
    }
  },

  async delete({tid,hard,msg}) {

    let {cardnum}=this.user;
    let teamView=await db.getCollection('userTeamView');
    let team = await teamView.findOne({ tid });
    //开发环境下任何人均可作为管理员身份
    let isAdmin=this.admin ||process.env.NODE_ENV==='development';
    if(!team){
      throw "找不到队伍";
    }
    if(cardnum!==team.cardnum && !isAdmin){
      throw 403;
    }
    hard=hard==='true';

    //开启事务
    let client=await db.getMongoClient();
    let session=client.startSession();
    session.startTransaction();
    try{
      let team=await db.getCollection('team');
      let regis=await db.getCollection('registration');  
      if(hard){
        await team.removeOne({tid});
      }
      else if(isAdmin&&msg){
        //管理员删除
        await team.updateOne({tid},{$set:{status:5,deleteReason:msg}});
      }
      else{
        //用户删除
        await team.updateOne({tid},{$set:{status:4}});
      }
      //更新此队伍的申请
      await regis.updateMany({ tid ,status:{$lt:3}},{$set:{status:4}});

      //提交事务
      session.commitTransaction();
      session.endSession();
      return{ status: 0}
    }
    catch(e){
      session.abortTransaction();
      session.endSession();
      throw "操作失败";
    }
  }
}