const crypto = require('crypto')
const _db=require('../../../database/mongodb')

//db.test.ensureIndex({"tid":1})

/**
 * /api/team 竞赛组队API
 */
exports.route = {
  async get({type,page=1,param}){
    let _col_team=await _db('team');
    let _col_regis=await _db('registration');

    if(page<=0)
      throw "错误的页码";

    let pageSize=6;
    let offset=(page-1)*pageSize;

    if(type==1){
      let data=await _col_team
      .find({status:{$lt:4}})
      .skip(offset)
      .limit(pageSize)
      .sort({'publishedDate':-1})
      .map(x=>{delete x._id;return x;})
      .toArray();
      return {data};

    }else if(type==2){

      let {cardnum}=this.user;

      let published=await _col_team
      .find({cardnum})
      .skip(offset)
      .limit(pageSize)
      .sort({'publishedDate':-1})
      .map(x=>{delete x._id;return x;})
      .toArray();

      let requested=await _col_regis
      .aggregate([{
        $match: {
          cardnum
        }
       },{
       $lookup:{
         from:"team",
         localField:'tid',
         foreignField:'tid',
         as:'team'}
      }
      ])
      .skip(offset)
      .limit(pageSize)
      .sort({'applicationDate':-1})
      .map(x=>{
        delete x._id;
        x.teamName=x.team[0]?x.team[0].teamName:'队伍已被删除';
        x.projectName=x.team[0]?x.team[0].projectName:'队伍已被删除';
        delete x.team;
        return x;
      })
      .toArray();

      let tids=published.map(eachColume=>eachColume.tid);
      let received=await _col_regis
      .aggregate([{
        $match:{
          status:{$lt:4},
          tid:{$in:tids}
        }
      },{
        $lookup: {
          from: "team",
          localField: 'tid',
          foreignField: 'tid',
          as: 'team'
        }
      }])
      .skip(offset)
      .limit(pageSize)
      .sort({'applicationDate':-1})
      .map(x=>{
        delete x._id;
        x.teamName=x.team[0].teamName;
        x.projectName=x.team[0].projectName;
        delete x.team;
        return x;
      })
      .toArray();

      return{published,requested,received};

    }else if(type==3){
      param=JSON.parse(param);
      param.status={$lt:4};
      let data=await _col_team
      .find({status:{$lt:4},...param})
      .skip(offset)
      .limit(pageSize)
      .sort({'publishedDate':-1})
      .map(x=>{
        delete x._id;
        x.teamName=x.team[0].teamName;
        x.projectName=x.team[0].projectName;
        delete x.team;
        return x;
      })
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
    let _col_team=await _db('team');

    let count=await _col_team.countDocuments({cardnum,status:{$lt:4}});
    let currentTime=moment().unix();
    data.deadLine=moment(data.deadLine,"YYYY-MM-DD").unix();

    if(isNaN(data.deadLine)){
      throw "错误的日期";
    }
    if(data.deadLine<currentTime){
      throw "截止日期需超过今日";
    }
    if(count==2){
      throw '同时可发布数已达上限(两个)';
    }

    data.tid = crypto.createHash('sha256')
                    .update( data.teamName )
                    .update( data.projectName )
                    .update( `${data.deadLine}` )
                    .update( cardnum )
                    .digest( 'hex' );

    data.masterName=name;
    data.currentPeople=[{cardnum,name}];
    data.cardnum=cardnum;
    data.publishedDate=currentTime;
    data.status=0;

    if(Object.keys(data).length!=12)
      throw "错误的参数";
    try{
      await _col_team.ensureIndex('tid',{unique:true});
      await _col_team.insertOne(data);
      return {status:0}
    }
    catch(e){
      if(e.code==11000)
        return {status:1};
      throw '数据库错误';
    }
  },

  async put({tid}){
    let _col_team=await _db('team');

    let data=this.params;

    let {cardnum}=this.user;
    let targetTeam=await _col_team.findOne({tid});

    if(targetTeam.cardnum!==cardnum){
      throw 403;
    }
    if(targetTeam.currentPeople.length>data.maxPeople){
      throw '队内人数大于修改的目标值';
    }

    delete data.masterName;
    delete data.cardnum;
    try{
      await _col_team.ensureIndex('tid',{unique:true});
      await _col_team.updateOne({tid},{$set:data});
      return {status:0}
    }
    catch(e){
      throw '数据库错误';
    }
  },

  async delete({tid,hard}) {
    let _col_team=await _db('team');
    let _col_regis=await _db('registration');
    let {cardnum}=this.user;
    let team = await _col_team.findOne({ tid });

    if(!team){
      throw "找不到队伍";
    }
    if(cardnum!==team.cardnum){
      throw 403;
    }
    try{
      if(typeof(hard)==='boolean'&&hard===true){
        await _col_team.removeOne({tid});
      }
      else{
        await _col_team.updateOne({tid},{$set:{status:4}});
      }
      await _col_regis.updateMany({ tid ,status:{$lt:4}},{$set:{status:4}});
      return{ status: 0}
    }
    catch(e){
      throw "数据库错误";
    }
  }
}
