const { config } = require('../../../app')
const db = require('../../../database/team')
const crypto = require('crypto')

/**
 * /api/team 竞赛组队API
 */
exports.route = {
  async get({type,page=1,param}){

    if(page<=0)
      throw "错误的页码";

    let pageSize=6;
    let offset=(page-1)*pageSize;
    if(type==1){

      let data=await db.team.find({status:{$lt:4}},pageSize,offset,'publishedDate');
      return {data};

    }else if(type==2){

      let {cardnum}=this.user;

      let published=await db.team.find(
        {cardnum},
        pageSize,offset,'publishedDate');

      let requested=await db`
      SELECT r.*,t.teamName AS teamName,t.projectName AS projectName
      FROM registration r,team t
      WHERE r.tid=t.tid AND r.cardnum=${cardnum} AND r.status<4
      ORDER BY applicationDate
      LIMIT ${pageSize} OFFSET ${offset}`;  

      
      let tids=[].concat(published).map(eachColume=>`'${eachColume.tid}'`);
      //使用模板字符串的查询无法正确处理 IN (数组) 的查询
      let received=await db.raw(`
      SELECT r.*,t.teamName AS teamName,t.projectName AS projectName
      FROM registration r,team t
      WHERE r.tid=t.tid AND r.tid IN (${tids}) AND r.status<4
      ORDER BY applicationDate
      LIMIT ${pageSize} OFFSET ${offset}`);

      return{published,requested,received};
    }else if(type==3){
      param=JSON.parse(param);
      param.status={$lt:4};
      let data=await db.team.find(param,pageSize,offset,'publishedDate');
      return {data};
    }
    else{
     throw 'unknown request type';
    }
  },

  async post(){
    let data=this.params;
    let {name,cardnum}=this.user;

    let count=await db.team.count('*',{cardnum,status:{$lt:4}});
    let currentTime=moment().unix();
    data.deadLine=moment(data.deadLine,"YYYY-MM-DD").unix();

    if(data.deadLine<currentTime){
      throw "截止日期需超过今日";
    }
    if(count==2){
      throw '同时可发布数已达上限(两个)';
    }

    data.tid = crypto.createHash('sha256')
                    .update( data.teamName )
                    .update( data.projectName )
                    .update( cardnum )
                    .digest( 'hex' );
    
    data.masterName=name;               
    data.currentPeople=cardnum;
    data.cardnum=cardnum;
    data.publishedDate=currentTime;
    data.status=0;
    if(Object.keys(data).length!=11)
      throw "错误的参数";
    try{
      await db.team.insert(data);
      return {status:0}
    }
    catch(e){
      if(e.errno==19)
        return {status:1};
      throw '数据库错误';
    }
  },

  async put({tid}){
    let data=this.params;

    let {cardnum}=this.user;
    let targetTeam=await db.team.find({tid},1);

    if(targetTeam.cardnum!==cardnum)
      throw 403;
    if(targetTeam.currentPeople.split(' ').length>data.maxPeople)
      throw '队内人数大于修改的目标值';

    delete data.masterName;
    delete data.cardnum;
    try{
      await db.team.update({tid},data);
      return {status:0}
    }
    catch(e){
      throw '数据库错误';
    }    
  },

  async delete({tid,hard}) {

    let {cardnum}=this.user;
    let team = await db.team.find({ tid },1);

    if(cardnum!==team.cardnum){
      throw 403;
    }
    try{
      if(hard){
        await db.team.remove({tid},1);
      }
      else{
        await db.team.update({tid},{status:4});
      }
      await db.registration.update({ tid ,status:{$le:4}},{status:4});

      return{ status: 0}
    }
    catch(e){
      throw "数据库错误";
    }
  }
}
